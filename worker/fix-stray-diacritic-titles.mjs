/**
 * One-off data-hygiene fix: 4 collection titles carry a single stray Arabic
 * combining diacritic (KASRA U+0650 / DAMMA U+064F) glued onto an otherwise
 * English title — a Uscreen scrape/copy-paste artifact, not real content.
 * Found via a full-catalog scan: 686 collections, 595 have an "(AR)" English
 * gloss marker, 21 have genuine Arabic-script titles (17 of those are
 * correctly Arabic-only series — nothing to fix) and exactly these 4 have
 * the stray-mark bug. IDs are hardcoded (not a live regex sweep) so this
 * never touches a title it wasn't specifically reviewed against.
 *
 * Run: node fix-stray-diacritic-titles.mjs           (dry-run, default)
 *      node fix-stray-diacritic-titles.mjs --execute  (writes)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const EXECUTE = process.argv.includes('--execute');

const FIXES = [
  { id: '8179b43f-f18b-450d-8d75-8f68bb4b07d1', expect: 'ِAnasheed Rowdah Adnan | (AR)' },
  { id: 'a10c12a0-b769-4c3d-8145-6e91f372525a', expect: 'Khalid ibn el-Walid | (ُEN)' },
  { id: '8392e2c1-f932-4a89-8679-d75b61a9019d', expect: 'Math and Science ِAnasheed | (AR)' },
  { id: '158b0d0a-d0d7-48b7-8426-31d66f21dd19', expect: 'Nour and the Super Adventures | (ِAR)' },
];

// Strip Arabic combining marks (Unicode category Mn in the Arabic block) only.
const stripStrayMarks = (s) => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g, '');

async function main() {
  for (const { id, expect } of FIXES) {
    const { data: row, error } = await sb.from('collections').select('id, title').eq('id', id).single();
    if (error) { console.error(`  ${id}: FETCH ERROR ${error.message}`); continue; }
    if (row.title !== expect) {
      console.error(`  ${id}: SKIP — title changed since discovery. expected ${JSON.stringify(expect)}, found ${JSON.stringify(row.title)}`);
      continue;
    }
    const clean = stripStrayMarks(row.title).replace(/\s+/g, ' ').trim();
    console.log(`  ${id}: ${JSON.stringify(row.title)} -> ${JSON.stringify(clean)}`);
    if (EXECUTE) {
      const { error: updErr } = await sb.from('collections').update({ title: clean }).eq('id', id);
      if (updErr) console.error(`    WRITE ERROR: ${updErr.message}`);
    }
  }
  console.log(EXECUTE ? 'DONE (executed)' : 'DRY-RUN — pass --execute to write');
}

main();
