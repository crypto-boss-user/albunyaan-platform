/**
 * People + subscriptions importer — PRD §4c.
 * Parses the Uscreen admin People CSV export, normalizes emails, dedupes,
 * and emits upsert-shaped rows through worker/lib/db.ts (driver-agnostic:
 * jsonl offline now, Supabase later via ALBUNYAAN_DB_DRIVER=supabase).
 *
 * SUPERSEDED — do not run this against production. The real people import
 * is worker/import-people-csv.ts (`npm run import-people-csv`), which
 * matches the actual export column shape and doesn't touch subscriptions.
 * This file's status mapping below feeds the raw Uscreen "Segment" column
 * straight into subscriptions.status with no enum validation — Segment is
 * an arbitrary Uscreen label (e.g. a marketing cohort name), not a status
 * value, and will violate the status CHECK constraint (or worse, silently
 * store garbage if the constraint doesn't cover the value). Kept for
 * history/reference only.
 *
 * ── REAL COLUMN MAPPING (verified against worker/fixtures/uscreen-people-export.csv,
 *    the 2025-10-07 "active customers" export, 518 rows) ──────────────────────
 *
 *   CSV column               → target
 *   ─────────────────────────────────────────────────────────────────────────
 *   User ID                  → people.external_id + subscriptions.external_id
 *                              (upsert KEY USED: external_id — present on every
 *                              row, so the email fallback of PRD §4c is unused)
 *   User Name                → people.full_name
 *   User email               → people.email (lowercase + trim)
 *   Lifetime                 → raw only (lifetime spend; unit/currency unverified)
 *   Segment                  → raw + subscription status fallback ('active' in fixture)
 *   Status                   → raw only (empty in the fixture)
 *   Subscription Plan        → subscriptions.plan_title (verbatim; plan linking
 *                              happens once `plans` are exported)
 *   Created on date          → people.signup_at
 *   Next invoice date        → subscriptions.current_period_end
 *   Subscription Created at  → subscriptions.started_at
 *   Canceled at              → subscriptions.canceled_at (presence ⇒ status 'canceled')
 *   Churned at date          → subscriptions.churned_at (presence ⇒ status 'churned')
 *   User Field 1..3          → raw only
 *   UTM Source/Medium/Term/Content/Campaign, Referrer → raw only
 *
 *   Dates are 'YYYY-MM-DD HH:mm:ss' with no zone marker — stored as
 *   '<date>T<time>Z' (assumed UTC; flag for Phase 0 verification, we never guess
 *   silently: the assumption is recorded here and in the row's raw copy).
 *
 * Fail-honest: rows with an invalid email are SKIPPED and listed in the
 * summary — never imported with a guessed/blank email.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvRecords } from './lib/csv.ts';
import { normalizeEmail, isValidEmail } from './lib/email.ts';
import { createDb, type Db, type DbRow } from './lib/db.ts';

const SOURCE = 'uscreen';

export interface ImportPeopleSummary {
  csvRows: number;
  peopleUpserted: number;
  subscriptionsUpserted: number;
  peopleTotal: number; // count(*) in the target after the run — idempotency number
  subscriptionsTotal: number;
  skippedInvalidEmail: { external_id: string; email: string }[];
  skippedDuplicateId: string[]; // same User ID twice in one file (last kept? no — first kept, rest listed)
  duplicateEmails: { email: string; external_ids: string[] }[]; // same email under ≠ IDs — imported, but flagged (people.email is unique in SQL)
  keyUsed: 'external_id';
}

/** 'YYYY-MM-DD HH:mm:ss' (Uscreen export, zone-less) → ISO-8601 UTC, or null. */
function toIso(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(v);
  if (m) return `${m[1]}T${m[2]}Z`; // assumed UTC — see header comment
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function importPeople(csvPath: string, db: Db): Promise<ImportPeopleSummary> {
  const records = parseCsvRecords(fs.readFileSync(csvPath, 'utf8'));

  const summary: ImportPeopleSummary = {
    csvRows: records.length,
    peopleUpserted: 0,
    subscriptionsUpserted: 0,
    peopleTotal: 0,
    subscriptionsTotal: 0,
    skippedInvalidEmail: [],
    skippedDuplicateId: [],
    duplicateEmails: [],
    keyUsed: 'external_id',
  };

  const people: DbRow[] = [];
  const subscriptions: DbRow[] = [];
  const seenIds = new Set<string>();
  const emailToIds = new Map<string, string[]>();

  for (const rec of records) {
    const externalId = rec['User ID']?.trim() ?? '';
    const email = normalizeEmail(rec['User email'] ?? '');

    if (!externalId) {
      // No ID → would need the email-fallback key; fixture never hits this. Fail honest.
      summary.skippedInvalidEmail.push({ external_id: '(missing User ID)', email });
      continue;
    }
    if (seenIds.has(externalId)) {
      summary.skippedDuplicateId.push(externalId);
      continue;
    }
    if (!isValidEmail(email)) {
      summary.skippedInvalidEmail.push({ external_id: externalId, email });
      continue;
    }
    seenIds.add(externalId);
    emailToIds.set(email, [...(emailToIds.get(email) ?? []), externalId]);

    people.push({
      source: SOURCE,
      external_id: externalId,
      email,
      full_name: rec['User Name']?.trim() || null,
      signup_at: toIso(rec['Created on date'] ?? ''),
      raw: rec, // untouched CSV row, always (PRD §5)
    });

    const canceledAt = toIso(rec['Canceled at'] ?? '');
    const churnedAt = toIso(rec['Churned at date'] ?? '');
    const status = churnedAt ? 'churned' : canceledAt ? 'canceled' : (rec['Segment']?.trim() || 'active');
    subscriptions.push({
      source: SOURCE,
      external_id: externalId, // People export has no subscription id → person User ID (documented KEY choice)
      plan_title: rec['Subscription Plan']?.trim() || null,
      status,
      started_at: toIso(rec['Subscription Created at'] ?? ''),
      current_period_end: toIso(rec['Next invoice date'] ?? ''),
      canceled_at: canceledAt,
      churned_at: churnedAt,
      raw: rec,
    });
  }

  for (const [email, ids] of emailToIds) {
    if (ids.length > 1) summary.duplicateEmails.push({ email, external_ids: ids });
  }

  const p = await db.upsert('people', people);
  const s = await db.upsert('subscriptions', subscriptions);
  await db.flush();

  summary.peopleUpserted = p.inserted + p.updated;
  summary.subscriptionsUpserted = s.inserted + s.updated;
  summary.peopleTotal = await db.count('people');
  summary.subscriptionsTotal = await db.count('subscriptions');
  return summary;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const csvPath =
    process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'uscreen-people-export.csv');
  const db = createDb();
  importPeople(csvPath, db).then((s) => {
    console.log(`people import (${db.driver}) — ${csvPath}`);
    console.log(JSON.stringify(s, null, 2));
    if (s.skippedInvalidEmail.length > 0 || s.skippedDuplicateId.length > 0) process.exitCode = 2; // loud, not silent
  });
}
