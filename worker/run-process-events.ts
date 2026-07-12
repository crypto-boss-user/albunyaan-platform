/**
 * CLI runner for worker/lib/process-events.ts (the library has no CLI on
 * purpose — PRD §6 "store first, interpret later").
 *
 * Fetches `uscreen_events` rows with status='stored' (oldest first), feeds
 * them through processEvents() — which applies signup/payment/cancellation
 * onto people/subscriptions and writes each row's final status back
 * ('processed' | 'unhandled' | 'failed') keyed on delivery_id — and prints a
 * summary.
 *
 * Flags:
 *   --reprocess-unhandled   first reset status='unhandled' rows to 'stored'
 *                           and replay them (otherwise they are a permanent
 *                           dead end — useful after normalizeEventType learns
 *                           a new Uscreen event name)
 *   --limit N               process at most N events this run
 *
 * Env (source ~/.albunyaan-cc/cloud.env): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Exit code 1 if any event ends 'failed'.
 *
 * Run:
 *   set -a; . ~/.albunyaan-cc/cloud.env; set +a
 *   node_modules/.bin/tsx worker/run-process-events.ts [--reprocess-unhandled] [--limit 500]
 */
import { createDb } from './lib/db.ts';
import { processEvents, type UscreenEventInput } from './lib/process-events.ts';

const REPROCESS_UNHANDLED = process.argv.includes('--reprocess-unhandled');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx > -1 ? Number.parseInt(process.argv[limitIdx + 1] ?? '', 10) : Infinity;
if (limitIdx > -1 && (!Number.isFinite(LIMIT) || LIMIT < 1)) {
  console.error('run-process-events: --limit needs a positive integer, e.g. --limit 500');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'run-process-events: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.\n' +
      'Source ~/.albunyaan-cc/cloud.env (set -a; . ~/.albunyaan-cc/cloud.env; set +a) and rerun.',
  );
  process.exit(1);
}

interface StoredEventRow {
  delivery_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  received_at: string;
}

async function main(): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl!, supabaseServiceKey!, { auth: { persistSession: false } });

  if (REPROCESS_UNHANDLED) {
    const { data, error } = await sb
      .from('uscreen_events')
      .update({ status: 'stored', processed_at: null })
      .eq('status', 'unhandled')
      .select('delivery_id');
    if (error) throw new Error(`reset unhandled → stored: ${error.message}`);
    console.log(`reprocess-unhandled: reset ${data?.length ?? 0} rows to 'stored'`);
  }

  // Fetch ALL 'stored' rows oldest-first BEFORE processing (statuses change
  // mid-run, so paginating during processing would skip rows). 1000/page —
  // Supabase REST silently clamps larger ranges.
  const events: UscreenEventInput[] = [];
  const PAGE = 1000;
  for (let from = 0; events.length < LIMIT; from += PAGE) {
    const { data, error } = await sb
      .from('uscreen_events')
      .select('delivery_id, event_type, payload, received_at')
      .eq('status', 'stored')
      .order('received_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`fetch stored events page @${from}: ${error.message}`);
    for (const row of (data ?? []) as StoredEventRow[]) {
      if (events.length >= LIMIT) break;
      events.push({
        delivery_id: row.delivery_id,
        event_type: row.event_type,
        payload: row.payload,
        received_at: row.received_at, // preserved — the library keeps it on the row it writes back
      });
    }
    if (!data || data.length < PAGE) break;
  }

  const db = createDb({ driver: 'supabase' }); // interpret onto people/subscriptions in the cloud
  const summary = await processEvents(events, db);

  // Oldest event still waiting after this run (limit hit, or failed rows left behind).
  const { data: oldest, error: oldestErr } = await sb
    .from('uscreen_events')
    .select('received_at')
    .eq('status', 'stored')
    .order('received_at', { ascending: true })
    .limit(1);
  if (oldestErr) throw new Error(`oldest-unprocessed check: ${oldestErr.message}`);
  const oldestAge = oldest?.[0]
    ? `${((Date.now() - new Date(oldest[0].received_at).getTime()) / 3_600_000).toFixed(1)}h (${oldest[0].received_at})`
    : 'none';

  for (const f of summary.failed) console.error(`  ✗ failed ${f.delivery_id}: ${f.error}`);
  console.log(
    `run-process-events: fetched=${summary.received} processed=${summary.processed} ` +
      `unhandled=${summary.unhandled} duplicates=${summary.duplicates} failed=${summary.failed.length} ` +
      `| oldest unprocessed: ${oldestAge}`,
  );
  if (summary.failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('run-process-events failed:', err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
