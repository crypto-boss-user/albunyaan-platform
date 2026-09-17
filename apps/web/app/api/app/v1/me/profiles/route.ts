/**
 * GET /api/app/v1/me/profiles — de profielen van het huishouden van het ingelogde lid.
 *
 * Nodig voor "Wie kijkt er?" in de app, dezelfde keuze als op het web (`/profiles`).
 * Alleen lezen: een profiel aanmaken of de PIN wijzigen loopt via het web, want dat zijn
 * schrijfacties met ouderlijk toezicht eromheen en die horen niet in deze eerste schijf.
 *
 * Tenancy: profielen komen UITSLUITEND uit het huishouden van de ingelogde persoon. Er is
 * bewust geen id-parameter — dan kan niemand het profiel van een ander huishouden opvragen.
 */
import { getHouseholdByOwner, getProfiles } from '@albunyaan/core/data';
import { getApiMember, apiOk, apiError, apiUnauthorized } from '../../../../../../lib/api-auth';
import { publiekeVorm } from '../../../../../../lib/api-public-shape';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const member = await getApiMember(req);
  if (!member) return apiUnauthorized();
  try {
    const household = await getHouseholdByOwner(member.id);
    if (!household) return apiOk({ household: null, profiles: [], pinIngesteld: false });
    const profiles = await getProfiles(household.id);
    return apiOk({
      household: { id: household.id },
      // De PIN-hash gaat er NOOIT uit; alleen of er één IS, want daar past de app zijn UI op aan.
      // pin_hash is '' of null zolang de eigenaar er geen heeft ingesteld (rows.ts) — Boolean vangt beide.
      pinIngesteld: Boolean(household.pin_hash),
      profiles: publiekeVorm(
        profiles.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,
          age_band: p.age_band,
          avatar_hue: p.avatar_hue,
          daily_limit_minutes: p.daily_limit_minutes,
        })),
      ),
    });
  } catch {
    return apiError(503, 'upstream_unavailable', 'Profielen tijdelijk niet op te halen.');
  }
}
