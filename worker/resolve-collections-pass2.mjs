/**
 * Pas 2 van de serie-permalink-resolver: match via de AFLEVERINGEN-SET.
 *
 * Waarom: de storefront draait Weglot — document.title is automatisch vertaald
 * (Arabisch) en matcht dus niet op onze admin-titels (pas 1 strandde op 294
 * series). Maar /programs/<permalink>.turbo_stream?playlist_position=sidebar
 * levert de afleveringenlijst als HTML-fragment (goedkoop, geen page-render).
 * De video-permalinks daarin kennen we uit de details-harvest → de serie is de
 * collectie met de grootste overlap in uscreen-collection-members.jsonl.
 * Eis: ≥60% overlap én een uniek beste kandidaat — anders GELOGD, niet gegokt.
 *
 * Output: append op ~/.albunyaan-cc/uscreen-collection-permalinks.jsonl
 * Run (vanuit worker/):  node resolve-collections-pass2.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const MAP = path.join(CC, 'uscreen-collection-permalinks.jsonl');
const ts = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const resolved = new Set(
    fs.existsSync(MAP) ? fs.readFileSync(MAP, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).permalink) : [],
  );
  const details = fs.readFileSync(path.join(CC, 'uscreen-video-details.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((d) => !d.error);
  const videoByPermalink = new Map(details.filter((d) => d.permalink).map((d) => [String(d.permalink), String(d.id)]));
  const catOrder = fs.readFileSync(path.join(CC, 'uscreen-category-order.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const want = new Set();
  for (const c of catOrder) for (const p of c.items ?? []) {
    if (!videoByPermalink.has(p) && !resolved.has(p) && p.startsWith('collection-')) want.add(p);
  }
  console.log(`[${ts()}] pas 2: ${want.size} series op te lossen via afleveringen-set`);

  // collectie → set van video-exts
  const collVideos = new Map();
  for (const l of fs.readFileSync(path.join(CC, 'uscreen-collection-members.jsonl'), 'utf8').split('\n').filter(Boolean)) {
    const c = JSON.parse(l);
    if (c.id && Array.isArray(c.videoIds)) collVideos.set(String(c.id), new Set(c.videoIds.map(String)));
  }

  // exacte admin-titel → collectie-ext (uit de cloud-DB; h1 is onvertaald)
  for (const l of fs.readFileSync(path.join(CC, 'cloud.env'), 'utf8').split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const titleMap = new Map();
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/collections?select=external_id,title&source=eq.uscreen`, {
      headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, Range: `${from}-${from + 999}` },
    });
    const chunk = await r.json();
    for (const c of chunk) {
      const t = String(c.title).trim();
      titleMap.set(t, [...(titleMap.get(t) ?? []), c.external_id]);
    }
    if (chunk.length < 1000) break;
  }

  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const ctx = browser.contexts()[0];
  let ok = 0, ambiguous = 0, empty = 0, n = 0;
  const out = fs.createWriteStream(MAP, { flags: 'a' });
  for (const p of want) {
    try {
      // collection_homepage-fragment: bevat de ONVERTAALDE admin-titel (h1;
      // Weglot vertaalt alleen de volledige pagina) én de afleveringen als
      // numerieke video-ids in /programs/<id>-links.
      const resp = await ctx.request.get(`https://albunyaan.tv/programs/${p}/collection_homepage?playlist_position=sidebar&preview=false`, { timeout: 30000 });
      const html = resp.ok() ? await resp.text() : '';
      const h1 = (html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/) ?? html.match(/<h1[^>]*>\s*([^<]+)/) ?? [])[1]?.trim();
      if (h1 && titleMap.has(h1) && titleMap.get(h1).length === 1) {
        out.write(JSON.stringify({ permalink: p, id: titleMap.get(h1)[0], via: 'h1-title' }) + '\n');
        ok++;
        if (++n % 50 === 0) console.log(`[${ts()}]   ${n}/${want.size} (${ok} opgelost)`);
        await sleep(400);
        continue;
      }
      const eps = [...new Set([...html.matchAll(/\/programs\/(\d+)/g)].map((m) => m[1]))]
        .concat([...new Set([...html.matchAll(/\/programs\/([a-z0-9\-_]+)/gi)].map((m) => m[1]).filter((x) => x !== p))]
          .map((perm) => videoByPermalink.get(perm)).filter(Boolean));
      if (!eps.length) { empty++; console.log(`[${ts()}]   LEEG: ${p}`); }
      else {
        let best = null, bestScore = 0, second = 0;
        for (const [collExt, members] of collVideos) {
          const score = eps.filter((e) => members.has(e)).length;
          if (score > bestScore) { second = bestScore; bestScore = score; best = collExt; }
          else if (score > second) second = score;
        }
        if (best && bestScore / eps.length >= 0.6 && bestScore > second) {
          out.write(JSON.stringify({ permalink: p, id: best, via: 'episodes', overlap: `${bestScore}/${eps.length}` }) + '\n');
          ok++;
        } else { ambiguous++; console.log(`[${ts()}]   AMBIGU: ${p} (best ${bestScore}/${eps.length}, tweede ${second})`); }
      }
    } catch (e) { console.log(`[${ts()}]   FOUT ${p}: ${String(e.message).slice(0, 60)}`); }
    if (++n % 50 === 0) console.log(`[${ts()}]   ${n}/${want.size} (${ok} opgelost)`);
    await sleep(400);
  }
  out.end();
  console.log(`[${ts()}] DONE pas 2: ${ok} opgelost, ${ambiguous} ambigu, ${empty} leeg (van ${want.size})`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
