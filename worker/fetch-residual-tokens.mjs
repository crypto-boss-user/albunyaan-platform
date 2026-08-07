/**
 * STAP 6 — verse Mux-tokens voor alle video's ZONDER Bunny-kopie, via de
 * bullet_api (videos.details geeft een verse hls_url in ±100ms; geen zware
 * pagina-loads, geen hCaptcha-risico). De VPS-transferdienst (met de
 * kwaliteitsfix: beste renditie via ffprobe) pakt ze daarna vanzelf op —
 * er loopt géén ffmpeg/upload over de thuislijn.
 *
 * Doelgroep: residual-19 + de ±123 nieuwe video's van na de juli-kopie.
 * Video's die niet meer op Uscreen bestaan (o.a. de 12 verwijderde نكتة-refs)
 * staan niet in de details-harvest en worden expliciet geteld, niet gegokt.
 *
 * Run (vanuit worker/):  node fetch-residual-tokens.mjs [--dry]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const DRY = process.argv.includes('--dry');
const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const line of fs.readFileSync(path.join(CC, 'cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const SB = process.env.SUPABASE_URL + '/rest/v1';
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };

async function fetchAll(q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB}/${q}`, { headers: { ...H, Range: `${from}-${from + 999}` } });
    const chunk = await r.json();
    rows.push(...chunk);
    if (chunk.length < 1000) return rows;
  }
}

async function main() {
  const harvested = new Set(
    fs.readFileSync(path.join(CC, 'uscreen-video-details.jsonl'), 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { const d = JSON.parse(l); return d.error ? null : String(d.id); } catch { return null; } })
      .filter(Boolean),
  );
  const pending = await fetchAll(`videos?select=id,external_id,title,status&source=eq.uscreen&bunny_video_id=is.null&status=neq.live`);
  const doable = pending.filter((v) => harvested.has(String(v.external_id)));
  const gone = pending.filter((v) => !harvested.has(String(v.external_id)));
  console.log(`[${ts()}] zonder Bunny-kopie: ${pending.length} | op Uscreen aanwezig: ${doable.length} | niet meer op Uscreen (onherstelbaar): ${gone.length}`);
  if (DRY || !doable.length) { gone.slice(0, 20).forEach((v) => console.log('  weg:', v.external_id, String(v.title).slice(0, 40))); process.exit(0); }

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find((p) => p.url() === 'about:blank') ?? ctx.pages().find((p) => p.url().includes('app.uscreen.tv')) ?? (await ctx.newPage());
  if (!page.url().includes('app.uscreen.tv')) {
    await page.goto('https://app.uscreen.tv/manage/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  if (page.url().includes('login')) throw new Error('USCREEN SESSION DEAD — eerst inloggen in de twin Chrome.');

  let ok = 0, fail = 0;
  for (const v of doable) {
    try {
      const r = await page.evaluate(async (id) => {
        const res = await fetch('/bullet_api/v1/videos.details', {
          method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }), redirect: 'manual',
        });
        let j = null; try { j = await res.json(); } catch {}
        return { status: res.status, hls: j?.video?.hls_url ?? null };
      }, Number(v.external_id));
      if (r.hls) {
        const u = await fetch(`${SB}/videos?id=eq.${v.id}`, {
          method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ uscreen_hls_url: r.hls }),
        });
        if (!u.ok) throw new Error(`db ${u.status}`);
        ok++;
      } else { fail++; console.log(`[${ts()}]   geen hls voor ${v.external_id} (HTTP ${r.status}) "${String(v.title).slice(0, 36)}"`); }
      await sleep(350);
    } catch (e) { fail++; console.log(`[${ts()}]   FOUT ${v.external_id}: ${String(e.message).slice(0, 80)}`); }
  }
  console.log(`[${ts()}] DONE: ${ok} tokens gezet, ${fail} mislukt — de VPS-transferdienst pakt ze nu vanzelf op.`);
  await page.goto('about:blank', { timeout: 10000 }).catch(() => {});
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
