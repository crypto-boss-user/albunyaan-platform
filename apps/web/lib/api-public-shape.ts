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
  'id', 'slug', 'name', 'short_description', 'description',
  'thumbnail_url', 'thumbnail_hue', 'duration_seconds', 'episodeCount', 'position', 'type',
  // nodig voor ouderlijk toezicht in de app
  'access', 'age_rating',
]);

/**
 * Sleutels die er NOOIT in mogen. Puur als vangnet én als leesbare documentatie van het risico —
 * de allowlist hierboven doet het echte werk.
 */
/**
 * Bewust NIET toegevoegd: een `cover`-veld uit `raw.cover_url`. Cubic stelt dat voor omdat de
 * serializer `raw` weggooit. Klopt — maar het lid-gezicht van de website toont die afbeelding
 * vandaag ook niet: `cover_url` wordt alleen in de admin gezet en getoond
 * (`apps/web/app/admin/collections/[id]/EditCollectionForm.tsx:53`). De app-API zou er dus een
 * veld bij krijgen dat het web niet heeft — pariteit eerst, uitbreiding als het web het toont.
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
