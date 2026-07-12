/**
 * People-only importer for the FRESH Uscreen "People" CSV export
 * (worker/fixtures/uscreen-people-export.csv, replaced 2026-07-12 — 2,926 rows,
 * superseding the stale 2025-10-07 / 518-row fixture).
 *
 * Scope is deliberately narrow: this script upserts ONLY the `people` table.
 * worker/import-people.ts already exists and additionally upserts
 * `subscriptions` from the same export — it was NOT touched or run here
 * (out of scope for this task). Note for whoever picks that up next: its
 * subscription-status fallback (`rec['Segment']?.trim() || 'active'`) will
 * feed values like 'lead' straight into `subscriptions.status`, which fails
 * the table's CHECK constraint — a preexisting bug, unrelated to this file.
 *
 * ── COLUMN MAPPING (verified against the 2026-07-12 export, header includes
 *    Tags / Email Marketing & News Opt-In / Creation Source / Lead Source,
 *    which the 2025-10-07 fixture did not have) ───────────────────────────
 *
 *   CSV column      → target
 *   ─────────────────────────────────────────────────────────────────────
 *   User ID         → people.external_id  (upsert KEY, with source='uscreen';
 *                      present + unique on every row of this export — no
 *                      email-fallback key needed)
 *   User email      → people.email (lowercase + trim)
 *   User Name       → people.full_name
 *   Created on date → people.signup_at
 *   (everything)    → people.raw — the untouched CSV row, always. This is
 *                      the ONLY place Lifetime / Segment / Status /
 *                      Subscription Plan / Tags / Next invoice date /
 *                      Subscription Created at / Canceled at / Churned at
 *                      date / Email Marketing & News Opt-In / Creation
 *                      Source / Lead Source / User Field 1-3 / UTM* /
 *                      Referrer land — none of those have a dedicated
 *                      `people` column, and none of it is discarded.
 *
 *   NOT written (left alone on both insert and update, so this importer can
 *   never clobber a value another process owns):
 *     language            — DB default 'en' stands; CSV has no language column
 *     stripe_customer_id  — owned by worker/stripe-audit.ts --backfill
 *     legacy_cohort        — Phase 9 cohort classification, out of scope here
 *     auth_user_id         — owned by the 0003 signup trigger
 *
 * Dates are 'YYYY-MM-DD HH:mm:ss' with no zone marker — stored as
 * '<date>T<time>Z' (assumed UTC, same assumption as import-people.ts).
 *
 * Idempotent: upsert on (source, external_id) — the schema's unique
 * constraint (0001). Re-running with the same CSV is a no-op after the
 * first run. NEVER deletes: rows whose external_id is absent from this CSV
 * (there are none as of 2026-07-12 — every row currently in the cloud
 * `people` table has an external_id present in this export) are simply not
 * touched.
 *
 * Batched (500 rows/request) against the supabase driver so one bad row
 * can't sink the whole 2,926-row run in a single oversized statement, and
 * so a partial failure is easy to locate from the printed progress.
 *
 * Fail-honest: rows with a missing/invalid email or a duplicate User ID
 * within the file are SKIPPED and listed in the summary — never imported
 * with a guessed/blank email. (The 2026-07-12 export has zero of either.)
 *
 * Run (cloud/production — the ONLY driver this script supports):
 *   set -a; . ~/.albunyaan-cc/cloud.env; set +a
 *   worker/node_modules/.bin/tsx worker/import-people-csv.ts [csvPath]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvRecords } from './lib/csv.ts';
import { normalizeEmail, isValidEmail } from './lib/email.ts';
import { createDb, type Db, type DbRow } from './lib/db.ts';

const SOURCE = 'uscreen';
const BATCH_SIZE = 500;

export interface ImportPeopleCsvSummary {
  csvRows: number;
  peopleUpserted: number;
  peopleTotal: number; // count(*) in the target after the run — idempotency number
  skippedInvalidEmail: { external_id: string; email: string }[];
  skippedDuplicateId: string[];
  duplicateEmails: { email: string; external_ids: string[] }[]; // people.email is unique in SQL — a real dupe here would fail the batch
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

export async function importPeopleCsv(csvPath: string, db: Db): Promise<ImportPeopleCsvSummary> {
  const records = parseCsvRecords(fs.readFileSync(csvPath, 'utf8'));

  const summary: ImportPeopleCsvSummary = {
    csvRows: records.length,
    peopleUpserted: 0,
    peopleTotal: 0,
    skippedInvalidEmail: [],
    skippedDuplicateId: [],
    duplicateEmails: [],
    keyUsed: 'external_id',
  };

  const people: DbRow[] = [];
  const seenIds = new Set<string>();
  const emailToIds = new Map<string, string[]>();

  for (const rec of records) {
    const externalId = rec['User ID']?.trim() ?? '';
    const email = normalizeEmail(rec['User email'] ?? '');

    if (!externalId) {
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
      raw: rec, // untouched CSV row, always
    });
  }

  for (const [email, ids] of emailToIds) {
    if (ids.length > 1) summary.duplicateEmails.push({ email, external_ids: ids });
  }

  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < people.length; i += BATCH_SIZE) {
    const batch = people.slice(i, i + BATCH_SIZE);
    const r = await db.upsert('people', batch);
    inserted += r.inserted;
    updated += r.updated;
    console.log(`  batch ${i / BATCH_SIZE + 1}: rows ${i + 1}-${i + batch.length} of ${people.length} upserted`);
  }
  await db.flush();

  summary.peopleUpserted = inserted + updated;
  summary.peopleTotal = await db.count('people');
  return summary;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const csvPath =
    process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'uscreen-people-export.csv');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      'import-people-csv: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.\n' +
        'Source ~/.albunyaan-cc/cloud.env first:  set -a; . ~/.albunyaan-cc/cloud.env; set +a',
    );
    process.exit(1);
  }
  const db = createDb({ driver: 'supabase' });
  importPeopleCsv(csvPath, db).then((s) => {
    console.log(`people-csv import (${db.driver}) — ${csvPath}`);
    console.log(JSON.stringify(s, null, 2));
    if (s.skippedInvalidEmail.length > 0 || s.skippedDuplicateId.length > 0 || s.duplicateEmails.length > 0) {
      process.exitCode = 2; // loud, not silent
    }
  });
}
