import fs from 'node:fs';
import path from 'node:path';

/**
 * Onafhankelijke tellingen voor de structuurtests (SR 4 stap 9/10): leest de Supabase-leessleutels uit apps/web/.env.local
 * (zelfde bron als de testserver; waarden worden nooit gelogd) en pagineert ALTIJD per 1000 rijen — Supabase REST clamt
 * grotere Range-verzoeken stil af (CLAUDE.md). Alleen GET; niets wordt geschreven.
 */
function env(): { url: string; key: string } {
  const file = process.env.E2E_ENV_FILE ?? '.env.local';
  const p = path.resolve(__dirname, '..', '..', file);
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  const url = process.env.SUPABASE_URL ?? out.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? out.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ontbreken in ${file}`);
  return { url, key };
}

/** Alle rijen van een REST-pad, in pagina's van 1000 (Range), tot een pagina korter dan 1000 komt. */
export async function fetchAll<T = any>(pathAndQuery: string): Promise<T[]> {
  const { url, key } = env();
  const out: T[] = [];
  for (let start = 0; ; start += 1000) {
    const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${start}-${start + 999}` },
    });
    if (!res.ok) throw new Error(`REST ${res.status} voor ${pathAndQuery.split('?')[0]}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const VISIBLE = new Set(['published', 'live']);

/**
 * De zichtbaarheidsregel van de data-laag (packages/core/src/data/catalog.ts: isVisibleVideo + toCategoryItems), onafhankelijk
 * nagerekend: een collectie is zichtbaar met ≥ 1 published/live aflevering; een categorie-item is zichtbaar als de video
 * published/live is of de collectie zichtbaar is. Geeft per categorie-slug het aantal zichtbare items.
 */
export async function zichtbareItemsPerCategorie(): Promise<{
  categorieen: { id: string; external_id: string; slug: string; name: string; position: number | null }[];
  perSlug: Map<string, number>;
  /** Zichtbare items per categorie-slug als /programs/<slug>-hrefs in category_items.position-volgorde (ORDER FIDELITY). */
  volgordePerSlug: Map<string, string[]>;
}> {
  const [cats, colItems, catItems] = await Promise.all([
    fetchAll<{ id: string; external_id: string; slug: string; name: string; position: number | null }>('categories?select=id,external_id,slug,name,position&order=position.asc.nullslast,name.asc'),
    fetchAll<{ collection_id: string; videos: { status: string } | null }>('collection_items?select=collection_id,videos(status)'),
    fetchAll<{ category_id: string; position: number; video_id: string | null; collection_id: string | null; videos: { status: string; slug: string } | null; collections: { slug: string } | null }>(
      'category_items?select=category_id,position,video_id,collection_id,videos(status,slug),collections(slug)&order=position.asc',
    ),
  ]);
  const zichtbareCollecties = new Set<string>();
  for (const ci of colItems) if (ci.videos && VISIBLE.has(ci.videos.status)) zichtbareCollecties.add(ci.collection_id);
  const perId = new Map<string, string[]>();
  for (const it of catItems) {
    const ok = it.video_id ? !!it.videos && VISIBLE.has(it.videos.status) : !!it.collection_id && zichtbareCollecties.has(it.collection_id);
    if (!ok) continue;
    const slug = it.video_id ? it.videos!.slug : it.collections!.slug;
    perId.set(it.category_id, [...(perId.get(it.category_id) ?? []), `/programs/${slug}`]);
  }
  const perSlug = new Map<string, number>();
  const volgordePerSlug = new Map<string, string[]>();
  for (const c of cats) {
    const hrefs = perId.get(c.id) ?? [];
    perSlug.set(c.slug, hrefs.length);
    volgordePerSlug.set(c.slug, hrefs);
  }
  return { categorieen: cats, perSlug, volgordePerSlug };
}

/** Zichtbare afleveringen van een collectie als /watch/<slug>-hrefs in collection_items.position-volgorde (ORDER FIDELITY, stap 11). */
export async function afleveringenVanCollectie(collectionSlug: string): Promise<string[]> {
  const rows = await fetchAll<{ position: number; videos: { slug: string; status: string } | null; collections: { slug: string } }>(
    `collection_items?select=position,videos(slug,status),collections!inner(slug)&collections.slug=eq.${encodeURIComponent(collectionSlug)}&order=position.asc`,
  );
  return rows.filter((r) => r.videos && VISIBLE.has(r.videos.status)).map((r) => `/watch/${r.videos!.slug}`);
}

/**
 * Schrijfhulp voor TESTRECORDS (AD 1, founder-regel (d) 2026-09-06): bewerkacties in tests alleen op records met een titel/code die
 * met "TEST-AD1-" begint; daarna opruimen en de opruiming tellen. Fail-closed: elke andere insert wordt geweigerd, en verwijderen kan
 * alleen op ids die deze helper zelf aanmaakte (of op afgeleide rijen van zo'n id).
 */
const aangemaakt = new Set<string>();
const TEST_PREFIX = 'TEST-AD1-';

export async function maakTestRij<T extends { id: string }>(table: string, row: Record<string, unknown>): Promise<T> {
  const naam = String(row.title ?? row.code ?? row.name ?? row.full_name ?? '');
  if (!naam.startsWith(TEST_PREFIX)) throw new Error(`maakTestRij: titel/code moet met ${TEST_PREFIX} beginnen`);
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`maakTestRij ${table} → ${res.status} ${await res.text()}`);
  const [created] = (await res.json()) as T[];
  aangemaakt.add(created.id);
  return created;
}

/** Registreert een via de UI aangemaakte test-id — alleen als de rij aantoonbaar een TEST-AD1-titel/naam draagt (REST-controle). */
export async function registreerTestId(table: string, id: string, kolom: 'title' | 'name' = 'title'): Promise<void> {
  const rows = await fetchAll<Record<string, string>>(`${table}?select=${kolom}&id=eq.${encodeURIComponent(id)}`);
  if (!rows[0] || !String(rows[0][kolom] ?? '').startsWith(TEST_PREFIX)) throw new Error(`registreerTestId: ${table}/${id} is geen ${TEST_PREFIX}-record`);
  aangemaakt.add(id);
}

/** Verwijdert rijen van `table` waar `kolom` = een door maakTestRij aangemaakte id. Geeft het aantal verwijderde rijen terug. */
export async function verwijderTestRijen(table: string, kolom: string, id: string): Promise<number> {
  if (!aangemaakt.has(id)) throw new Error(`verwijderTestRijen: ${id} is niet door deze test aangemaakt`);
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/${table}?${kolom}=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
  });
  if (!res.ok) throw new Error(`verwijderTestRijen ${table} → ${res.status}`);
  return ((await res.json()) as unknown[]).length;
}

/** Verwijdert rijen via een REST-filter dat de eigen test-id moet bevatten (bv. jsonb-contains op bulk-audit-rijen). */
export async function verwijderTestRijenWaar(table: string, filterQuery: string, id: string): Promise<number> {
  const q = decodeURIComponent(filterQuery);
  const eigenId = aangemaakt.has(id) && q.includes(id);
  const testPrefix = q.includes(`like.${TEST_PREFIX}`);
  if (!eigenId && !testPrefix) throw new Error(`verwijderTestRijenWaar: filter moet de eigen test-id ${id} of een like.${TEST_PREFIX}* bevatten`);
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/${table}?${filterQuery}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' } });
  if (!res.ok) throw new Error(`verwijderTestRijenWaar ${table} → ${res.status}`);
  return ((await res.json()) as unknown[]).length;
}

/** Eén rij lezen (voor controle na bewerken/terugzetten). */
export async function leesRij<T>(table: string, id: string, select = '*'): Promise<T | null> {
  const rows = await fetchAll<T>(`${table}?select=${select}&id=eq.${encodeURIComponent(id)}`);
  return rows[0] ?? null;
}
