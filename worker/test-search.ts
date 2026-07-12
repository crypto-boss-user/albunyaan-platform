/**
 * Read-only smoke test for searchCatalog() against the cloud catalog.
 * Run: set -a; source ~/.albunyaan-cc/cloud.env; set +a; pnpm --filter @albunyaan/worker exec tsx test-search.ts
 */
import { searchCatalog } from '@albunyaan/core/data';

const QUERIES = ['Timo', 'نيمو', 'xyzzy-nonsense', 'a'];

for (const q of QUERIES) {
  const r = await searchCatalog(q);
  console.log(`\nQ=${JSON.stringify(q)} → series=${r.series.length} episodes=${r.episodes.length}`);
  for (const s of r.series.slice(0, 3)) console.log(`  [S] ${s.title}  (${s.episodeCount} eps, slug=${s.slug})`);
  for (const v of r.episodes.slice(0, 3)) console.log(`  [E] ${v.title}  (status=${v.status})`);
}
