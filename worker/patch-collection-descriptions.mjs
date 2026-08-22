/**
 * patch-collection-descriptions.mjs — serie-beschrijvingen bijwerken uit de
 * ADMIN-oogst (2026-08-22).
 *
 * Waarom: harvest-collection-descriptions.mjs las het storefront-FRAGMENT
 * (/programs/<permalink>/collection_homepage → div.editor-content). Dat
 * fragment bevat die div voor nieuwere series niet meer, dus die series kregen
 * text:"" en dus géén beschrijving in Supabase en géén beschrijving.txt op de
 * NAS (bewezen op 4229512 "Nimo & Timo — Part 2"). De admin-API is wél
 * sluitend: uscreen-collection-details-live.jsonl (audit-serie-extras.mjs).
 *
 * Deze stap zet collections.description gelijk aan de admin-tekst. De web-app
 * rendert de tekst als tekst ({collection.description} in een <p>), dus we
 * slaan PLATTE TEKST op — dezelfde htmlToText als archive-extras.mjs gebruikt,
 * inclusief alinea-witregels. Daarna schrijft archive-extras.mjs de ontbrekende
 * beschrijving.txt naar de NAS.
 *
 * Fail-honest: leegt NOOIT een bestaande beschrijving (een lege admin-tekst
 * laat de DB-waarde staan en wordt geteld+gemeld), en meldt elke wijziging.
 *
 * Draaien (vanuit worker/):
 *   node patch-collection-descriptions.mjs --dry   # alleen tonen
 *   node patch-collection-descriptions.mjs         # echt patchen
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const LIVE = path.join(CC, 'uscreen-collection-details-live.jsonl');
const DRY = process.argv.includes('--dry');
for (const line of fs.readFileSync(path.join(CC, 'cloud.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const SB = process.env.SUPABASE_URL + '/rest/v1';
const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };

function htmlToText(html) {
  let s = String(html ?? '');
  s = s.replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"');
  const lines = s.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  return lines.filter((l, i) => l || (i > 0 && lines[i - 1])).join('\n').trim();
}
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const live = fs.readFileSync(LIVE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

async function sbAll(table, select) {
  const rows = []; const step = 1000;
  for (let from = 0; ; from += step) {
    const res = await fetch(`${SB}/${table}?select=${select}`, { headers: { ...H, Range: `${from}-${from + step - 1}` } });
    if (!res.ok) throw new Error(`${table}: ${res.status}`);
    const j = await res.json(); rows.push(...j);
    if (j.length < step) break;
  }
  return rows;
}
const db = new Map((await sbAll('collections', 'external_id,title,description'))
  .map((c) => [String(c.external_id), c]));

let nieuw = 0, gewijzigd = 0, gelijk = 0, leegGelaten = 0, nietInDb = 0, mislukt = 0;
for (const l of live) {
  if (l.__err) continue;
  const id = String(l.id);
  const tekst = htmlToText(l.description_html);
  const row = db.get(id);
  if (!row) { if (tekst) { nietInDb++; console.log(`NIET IN DB  ${id}  ${l.title}  (admin-tekst ${tekst.length} tekens)`); } continue; }
  const oud = row.description ?? '';
  if (!tekst) { if (oud) { leegGelaten++; console.log(`ADMIN LEEG, DB GEVULD — ONGEMOEID  ${id}  ${l.title}`); } continue; }
  if (norm(oud) === norm(tekst)) { gelijk++; continue; }
  const soort = oud ? 'GEWIJZIGD' : 'NIEUW';
  console.log(`${soort}  ${id}  ${l.title}  (db ${oud.length} → admin ${tekst.length})`);
  if (!DRY) {
    const u = await fetch(`${SB}/collections?source=eq.uscreen&external_id=eq.${id}`, {
      method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ description: tekst }),
    });
    if (!u.ok) { mislukt++; console.log(`   PATCH FAALDE ${id}: ${u.status} ${(await u.text()).slice(0, 120)}`); continue; }
  }
  if (oud) gewijzigd++; else nieuw++;
}
console.log(`\n${DRY ? '[DRY] ' : ''}nieuw: ${nieuw} · gewijzigd: ${gewijzigd} · al gelijk: ${gelijk} · admin leeg maar db gevuld (ongemoeid): ${leegGelaten} · niet in db: ${nietInDb} · patch mislukt: ${mislukt}`);
process.exit(0);
