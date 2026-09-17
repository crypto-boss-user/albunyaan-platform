/**
 * GET /api/app/v1/search?q=... — zoeken in de catalogus.
 *
 * Hergebruikt `searchCatalog()`, dat zelf de zichtbaarheidsfilter opnieuw toepast en het
 * LIKE-patroon ontsnapt (search.ts:28,63). Wij voegen hier geen eigen query-opbouw toe.
 */
import { searchCatalog } from '@albunyaan/core/data';
import { apiOk, apiError } from '../../../../../lib/api-auth';
import { publiekeVorm } from '../../../../../lib/api-public-shape';

export const dynamic = 'force-dynamic';

/** Zelfde ondergrens als de webpagina: onder de 2 tekens zoeken we niet. */
const MIN_QUERY = 2;
const MAX_QUERY = 100;

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < MIN_QUERY) {
    // Zelfde vorm als een geslaagde zoekopdracht (series/episodes), zodat de app één parser heeft.
    return apiOk({ query: q, series: [], episodes: [], reason: 'query_too_short' });
  }
  if (q.length > MAX_QUERY) {
    return apiError(400, 'query_too_long', `Zoekterm mag maximaal ${MAX_QUERY} tekens zijn.`);
  }
  try {
    const results = await searchCatalog(q);
    return apiOk({ query: q, ...(publiekeVorm(results) as object) });
  } catch {
    return apiError(503, 'upstream_unavailable', 'Zoeken tijdelijk niet beschikbaar.');
  }
}
