/**
 * AD 1.3 (founder 2026-09-06 (c)): de twee gemeten Uscreen custom filters als data in de DB (tabellen filters/filter_values, 0001).
 * Bron: reference/admin-2026-09/AD0-inventaris.md §2.1 "Custom filters" (2 filters, 4 + 10 opties). Idempotent: upsert op
 * (source, external_id); bestaande rijen worden niet verwijderd. Run: set -a; source ~/.albunyaan-cc/cloud.env; set +a; node worker/seed-custom-filters.mjs
 * Sequentieel CLI-script zonder parallelle workers (geen spawnSync, geen npx).
 */
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ontbreken (cloud.env)'); process.exit(2); }
const db = createClient(url, key, { auth: { persistSession: false } });
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const FILTERS = [
  { name: 'Type', values: ['Series - مسلسلات', 'Movies - أفلام', 'Apps - تطبيقات', 'Live - بث مباشر'] },
  { name: 'Subject', values: ['Creed - العقيدة', "Qor'aan - القرآن", 'Fiqh - الفقه', 'Biography - السيرة', 'Doaa & adkhaar - الأدعية والأذكار', 'Arabic language - اللغة العربية', 'Entertainment - الترفيه', 'Anasheed - أناشيد', 'Other - متفرقات', 'History - التاريخ'] },
];
let f = 0, v = 0;
for (const [i, filter] of FILTERS.entries()) {
  const fs = slug(filter.name);
  const { data: frow, error } = await db.from('filters').upsert({ external_id: `ad0:${fs}`, source: 'uscreen', name: filter.name, slug: fs, raw: { bron: 'AD0-inventaris 2026-09-06', volgorde: i + 1 } }, { onConflict: 'source,external_id' }).select('id').single();
  if (error) { console.error('filters', filter.name, error.message); process.exit(1); }
  f++;
  for (const [j, value] of filter.values.entries()) {
    const vs = slug(value.split(' - ')[0]);
    const { error: e2 } = await db.from('filter_values').upsert({ external_id: `ad0:${fs}:${vs}`, source: 'uscreen', filter_id: frow.id, value, slug: vs, raw: { volgorde: j + 1 } }, { onConflict: 'source,external_id' });
    if (e2) { console.error('filter_values', value, e2.message); process.exit(1); }
    v++;
  }
}
const { count: fc } = await db.from('filters').select('id', { count: 'exact', head: true });
const { count: vc } = await db.from('filter_values').select('id', { count: 'exact', head: true });
console.log(`upserts: ${f} filters, ${v} waarden | in DB: ${fc} filters, ${vc} waarden`);
