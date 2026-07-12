/**
 * One-time cloud backfill: sanitize videos.description (scraped Uscreen
 * rich-text HTML) with the same allowlist the web render path uses
 * (@albunyaan/core/sanitize), neutralizing the stored-XSS surface at rest.
 *
 * Safety:
 *   • --dry-run is the DEFAULT: prints would-change count + up to 5
 *     before/after samples (truncated). Pass --apply to actually write.
 *   • Before overwriting a description, the ORIGINAL is preserved into
 *     raw.description_original (videos.raw does not otherwise contain the
 *     description — this becomes the only copy). An existing
 *     description_original is NEVER overwritten, so re-runs cannot destroy
 *     the original.
 *   • Keyset pagination by id (500/page, well under the 1000-row PostgREST
 *     clamp) — resumable and stable under concurrent updates; the script is
 *     idempotent (sanitize(sanitize(x)) === sanitize(x)), so re-running
 *     after an interruption is safe.
 *
 * Usage (env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, e.g. from
 * ~/.albunyaan-cc/cloud.env):
 *   npx tsx sanitize-descriptions.ts            # dry-run (default)
 *   npx tsx sanitize-descriptions.ts --apply    # execute
 */
import { createClient } from '@supabase/supabase-js';
import { sanitizeDescription } from '@albunyaan/core/sanitize';

const PAGE_SIZE = 500;
const SAMPLE_LIMIT = 5;
const TRUNCATE = 220;

const APPLY = process.argv.includes('--apply');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Row = {
  id: string;
  slug: string;
  description: string;
  raw: Record<string, unknown> | null;
};

const trunc = (s: string) =>
  s.length > TRUNCATE ? `${s.slice(0, TRUNCATE)}… (${s.length} chars)` : s;

async function main() {
  console.log(`sanitize-descriptions — mode: ${APPLY ? 'APPLY' : 'DRY-RUN (pass --apply to write)'}`);

  let scanned = 0;
  let changed = 0;
  let skippedUnchanged = 0;
  let lastId: string | null = null;
  const samples: { slug: string; before: string; after: string }[] = [];

  for (;;) {
    let q = db
      .from('videos')
      .select('id, slug, description, raw')
      .not('description', 'is', null)
      .neq('description', '')
      .order('id', { ascending: true })
      .limit(PAGE_SIZE);
    if (lastId) q = q.gt('id', lastId);

    const { data, error } = await q;
    if (error) throw new Error(`page fetch failed after id=${lastId}: ${error.message}`);
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned++;
      const original = row.description;
      const sanitized = sanitizeDescription(original);

      if (sanitized === original) {
        skippedUnchanged++;
      } else {
        changed++;
        if (samples.length < SAMPLE_LIMIT) {
          samples.push({ slug: row.slug, before: trunc(original), after: trunc(sanitized) });
        }
        if (APPLY) {
          const raw: Record<string, unknown> =
            row.raw && typeof row.raw === 'object' ? { ...row.raw } : {};
          // Preserve the one-and-only original copy; never clobber it on re-runs.
          if (!('description_original' in raw)) raw.description_original = original;
          const { error: upErr } = await db
            .from('videos')
            .update({ description: sanitized, raw })
            .eq('id', row.id);
          if (upErr) throw new Error(`update failed for ${row.id} (${row.slug}): ${upErr.message}`);
        }
      }

      if (scanned % 1000 === 0) {
        console.log(`  … scanned ${scanned} (changed ${changed}, unchanged ${skippedUnchanged})`);
      }
    }

    lastId = rows[rows.length - 1].id;
    if (rows.length < PAGE_SIZE) break;
  }

  console.log('\n— samples (before → after) —');
  if (samples.length === 0) console.log('  (no rows would change)');
  for (const s of samples) {
    console.log(`  [${s.slug}]`);
    console.log(`    before: ${s.before}`);
    console.log(`    after:  ${s.after}`);
  }

  console.log('\n— totals —');
  console.log(`  scanned:            ${scanned}`);
  console.log(`  ${APPLY ? 'changed (written)' : 'would change'}:  ${changed}`);
  console.log(`  skipped-unchanged:  ${skippedUnchanged}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
