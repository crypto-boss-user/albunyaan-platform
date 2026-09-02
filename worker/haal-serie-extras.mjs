/**
 * haal-serie-extras.mjs — beschrijving/zoekwoorden/cover ophalen voor een lijst
 * collecties en klaarzetten in een staging-map (2026-09-02, AS 8 uit audit-volledig).
 *
 * Alleen LEZEN bij Uscreen; schrijft uitsluitend in de staging-map. Plaatsing op de
 * NAS is een aparte, expliciete stap.
 *
 *   node haal-serie-extras.mjs <id> [<id> ...]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const ST = path.join(CC, 'archief', 'as8-extras-20260902');
const CDP = process.env.CHROME_CDP || '9333';
const ids = process.argv.slice(2).filter((x) => /^\d+$/.test(x));
if (!ids.length) { console.error('geef minstens één collectie-id'); process.exit(1); }
fs.mkdirSync(ST, { recursive: true });
const ts = () => new Date().toISOString().slice(11, 19);
const log = (s) => console.log(`[${ts()}] ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const san = (s) => String(s).replace(/[/:|?*<>"\\]/g, '_').trim();
function htmlNaarTekst(html) {
  let s = String(html ?? '');
  s = s.replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
       .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
  const r = s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  return r.filter((l, i) => l || (i > 0 && r[i - 1])).join('\n').trim();
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto('https://app.uscreen.tv/manage/videos', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
const api = (pad, body) => page.evaluate(async ([pad, body]) => {
  const r = await fetch(`https://app.uscreen.tv/bullet_api/v1/${pad}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.ok ? await r.json() : { __err: r.status };
}, [pad, body]);

const uitkomst = [];
for (const id of ids) {
  const j = await api('contents_collections.details', { id: Number(id) });
  const k = j.collection;
  if (j.__err || !k) { log(`${id}: MISLUKT (${j.__err ?? 'geen collection'})`); uitkomst.push({ id, fout: true }); continue; }
  const map = path.join(ST, `${id} - ${san(k.title)}`);
  fs.mkdirSync(map, { recursive: true });
  const tekst = htmlNaarTekst(k.description);
  const tags = (k.tags ?? []).filter((t) => String(t).trim());
  if (tekst) fs.writeFileSync(path.join(map, 'beschrijving.txt'), tekst + '\n');
  if (tags.length) fs.writeFileSync(path.join(map, 'zoekwoorden.txt'), tags.join('\n') + '\n');
  // cover: het ORIGINEEL is de url zonder de "big_"-prefix; big_ is de terugval.
  const url = k.big_horizontal_image_url ?? null;
  let cover = null;
  if (url) {
    const kaal = url.replace(/\/big_([^/]+)$/, '/$1');
    for (const [kand, label] of [[kaal, 'origineel'], [url, 'big_']]) {
      const doel = path.join(map, 'cover.jpg');
      const r = spawnSync('curl', ['-sS', '-L', '--max-time', '60', '-o', doel, '-w', '%{http_code}', kand], { encoding: 'utf8' });
      if (r.stdout.trim() === '200' && fs.statSync(doel).size > 1000) { cover = label; break; }
      try { fs.unlinkSync(doel); } catch { /* niets */ }
    }
  }
  fs.writeFileSync(path.join(map, 'uscreen-metadata.json'), JSON.stringify({
    id, title: k.title, meta_title: k.meta_title, permalink: k.permalink,
    description_html: k.description ?? '', tags, cover_url: url, opgehaald: new Date().toISOString() }, null, 1));
  log(`${id} ${String(k.title).slice(0, 40)} — beschrijving ${tekst.length} tk · ${tags.length} tags · cover ${cover ?? 'MISLUKT'}`);
  uitkomst.push({ id, titel: k.title, map, beschrijving: tekst.length, tags: tags.length, cover });
  await sleep(300);
}
try { await page.close(); } catch { /* laatste tab met rust laten */ }
fs.writeFileSync(path.join(ST, 'uitkomst.json'), JSON.stringify(uitkomst, null, 1));
log(`klaar -> ${ST}`);
