/**
 * Populate videos.member_visible (migration 0012) from the collection scrapes.
 *
 * Member-facing truth (migration-truth.md, verified 2026-07-21): members watch
 * videos through PUBLISHED COLLECTIONS, not per-video status. member_visible =
 * (video appears in a published collection) OR (status = 'published').
 * Expected true-count: 15,180 of 15,861 (drifts only if the scrapes change).
 *
 * Idempotent: reads current flags, writes only the rows whose flag differs,
 * then re-counts and FAILS LOUDLY (exit 1) if the persisted count does not
 * match the computed set — a supabase-js write can fail without throwing.
 *
 * Sources: ~/.albunyaan-cc/uscreen-collection-status.jsonl (id, status)
 *          ~/.albunyaan-cc/uscreen-collection-members.jsonl (id, videoIds[])
 *
 * Run: cd worker && node_modules/.bin/tsx set-member-visible.ts [--dry]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

for (const line of fs.readFileSync(path.join(os.homedir(), '.albunyaan-cc/cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DRY = process.argv.includes('--dry');
const cc = (f: string) => path.join(os.homedir(), '.albunyaan-cc', f);

function jsonl(file: string): any[] {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

async function main() {
  const published = new Set(
    jsonl(cc('uscreen-collection-status.jsonl')).filter((c) => c.status === 'published').map((c) => String(c.id)),
  );
  const inPublished = new Set<string>();
  for (const c of jsonl(cc('uscreen-collection-members.jsonl'))) {
    if (published.has(String(c.id))) for (const v of c.videoIds ?? []) inPublished.add(String(v));
  }
  console.log(`published collections: ${published.size}; video ids inside them: ${inPublished.size}`);

  // Full catalog, paginated (Supabase REST silently clamps pages to 1000 rows).
  const rows: { id: string; external_id: string; status: string; member_visible: boolean }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('videos').select('id, external_id, status, member_visible')
      .eq('source', 'uscreen').range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  console.log(`catalog rows read: ${rows.length}`);

  const want = (r: { external_id: string; status: string }) =>
    inPublished.has(r.external_id) || r.status === 'published';
  const toTrue = rows.filter((r) => want(r) && !r.member_visible).map((r) => r.id);
  const toFalse = rows.filter((r) => !want(r) && r.member_visible).map((r) => r.id);
  const expected = rows.filter(want).length;
  console.log(`computed member-visible: ${expected}; flips needed: ${toTrue.length} -> true, ${toFalse.length} -> false`);

  if (DRY) { console.log('[dry] no writes'); return; }
  for (const [ids, val] of [[toTrue, true], [toFalse, false]] as const) {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await sb.from('videos').update({ member_visible: val }).in('id', ids.slice(i, i + 200));
      if (error) throw new Error(`update batch failed (${val}): ${error.message}`);
    }
  }

  // Verify persisted count — never trust an errorless write.
  const { count, error: cntErr } = await sb.from('videos')
    .select('id', { count: 'exact', head: true }).eq('source', 'uscreen').eq('member_visible', true);
  if (cntErr) throw cntErr;
  console.log(`persisted member_visible=true: ${count} (expected ${expected})`);
  if (count !== expected) { console.error('MISMATCH — persisted count differs from computed set'); process.exit(1); }
  console.log('OK');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
