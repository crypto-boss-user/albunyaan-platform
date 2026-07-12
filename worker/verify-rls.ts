/**
 * verify-rls.ts — RLS / grant matrix harness for migrations 0001–0008.
 *
 * Runs the same checks against ANY Supabase project (local stack or cloud):
 *
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     npx tsx verify-rls.ts [--no-members]
 *
 * Checks:
 *   a. anon reads videos (explicit safe columns — column grants make select=*
 *      fail by design) and sees ONLY status published/live; protected columns
 *      (raw, uscreen_hls_url, live_stream_url) error with permission denied.
 *   b. anon gets zero rows (or an error) on every closed table.
 *   c. anon cannot INSERT (spot-checked on videos, leads, watch_progress).
 *   d. service role still reads every table.
 *   e. member A cannot read member B's people/entitlements rows.
 *      Needs TEST_USER_A_EMAIL/TEST_USER_A_PASSWORD + same for B (existing
 *      confirmed auth users). Skip with --no-members while no test users exist.
 *
 * Exit code 1 on any FAIL. Summary table at the end.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error('need SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(2);
}
const noMembers = process.argv.includes('--no-members');

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const service = createClient(url, serviceKey, { auth: { persistSession: false } });

// Every table the migrations create — service role must read all of them (check d).
const ALL_TABLES = [
  'videos', 'categories', 'collections', 'collection_items',
  'filters', 'filter_values', 'video_filter_values',
  'authors', 'video_authors', 'video_categories',
  'people', 'plans', 'subscriptions', 'leads',
  'uscreen_events', 'export_manifest',
  'households', 'profiles', 'content_overrides',
  'platform_admins', 'entitlements', 'vouchers', 'voucher_redemptions',
  'voucher_attempts', 'stripe_events', 'watch_progress',
  'admin_audit_log', 'billing_migration_batches', 'billing_migration_items',
];

// Tables that must stay invisible to anon (zero rows or error) — check b.
const CLOSED_TO_ANON = [
  'people', 'entitlements', 'vouchers', 'uscreen_events', 'stripe_events',
  'subscriptions', 'leads', 'export_manifest', 'platform_admins',
  'admin_audit_log', 'billing_migration_batches',
];

// The exact column list granted to anon/authenticated in 0006.
const VIDEO_SAFE_COLUMNS =
  'id,external_id,source,title,slug,short_description,description,' +
  'thumbnail_url,thumbnail_hue,duration_seconds,status,publish_at,access,' +
  'age_rating,bunny_video_id,seo,resources,subtitle_tracks,audio_tracks,' +
  'created_at,updated_at';

const VIDEO_PROTECTED_COLUMNS = ['raw', 'uscreen_video_url', 'uscreen_hls_url', 'live_stream_url', 'live_provider'];

interface CheckResult {
  check: string;
  pass: boolean;
  detail: string;
}
const results: CheckResult[] = [];

function record(check: string, pass: boolean, detail: string) {
  results.push({ check, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${check} — ${detail}`);
}

// ── a. anon catalog surface ──────────────────────────────────────────────────

async function checkAnonVideos() {
  const { data, error } = await anon.from('videos').select(VIDEO_SAFE_COLUMNS).limit(1000);
  if (error) {
    record('a1 anon selects safe video columns', false, `unexpected error: ${error.message}`);
    return;
  }
  const bad = (data ?? []).filter((r: any) => r.status !== 'published' && r.status !== 'live');
  if (bad.length > 0) {
    record('a1 anon selects safe video columns', false,
      `${bad.length} non-published/live row(s) leaked (e.g. status='${(bad[0] as any).status}')`);
  } else {
    // Strengthen: does the db actually CONTAIN hidden rows the filter is hiding?
    const { count: total } = await service.from('videos').select('*', { count: 'exact', head: true });
    const hidden = (total ?? 0) - (data?.length ?? 0);
    const note = (total ?? 0) === 0
      ? 'table empty — row filter not exercised'
      : hidden > 0
        ? `${data?.length ?? 0} visible, ${hidden} hidden — filter exercised`
        : `${data?.length ?? 0} rows, all published/live`;
    record('a1 anon selects safe video columns', true, note);
  }
}

async function checkAnonProtectedColumns() {
  for (const col of VIDEO_PROTECTED_COLUMNS) {
    const { error } = await anon.from('videos').select(col).limit(1);
    record(`a2 anon blocked from videos.${col}`, !!error,
      error ? `denied (${error.code ?? error.message})` : 'column was readable — grant leak!');
  }
}

// ── b. anon sees nothing on closed tables ────────────────────────────────────

async function checkAnonClosedTables() {
  for (const table of CLOSED_TO_ANON) {
    const { data, error } = await anon.from(table).select('*').limit(1);
    if (error) {
      record(`b anon closed: ${table}`, true, `denied (${error.code ?? error.message})`);
    } else {
      const rows = data?.length ?? 0;
      record(`b anon closed: ${table}`, rows === 0, rows === 0 ? 'zero rows' : `${rows} row(s) leaked!`);
    }
  }
}

// ── c. anon cannot INSERT ────────────────────────────────────────────────────

async function checkAnonInserts() {
  const attempts: Array<[string, Record<string, unknown>]> = [
    ['videos', { external_id: 'rls-verify-x', title: 'x', slug: `rls-verify-${Date.now()}` }],
    ['leads', { external_id: 'rls-verify-x', email: `rls-verify-${Date.now()}@example.com` }],
    ['watch_progress', { profile_id: crypto.randomUUID(), video_id: crypto.randomUUID() }],
  ];
  for (const [table, row] of attempts) {
    const { error } = await anon.from(table).insert(row);
    record(`c anon insert blocked: ${table}`, !!error,
      error ? `denied (${error.code ?? error.message})` : 'INSERT SUCCEEDED — open write!');
    if (!error) await service.from(table).delete().match(row as any); // clean up the leak evidence
  }
}

// ── d. service role reads everything ────────────────────────────────────────

async function checkServiceReads() {
  const failures: string[] = [];
  for (const table of ALL_TABLES) {
    const { error } = await service.from(table).select('*', { count: 'exact', head: true });
    if (error) failures.push(`${table} (${error.message})`);
  }
  record('d service role reads all tables', failures.length === 0,
    failures.length === 0 ? `${ALL_TABLES.length} tables readable` : `failed: ${failures.join(', ')}`);
}

// ── e. member isolation (optional) ───────────────────────────────────────────

async function signIn(label: string, email: string, password: string): Promise<SupabaseClient | null> {
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    record(`e sign-in ${label}`, false, error.message);
    return null;
  }
  return client;
}

async function checkMemberIsolation() {
  const aEmail = process.env.TEST_USER_A_EMAIL;
  const aPass = process.env.TEST_USER_A_PASSWORD;
  const bEmail = process.env.TEST_USER_B_EMAIL;
  const bPass = process.env.TEST_USER_B_PASSWORD;
  if (!aEmail || !aPass || !bEmail || !bPass) {
    record('e member isolation', false,
      'TEST_USER_A/B_EMAIL+PASSWORD not set — create test users or pass --no-members');
    return;
  }
  const clientA = await signIn('A', aEmail, aPass);
  const clientB = await signIn('B', bEmail, bPass);
  if (!clientA || !clientB) return;
  const uidA = (await clientA.auth.getUser()).data.user!.id;
  const uidB = (await clientB.auth.getUser()).data.user!.id;

  // A's people view must contain only A's own row(s), never B's.
  const { data: peopleA, error: pErr } = await clientA.from('people').select('id,auth_user_id');
  if (pErr) {
    record('e A reads own people', false, pErr.message);
    return;
  }
  const foreign = (peopleA ?? []).filter((r: any) => r.auth_user_id !== uidA);
  record('e A sees only own people row', foreign.length === 0,
    foreign.length === 0 ? `${peopleA?.length ?? 0} row(s), all self` : `${foreign.length} foreign row(s) leaked!`);

  // A's entitlements must all belong to A's person id (resolved via service role).
  const { data: personB } = await service.from('people').select('id').eq('auth_user_id', uidB).maybeSingle();
  const { data: entA, error: eErr } = await clientA.from('entitlements').select('id,person_id');
  if (eErr) {
    record('e A reads own entitlements', false, eErr.message);
    return;
  }
  const { data: personA } = await service.from('people').select('id').eq('auth_user_id', uidA).maybeSingle();
  const leakedEnt = (entA ?? []).filter(
    (r: any) => r.person_id !== personA?.id || (personB && r.person_id === personB.id),
  );
  record('e A sees only own entitlements', leakedEnt.length === 0,
    leakedEnt.length === 0 ? `${entA?.length ?? 0} row(s), all self` : `${leakedEnt.length} foreign row(s) leaked!`);
}

// ── run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`verify-rls against ${url}${noMembers ? '  (--no-members)' : ''}\n`);

  await checkAnonVideos();
  await checkAnonProtectedColumns();
  await checkAnonClosedTables();
  await checkAnonInserts();
  await checkServiceReads();
  if (noMembers) {
    console.log('SKIP  e member isolation — --no-members');
  } else {
    await checkMemberIsolation();
  }

  const failed = results.filter((r) => !r.pass);
  const width = Math.max(...results.map((r) => r.check.length));
  console.log('\n── summary ' + '─'.repeat(Math.max(1, width + 40 - 11)));
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.check.padEnd(width)}  ${r.detail}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} checks passed` +
    (noMembers ? ' (member checks skipped)' : ''));

  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('verify-rls crashed:', err);
  process.exit(1);
});
