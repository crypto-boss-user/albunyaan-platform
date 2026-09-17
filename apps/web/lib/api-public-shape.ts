/**
 * Publieke vorm voor de app-API: een ALLOWLIST, geen blocklist.
 *
 * Waarom dit bestaat. De datalaag levert rijen zoals de website ze nodig heeft, inclusief
 * `bunny_video_id`, `resources` en ruwe Uscreen-velden. Een pagina rendert daar een deel van;
 * een JSON-endpoint stuurt ALLES wat erin zit. Dat verschil is precies het gat dat het
 * security-rapport beschrijft: met een `bunny_video_id` in handen kan een niet-ingelogde
 * bezoeker een embed opbouwen en betaalde video's kijken.
 *
 * Daarom: alleen sleutels uit `TOEGESTANE_SLEUTELS` overleven. Komt er morgen een kolom bij in
 * `VIDEO_COLS`, dan lekt die hier NIET mee — hij verdwijnt tot iemand hem bewust toevoegt.
 * Dat is de fail-closed kant op (change-control B47: dit soort code is nooit bloat).
 */

/** Structuur- en inhoudsvelden die de app mag zien. Bewust kort. */
const TOEGESTANE_SLEUTELS = new Set([
  // structuur van een catalogusrij
  'kind', 'key', 'title', 'seeAllHref', 'items', 'videos', 'category', 'collection',
  // `video` (enkelvoud) hoort bij Program { kind: 'video', video } — zonder deze sleutel geeft
  // /programs/[slug] voor een losse video alleen { kind: 'video' } terug (Cubic, PR #2)
  'video',
  // zoekresultaten: searchCatalog() levert { q, series, episodes } — zonder deze twee komt een
  // geslaagde zoekopdracht leeg terug (gevonden door Cubic, 2026-09-17)
  'series', 'episodes',
  // identiteit en weergave
  'id', 'slug', 'name', 'short_description', 'description', 'cover',
  'thumbnail_url', 'thumbnail_hue', 'duration_seconds', 'episodeCount', 'position', 'type',
  // nodig voor ouderlijk toezicht in de app
  'access', 'age_rating',
]);

/**
 * Sleutels die er NOOIT in mogen. Puur als vangnet én als leesbare documentatie van het risico —
 * de allowlist hierboven doet het echte werk.
 */
/**
 * `cover` is een AFGELEID veld, geen databasekolom. De serializer gooit `raw` weg, maar de
 * programmapagina van het web gebruikt juist `collection.raw?.cover_url` als posterafbeelding
 * (`apps/web/app/programs/[slug]/page.tsx:126`), met als terugval de thumbnail van de eerste
 * zichtbare aflevering. Zonder dit veld zou de app een andere — of helemaal geen — afbeelding
 * tonen dan de site. De route rekent `cover` uit vóór het snoeien; zie `coverVanCollectie()`.
 *
 * (Ik had dit eerst afgewezen met de redenering dat alleen de admin `cover_url` gebruikt. Dat was
 * onjuist: mijn zoekopdracht miste `raw?.cover_url` met optional chaining. Cubic hield vol en had
 * gelijk.)
 */
export const VERBODEN_SLEUTELS = [
  'bunny_video_id', 'resources', 'raw', 'status', 'member_visible',
  'live_stream_url', 'live_provider', 'uscreen_hls_url', 'external_id', 'source',
];

/**
 * Snoeit een willekeurige waarde terug tot de toegestane vorm.
 * Arrays worden element voor element gesnoeid; objecten houden alleen toegestane sleutels;
 * primitieven gaan ongewijzigd door. `null` blijft `null`.
 */
export function publiekeVorm<T>(waarde: T): unknown {
  if (waarde === null || waarde === undefined) return waarde ?? null;
  if (Array.isArray(waarde)) return waarde.map((v) => publiekeVorm(v));
  if (typeof waarde !== 'object') return waarde;
  if (waarde instanceof Date) return waarde.toISOString();
  const uit: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(waarde as Record<string, unknown>)) {
    if (!TOEGESTANE_SLEUTELS.has(k)) continue;
    uit[k] = publiekeVorm(v);
  }
  return uit;
}

/**
 * Dezelfde posterkeuze als de webpagina (`programs/[slug]/page.tsx:126`): de ingestelde cover,
 * anders de thumbnail van de eerste zichtbare aflevering, anders niets. Bewust hier en niet in
 * `packages/core`, omdat het een presentatiekeuze is en core gedeeld wordt met het web.
 */
export function coverVanCollectie(collection: {
  raw?: { cover_url?: string | null } | null;
  episodes?: { thumbnail_url?: string | null }[];
} | null | undefined): string | null {
  if (!collection) return null;
  const ingesteld = collection.raw?.cover_url ?? null;
  if (ingesteld) return ingesteld;
  return collection.episodes?.find((e) => e.thumbnail_url)?.thumbnail_url ?? null;
}
