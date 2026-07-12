/**
 * Read-only smoke test for searchCatalog() against the cloud catalog.
 * Run: set -a; source ~/.albunyaan-cc/cloud.env; set +a; pnpm --filter @albunyaan/worker exec tsx test-search.ts
 */
import { searchCatalog } from '@albunyaan/core/data';

// 'Seerah' has PUBLISHED episodes on prod → must return series hits.
// 'Timo' exists but is 100% draft episodes on prod → correctly returns 0
// (WS1 visibility: fully-draft series are dropped, a card would 404) — do
// not re-diagnose that as a search bug.
const QUERIES = ['Seerah', 'Timo', 'نيمو', 'xyzzy-nonsense', 'a'];

for (const q of QUERIES) {
  const r = await searchCatalog(q);
  console.log(`\nQ=${JSON.stringify(q)} → series=${r.series.length} episodes=${r.episodes.length}`);
  for (const s of r.series.slice(0, 3)) console.log(`  [S] ${s.title}  (${s.episodeCount} eps, slug=${s.slug})`);
  for (const v of r.episodes.slice(0, 3)) console.log(`  [E] ${v.title}  (status=${v.status})`);
}
