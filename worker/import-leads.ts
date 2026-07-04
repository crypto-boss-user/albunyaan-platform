/**
 * Leads importer — PRD §3 (2,867 leads) + §4c.
 *
 * The real Uscreen leads export is NOT on disk yet (PRD §9 Q6: shape
 * unverified). This importer therefore detects columns by header name and
 * records which upsert key it used, per PRD §4c:
 *
 *   id column     one of: Lead ID | User ID | ID            → external_id (keyUsed 'external_id')
 *                 absent → normalized email is the key       (keyUsed 'email')
 *   email column  one of: Email | User email | E-mail        → leads.email (lowercase+trim; REQUIRED)
 *   name column   one of: Name | User Name | Full Name       → leads.full_name
 *   date column   one of: Created on date | Captured at | Created at | Date → leads.captured_at
 *   source/tag    one of: Source | Tag | Lead source         → leads.source_tag (winback segmentation)
 *   UTM *         any header starting with 'UTM'             → leads.utm jsonb
 *   everything    → raw jsonb, untouched
 *
 * worker/fixtures/leads.sample.csv is a SYNTHETIC fixture in that expected
 * shape (no real lead data exists locally) — swap in the real export when
 * Phase 0 provides it; the header detection above is the flexibility budget.
 *
 * Fail-honest: invalid/missing emails are skipped and listed, never guessed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvRecords } from './lib/csv.ts';
import { normalizeEmail, isValidEmail } from './lib/email.ts';
import { createDb, type Db, type DbRow } from './lib/db.ts';

const SOURCE = 'uscreen';

const ID_HEADERS = ['Lead ID', 'User ID', 'ID'];
const EMAIL_HEADERS = ['Email', 'User email', 'E-mail'];
const NAME_HEADERS = ['Name', 'User Name', 'Full Name'];
const DATE_HEADERS = ['Created on date', 'Captured at', 'Created at', 'Date'];
const SOURCE_HEADERS = ['Source', 'Tag', 'Lead source'];

export interface ImportLeadsSummary {
  csvRows: number;
  leadsUpserted: number;
  leadsTotal: number;
  skippedInvalidEmail: string[];
  skippedDuplicate: string[]; // duplicate key within one file (first kept)
  keyUsed: 'external_id' | 'email';
}

function pick(rec: Record<string, string>, candidates: string[]): string | null {
  for (const c of candidates) {
    const hit = Object.keys(rec).find((h) => h.toLowerCase() === c.toLowerCase());
    if (hit && rec[hit].trim()) return rec[hit].trim();
  }
  return null;
}

function toIso(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?$/.exec(value.trim());
  if (m) return `${m[1]}T${m[2] ?? '00:00:00'}Z`; // zone-less export assumed UTC (same caveat as people)
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function importLeads(csvPath: string, db: Db): Promise<ImportLeadsSummary> {
  const records = parseCsvRecords(fs.readFileSync(csvPath, 'utf8'));
  const hasIdColumn = records.length > 0 && ID_HEADERS.some((h) => h.toLowerCase() in lowerKeys(records[0]));

  const summary: ImportLeadsSummary = {
    csvRows: records.length,
    leadsUpserted: 0,
    leadsTotal: 0,
    skippedInvalidEmail: [],
    skippedDuplicate: [],
    keyUsed: hasIdColumn ? 'external_id' : 'email',
  };

  const leads: DbRow[] = [];
  const seen = new Set<string>();

  for (const rec of records) {
    const email = normalizeEmail(pick(rec, EMAIL_HEADERS) ?? '');
    if (!isValidEmail(email)) {
      summary.skippedInvalidEmail.push(email || '(empty)');
      continue;
    }
    const externalId = hasIdColumn ? pick(rec, ID_HEADERS) : email;
    if (!externalId) {
      summary.skippedInvalidEmail.push(`${email} (blank id cell)`);
      continue;
    }
    if (seen.has(externalId)) {
      summary.skippedDuplicate.push(externalId);
      continue;
    }
    seen.add(externalId);

    const utm: Record<string, string> = {};
    for (const [h, v] of Object.entries(rec)) {
      if (h.toLowerCase().startsWith('utm') && v.trim()) utm[h] = v.trim();
    }

    leads.push({
      source: SOURCE,
      external_id: externalId,
      email,
      full_name: pick(rec, NAME_HEADERS),
      captured_at: toIso(pick(rec, DATE_HEADERS)),
      source_tag: pick(rec, SOURCE_HEADERS),
      utm,
      raw: rec,
    });
  }

  const r = await db.upsert('leads', leads);
  await db.flush();
  summary.leadsUpserted = r.inserted + r.updated;
  summary.leadsTotal = await db.count('leads');
  return summary;
}

function lowerKeys(rec: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(rec).map(([k, v]) => [k.toLowerCase(), v]));
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const csvPath =
    process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'leads.sample.csv');
  const db = createDb();
  importLeads(csvPath, db).then((s) => {
    console.log(`leads import (${db.driver}) — ${csvPath}`);
    console.log(JSON.stringify(s, null, 2));
    if (s.skippedInvalidEmail.length > 0) process.exitCode = 2;
  });
}
