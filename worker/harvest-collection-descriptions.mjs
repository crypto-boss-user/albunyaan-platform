/**
 * Serie-BESCHRIJVINGEN oogsten van de storefront (2026-08-07).
 *
 * Waarom: de échte redactionele beschrijvingen leven bij Uscreen op
 * SERIE-niveau (video-descriptions zijn op 23 na lege <p></p>-schillen;
 * geteld op de volledige details-harvest). De admin-API heeft geen
 * collections-endpoint; de storefront-fragmenten wél:
 *   /programs/<permalink>/collection_homepage → div.content-description
 *
 * Input:  ~/.albunyaan-cc/uscreen-collection-permalinks.jsonl (622 mappings)
 * Output: ~/.albunyaan-cc/uscreen-collection-descriptions.jsonl {id, text}
 *         + directe PATCH van collections.description (platte tekst) in de DB
 * Niet-gemapte collecties worden GETELD, niet gegokt.
 *
 * Run (vanuit worker/): node harvest-collection-descriptions.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const OUT = path.join(CC, 'uscreen-collection-descriptions.jsonl');
const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const line of fs.readFileSync(path.join(CC, 'cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const SB = process.env.SUPABASE_URL + '/rest/v1';
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
const plain = (h) => String(h ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();

async function main() {
  // permalink → collectie-ext (laatste mapping wint; dedupliceer op ext-id)
  const byExt = new Map();
  for (const l of fs.readFileSync(path.join(CC, 'uscreen-collection-permalinks.jsonl'), 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(l);
    if (r.permalink && r.id) byExt.set(String(r.id), String(r.permalink));
  }
  console.log(`[${ts()}] ${byExt.size} collecties met bekende storefront-permalink`);

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  const out = fs.createWriteStream(OUT, { flags: 'w' });
  let got = 0, empty = 0, failed = 0, patched = 0, n = 0;
  for (const [ext, permalink] of byExt) {
    try {
      const r = await ctx.request.get(`https://albunyaan.tv/programs/${permalink}/collection_homepage?playlist_position=sidebar&preview=false`, { timeout: 30000 });
      const html = r.ok() ? await r.text() : '';
      const m = html.match(/class="content-description[^"]*"[\s\S]*?<div class="editor-content">([\s\S]*?)<\/div>/);
      const text = m ? plain(m[1]) : '';
      out.write(JSON.stringify({ id: ext, permalink, text }) + '\n');
      if (text) {
        got++;
        const u = await fetch(`${SB}/collections?source=eq.uscreen&external_id=eq.${ext}`, {
          method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ description: text }),
        });
        if (u.ok) patched++; else console.log(`[${ts()}]   PATCH FAALDE ${ext}: ${u.status}`);
      } else empty++;
    } catch (e) { failed++; console.log(`[${ts()}]   FOUT ${ext}/${permalink}: ${String(e.message).slice(0, 60)}`); }
    if (++n % 100 === 0) console.log(`[${ts()}]   ${n}/${byExt.size} (${got} met tekst)`);
    await sleep(350);
  }
  out.end();
  console.log(`[${ts()}] DONE: ${got} met beschrijving (${patched} in DB gezet), ${empty} zonder tekst, ${failed} fout — van ${byExt.size} gemapte collecties.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
