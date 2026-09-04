/**
 * e2e-all.ts — één commando voor de zes bestaande Playwright-harnesses (RV 2, 2026-09-04; B21/B22/B25/B53).
 *
 * Start ze NA ELKAAR met de directe tsx-binary (nooit npx — CLAUDE.md), BASE_URL vast op :3012 (B25; de
 * dev-server op :3010 blijft met rust), leest beide uitvoerconventies zonder de harnesses te herschrijven:
 *   check()  : "  ✓ label" / "  ✗ FAIL: label"  + slotregel "N passed, M failed"   (admin-gate, admin-crud, ws10-pages, playback-gate)
 *   record() : "PASS  check — detail" / "FAIL  …" + slotregel "N/M checks passed"  (member-auth, coupon-redeem)
 * en bundelt exit-codes + duur in één tabel. Exit 1 zodra één harness faalt of niet kon starten (fail-closed).
 *
 * ⛔ e2e-playback-gate.ts test signed Bunny-embeds (BUNNY_EMBED_TOKEN_KEY); Bunny is gestopt (2026-09-02, B22):
 *    standaard OVERGESLAGEN met melding, alleen met --incl-playback.
 *
 * Preflight (non-negotiable 1 — nooit stil doorlopen): SUPABASE_URL moet lokaal zijn (127.0.0.1/localhost),
 * SUPABASE_SERVICE_ROLE_KEY gezet (worker/.env als fallback, alleen ingelezen, nooit afgedrukt), dev-server op
 * BASE_URL antwoordt, Mailpit op MAILPIT_URL antwoordt. Faalt de preflight, dan stopt de runner vóór de eerste
 * harness en meldt welke voorwaarde ontbreekt.
 *
 * Run:   cd worker && node_modules/.bin/tsx e2e-all.ts            (of: pnpm --filter @albunyaan/worker e2e)
 * Flags: --list · --only <naam[,naam]> · --incl-playback · E2E_TIMEOUT_MS (default 300000 = 300 s wall per harness)
 * Exit-codes: 0 alles OK · 1 ≥1 harness gefaald/timeout/niet gestart · 2 argumentfout of niets te draaien · 3 preflight mislukt
 * NB: RV 2 heeft deze runner alleen op --list en op de preflight getest (B53: harnesses vereisen lokale Supabase + Mailpit).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TSX = path.join(HERE, 'node_modules', '.bin', 'tsx');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3012';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT_MS ?? 300_000);

interface Harness { file: string; dekt: string; conventie: 'check' | 'record'; mailpit: boolean; supabase: boolean; anon?: boolean; blocked?: string }
const HARNESSES: Harness[] = [
  { file: 'e2e-admin-gate.ts', dekt: 'WS7 admin-gate (TOTP, aal2, step-up)', conventie: 'check', mailpit: true, supabase: true, anon: true },
  { file: 'e2e-admin-crud.ts', dekt: 'WS7 admin CRUD (videos, vouchers, members)', conventie: 'check', mailpit: true, supabase: true, anon: true },
  { file: 'e2e-member-auth.ts', dekt: 'WS3 member auth (magic link, households, PIN)', conventie: 'record', mailpit: true, supabase: true },
  { file: 'e2e-coupon-redeem.ts', dekt: '/coupon + redeem_voucher() RPC', conventie: 'record', mailpit: true, supabase: true },
  { file: 'e2e-ws10-pages.ts', dekt: 'WS10 terms/privacy/donate/download-app/contact', conventie: 'check', mailpit: false, supabase: false },
  { file: 'e2e-playback-gate.ts', dekt: 'WS5 entitlement gate + signed Bunny-embed', conventie: 'check', mailpit: false, supabase: true, blocked: '⛔ B22: Bunny gestopt 2026-09-02 — alleen met --incl-playback' },
];

const argv = process.argv.slice(2);
const flag = (f: string) => argv.includes(f);
const onlyArg = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : undefined;
if (argv.includes('--only') && (!onlyArg || onlyArg.startsWith('--'))) { console.error('--only vereist een naam (bv. --only ws10-pages,admin-gate)'); process.exit(2); }
const only = onlyArg ? new Set(onlyArg.split(',').map((s) => s.replace(/^e2e-|\.ts$/g, ''))) : null;

if (flag('--list')) {
  for (const h of HARNESSES) console.log(`${h.file.padEnd(24)} ${h.conventie.padEnd(7)} ${h.dekt}${h.blocked ? `   ${h.blocked}` : ''}`);
  process.exit(0);
}

// worker/.env als fallback voor lokale sleutels — alleen NAMEN worden ooit gelogd, nooit waarden.
function loadEnvFallback(): string[] {
  const p = path.join(HERE, '.env');
  if (!fs.existsSync(p)) return [];
  const loaded: string[] = [];
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    loaded.push(m[1]);
  }
  return loaded;
}

async function reachable(url: string): Promise<boolean> {
  try {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 5000);
    const r = await fetch(url, { signal: ac.signal, redirect: 'manual' });
    clearTimeout(t);
    return r.status > 0;
  } catch { return false; }
}

async function preflight(selected: Harness[]): Promise<string[]> {
  const fouten: string[] = [];
  const loaded = loadEnvFallback();
  if (loaded.length) console.log(`preflight: ${loaded.length} variabelen uit worker/.env geladen (${loaded.join(', ')})`);
  if (!fs.existsSync(TSX)) fouten.push(`tsx-binary ontbreekt: ${TSX} (worker/node_modules niet geïnstalleerd?)`);
  const needSupabase = selected.some((h) => h.supabase);
  if (needSupabase) {
    const url = process.env.SUPABASE_URL ?? '';
    if (!url) fouten.push('SUPABASE_URL niet gezet (lokale stack vereist; worker/.env als fallback)');
    else if (!/127\.0\.0\.1|localhost/.test(url)) fouten.push('SUPABASE_URL is niet lokaal — de harnesses weigeren niet-lokale Supabase (zie e2e-admin-gate.ts)');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) fouten.push('SUPABASE_SERVICE_ROLE_KEY niet gezet');
    if (selected.some((h) => h.anon) && !process.env.SUPABASE_ANON_KEY) fouten.push('SUPABASE_ANON_KEY niet gezet (admin-gate/admin-crud vereisen die)');
  }
  if (!(await reachable(BASE_URL))) fouten.push(`dev-server antwoordt niet op ${BASE_URL} (start: cd apps/web && pnpm dev -p 3012)`);
  if (selected.some((h) => h.mailpit) && !(await reachable(MAILPIT_URL))) fouten.push(`Mailpit antwoordt niet op ${MAILPIT_URL}`);
  return fouten;
}

interface Result { file: string; conventie: string; status: 'OK' | 'FAIL' | 'TIMEOUT' | 'OVERGESLAGEN' | 'NIET GESTART'; exit: number | null; ok: number; fail: number; slot: string; ms: number }

function tel(out: string, conventie: Harness['conventie']): { ok: number; fail: number; slot: string } {
  const lines = out.split('\n');
  const slot = [...lines].reverse().find((l) => /\d+ passed, \d+ failed|\d+\/\d+ (checks )?passed/.test(l)) ?? '(geen slotregel)';
  // Slotregel is leidend (member-auth print elke check twee keer: bij record() én in de samenvatting); regels tellen = fallback.
  const a = slot.match(/(\d+) passed, (\d+) failed/);
  if (a) return { ok: +a[1], fail: +a[2], slot: slot.trim() };
  const b = slot.match(/(\d+)\/(\d+) (?:checks )?passed/);
  if (b) return { ok: +b[1], fail: +b[2] - +b[1], slot: slot.trim() };
  const ok = lines.filter((l) => (conventie === 'check' ? /^\s*✓ / : /^PASS\s{2}/).test(l)).length;
  const fail = lines.filter((l) => (conventie === 'check' ? /^\s*✗ FAIL: / : /^FAIL\s{2}/).test(l)).length;
  return { ok, fail, slot: slot.trim() };
}

function run(h: Harness): Promise<Result> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let out = '';
    // detached = eigen procesgroep: tsx is een wrapper om node+Chromium; een kill op -pid raakt de hele groep (anders blijft het kleinkind leven en komt 'close' nooit).
    const child = spawn(TSX, [path.join(HERE, h.file)], { env: { ...process.env, BASE_URL, MAILPIT_URL }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    const killGroup = (sig: NodeJS.Signals) => { try { process.kill(-(child.pid as number), sig); } catch { try { child.kill(sig); } catch { /* al weg */ } } };
    const onData = (d: Buffer) => { const s = d.toString(); out += s; process.stdout.write(s); };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    let timedOut = false, done = false;
    let killTimer: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => { timedOut = true; killGroup('SIGTERM'); killTimer = setTimeout(() => killGroup('SIGKILL'), 5000); }, TIMEOUT_MS);
    const finish = (status: Result['status'], code: number | null, slotOverride?: string) => {
      if (done) return; done = true;
      clearTimeout(timer); if (killTimer) clearTimeout(killTimer);
      const t = tel(out, h.conventie);
      resolve({ file: h.file, conventie: h.conventie, status, exit: code, ...t, ...(slotOverride ? { slot: slotOverride } : {}), ms: Date.now() - t0 });
    };
    child.on('error', (e) => finish('NIET GESTART', null, String(e.message)));
    child.on('close', (code) => finish(timedOut ? 'TIMEOUT' : code === 0 ? 'OK' : 'FAIL', code));
    // 'exit' komt vóór 'close'; als de pipes door een overlevend kleinkind openblijven, sluiten we 2 s na exit toch af (fail-closed, gemeld).
    child.on('exit', (code) => setTimeout(() => finish(timedOut ? 'TIMEOUT' : code === 0 ? 'OK' : 'FAIL', code, done ? undefined : `${tel(out, h.conventie).slot} (pipes niet gesloten — kleinkind?)`), 2000));
  });
}

const selected = HARNESSES.filter((h) => !only || only.has(h.file.replace(/^e2e-|\.ts$/g, '')));
if (only && selected.length !== only.size) { console.error(`--only: onbekende naam in ${[...only].join(',')}`); process.exit(2); }
const results: Result[] = [];
const toRun: Harness[] = [];
for (const h of selected) {
  if (h.blocked && !flag('--incl-playback')) results.push({ file: h.file, conventie: h.conventie, status: 'OVERGESLAGEN', exit: null, ok: 0, fail: 0, slot: h.blocked, ms: 0 });
  else {
    if (h.blocked) console.error(`⛔ ${h.file} draait op uitdrukkelijk verzoek (--incl-playback), tegen B22 in: een groene uitkomst is GEEN bewijs van werkende playback (Bunny gestopt 2026-09-02, CLAUDE.md).`);
    toRun.push(h);
  }
}
if (!toRun.length) { console.error('Niets te draaien (alles overgeslagen of niets geselecteerd) — exit 2, geen groene vlag.'); process.exit(2); }
const fouten = await preflight(toRun);
if (fouten.length) {
  console.error(`\nPREFLIGHT MISLUKT — ${fouten.length} voorwaarde(n) ontbreken, geen harness gestart:`);
  for (const f of fouten) console.error(`  - ${f}`);
  process.exit(3);
}
console.log(`\ne2e-all: ${toRun.length} harness(es) na elkaar tegen ${BASE_URL}, timeout ${TIMEOUT_MS} ms per harness\n`);
for (const h of toRun) {
  console.log(`\n══════ ${h.file} — ${h.dekt} ══════`);
  results.push(await run(h));
}
console.log('\n' + '═'.repeat(100));
console.log(`${'harness'.padEnd(24)} ${'conv.'.padEnd(7)} ${'status'.padEnd(13)} ${'exit'.padEnd(5)} ${'ok'.padStart(4)} ${'fail'.padStart(5)} ${'duur'.padStart(8)}  slotregel`);
for (const r of results) console.log(`${r.file.padEnd(24)} ${r.conventie.padEnd(7)} ${r.status.padEnd(13)} ${String(r.exit ?? '-').padEnd(5)} ${String(r.ok).padStart(4)} ${String(r.fail).padStart(5)} ${(r.ms / 1000).toFixed(1).padStart(7)}s  ${r.slot}${r.file === 'e2e-playback-gate.ts' && r.status === 'OK' ? '  (B22: geen bewijs van werkende playback)' : ''}`);
const gefaald = results.filter((r) => ['FAIL', 'TIMEOUT', 'NIET GESTART'].includes(r.status));
const overgeslagen = results.filter((r) => r.status === 'OVERGESLAGEN');
console.log(`\nTOTAAL: ${results.length - gefaald.length - overgeslagen.length} OK · ${gefaald.length} gefaald · ${overgeslagen.length} overgeslagen (gemeld, niet stil)`);
process.exit(gefaald.length ? 1 : 0);
