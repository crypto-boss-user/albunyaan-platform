/**
 * GET /api/app/v1/catalog — de startpagina van de app: dezelfde rijen als het web.
 *
 * Publiek: de catalogus is leesbaar zonder in te loggen (net als op het web). Afspelen is dat
 * niet — dat gaat via een apart endpoint met entitlement-controle (nog te bouwen, wacht op K1).
 *
 * Hergebruikt `getCatalogRows()` uit packages/core, dus dezelfde zichtbaarheidsregels als de
 * website. Niet dupliceren: de service-role-client omzeilt RLS, waardoor de statusfilter in
 * TypeScript de enige bescherming is (catalog.ts:29-40).
 */
import { getCatalogRows } from '@albunyaan/core/data';
import { apiOk, apiError } from '../../../../../lib/api-auth';
import { publiekeVorm } from '../../../../../lib/api-public-shape';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await getCatalogRows();
    // Nooit de ruwe rijen: die dragen bunny_video_id en resources mee (zie api-public-shape.ts).
    return apiOk({ rows: publiekeVorm(rows) });
  } catch {
    return apiError(503, 'upstream_unavailable', 'Catalogus tijdelijk niet beschikbaar.');
  }
}
