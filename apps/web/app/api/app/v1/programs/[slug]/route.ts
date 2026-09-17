/**
 * GET /api/app/v1/programs/[slug] — één programma (serie of losse video).
 *
 * Hergebruikt `getProgramBySlug()`. Geeft GEEN speel-URL terug: die hoort achter een
 * entitlement-controle en wordt per verzoek serverkant ondertekend. Zolang K1 (kijkplatform)
 * niet beslist is, bestaat dat endpoint niet — en liever geen dan een die te veel weggeeft.
 */
import { getProgramBySlug } from '@albunyaan/core/data';
import { apiOk, apiError } from '../../../../../../lib/api-auth';
import { publiekeVorm, coverVanCollectie } from '../../../../../../lib/api-public-shape';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!slug) return apiError(400, 'missing_slug', 'Slug ontbreekt.');
  try {
    const program = await getProgramBySlug(slug);
    if (!program) return apiError(404, 'not_found', 'Programma niet gevonden.');
    // Een serie zonder zichtbare afleveringen bestaat voor de bezoeker niet — de catalogus laat
    // zulke series ook weg (catalog.ts, filter op videos.length > 0). Niet als leeg programma
    // teruggeven (Cubic, PR #2).
    if (program.kind === 'series' && program.collection.episodes.length === 0) {
      return apiError(404, 'not_found', 'Programma niet gevonden.');
    }
    // De poster hoort bij de presentatie en zit in `raw`, dat de serializer weggooit — dus hier
    // afleiden, precies zoals de webpagina dat doet, en als expliciet veld meegeven.
    const verrijkt =
      program.kind === 'series'
        ? { ...program, collection: { ...program.collection, cover: coverVanCollectie(program.collection) } }
        : program;
    return apiOk({ program: publiekeVorm(verrijkt) });
  } catch {
    return apiError(503, 'upstream_unavailable', 'Programma tijdelijk niet beschikbaar.');
  }
}
