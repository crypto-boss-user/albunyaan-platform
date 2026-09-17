/**
 * GET /api/app/v1/catalog — de startpagina van de app.
 *
 * Levert dezelfde samenstelling als de storefront `/catalog` (apps/web/app/catalog/page.tsx:19):
 * `getCategoryRows()` + `getFeaturedItems()` + `getAllCategories()`. Dat is bewust géén
 * `getCatalogRows()` — die bouwt de home-rijen per SERIE, terwijl de catalogus per CATEGORIE
 * gaat. Cubic wees er in de review van PR #2 op dat de app anders stilletjes andere inhoud
 * ziet dan de website; dit endpoint volgt de storefront.
 *
 * Publiek: de catalogus is leesbaar zonder in te loggen, net als op het web. Afspelen niet —
 * dat gaat via een apart endpoint met entitlement-controle (wacht op K1).
 */
import { getCategoryRows, getFeaturedItems, getAllCategories } from '@albunyaan/core/data';
import { apiOk, apiError } from '../../../../../lib/api-auth';
import { publiekeVorm } from '../../../../../lib/api-public-shape';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [rows, featured, categories] = await Promise.all([
      getCategoryRows(),
      getFeaturedItems(),
      getAllCategories(),
    ]);
    // Nooit de ruwe rijen: die dragen bunny_video_id en resources mee (zie api-public-shape.ts).
    return apiOk({
      rows: publiekeVorm(rows),
      featured: publiekeVorm(featured),
      categories: publiekeVorm(categories),
    });
  } catch {
    return apiError(503, 'upstream_unavailable', 'Catalogus tijdelijk niet beschikbaar.');
  }
}
