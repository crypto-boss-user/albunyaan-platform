import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from '../lib/db.ts';
import { importPeople } from '../import-people.ts';
import { importLeads } from '../import-leads.ts';

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const PEOPLE_CSV = path.join(FIXTURES, 'uscreen-people-export.csv'); // the REAL 2025-10-07 export
const LEADS_CSV = path.join(FIXTURES, 'leads.sample.csv'); // synthetic (real lead export not on disk yet)

function tmpOut(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase1-out-'));
}

describe('import-people on the real Uscreen People export', () => {
  it('imports every parseable row, people ↔ subscriptions 1:1, all emails normalized', async () => {
    const out = tmpOut();
    const db = createDb({ driver: 'jsonl', outDir: out });
    const s = await importPeople(PEOPLE_CSV, db);

    expect(s.keyUsed).toBe('external_id'); // User ID present on every fixture row
    expect(s.csvRows).toBeGreaterThan(500); // 518 in the 7-oktober export
    // fail-honest bookkeeping: every CSV row is accounted for, none silently dropped
    expect(s.peopleUpserted + s.skippedInvalidEmail.length + s.skippedDuplicateId.length).toBe(s.csvRows);
    expect(s.subscriptionsUpserted).toBe(s.peopleUpserted);
    expect(s.peopleTotal).toBe(s.peopleUpserted);

    const people = fs
      .readFileSync(path.join(out, 'people.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(people).toHaveLength(s.peopleTotal);
    for (const p of people) {
      expect(p.source).toBe('uscreen');
      expect(p.external_id).toMatch(/^\d+$/);
      expect(p.email).toBe(p.email.toLowerCase().trim()); // normalized
      expect(p.raw).toBeTruthy(); // untouched CSV row kept (PRD §5)
    }
  });

  it('is idempotent: a second run produces identical counts and identical bytes', async () => {
    const out = tmpOut();
    const first = await importPeople(PEOPLE_CSV, createDb({ driver: 'jsonl', outDir: out }));
    const bytes1 = fs.readFileSync(path.join(out, 'people.jsonl'), 'utf8');

    // Fresh db instance on the same output = a rerun of the CLI (PRD §7 rerun check).
    const second = await importPeople(PEOPLE_CSV, createDb({ driver: 'jsonl', outDir: out }));
    const bytes2 = fs.readFileSync(path.join(out, 'people.jsonl'), 'utf8');

    expect(second.peopleTotal).toBe(first.peopleTotal);
    expect(second.subscriptionsTotal).toBe(first.subscriptionsTotal);
    expect(second.peopleUpserted).toBe(first.peopleUpserted);
    expect(bytes2).toBe(bytes1); // byte-identical output — no drift on rerun
  });

  it('derives subscription rows with the documented person-User-ID key', async () => {
    const out = tmpOut();
    await importPeople(PEOPLE_CSV, createDb({ driver: 'jsonl', outDir: out }));
    const subs = fs
      .readFileSync(path.join(out, 'subscriptions.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    for (const sub of subs.slice(0, 25)) {
      expect(sub.external_id).toMatch(/^\d+$/); // person User ID (no sub id in the export)
      expect(sub.status).toBeTruthy();
    }
  });
});

describe('import-leads (synthetic fixture — real export shape is PRD §9 Q6)', () => {
  it('normalizes, dedupes and fail-honestly skips invalid emails', async () => {
    const out = tmpOut();
    const s = await importLeads(LEADS_CSV, createDb({ driver: 'jsonl', outDir: out }));
    expect(s.keyUsed).toBe('email'); // sample has no id column → documented fallback
    expect(s.csvRows).toBe(5);
    expect(s.leadsUpserted).toBe(3); // 5 - 1 invalid - 1 duplicate
    expect(s.skippedInvalidEmail).toEqual(['not-an-email']);
    expect(s.skippedDuplicate).toEqual(['ahmed.test@example.org']);

    const leads = fs
      .readFileSync(path.join(out, 'leads.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    const yusuf = leads.find((l) => l.email === 'yusuf.test@example.org');
    expect(yusuf).toBeTruthy(); // '  YUSUF.TEST@EXAMPLE.ORG' (quoted, padded) normalized
    expect(yusuf.utm).toMatchObject({ 'UTM Source': 'facebook' });
  });

  it('is idempotent across reruns', async () => {
    const out = tmpOut();
    const first = await importLeads(LEADS_CSV, createDb({ driver: 'jsonl', outDir: out }));
    const second = await importLeads(LEADS_CSV, createDb({ driver: 'jsonl', outDir: out }));
    expect(second.leadsTotal).toBe(first.leadsTotal);
  });
});
