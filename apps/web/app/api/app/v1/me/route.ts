/**
 * GET /api/app/v1/me — wie ben ik, en mag ik kijken?
 *
 * Het enige endpoint in deze eerste schijf dat inloggen vereist. Geeft bewust een SMAL
 * antwoord: id, e-mail, naam en of er een actief abonnement is. Geen adres, geen
 * betaalgegevens, geen Stripe-id's — een app-antwoord is makkelijk te onderscheppen en
 * B82 (privacy) geldt hier net zo goed.
 */
import { hasActiveEntitlement } from '@albunyaan/core/data';
import { getApiMember, apiOk, apiError, apiUnauthorized } from '../../../../../lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const member = await getApiMember(req);
  if (!member) return apiUnauthorized();
  try {
    const active = await hasActiveEntitlement(member.id);
    return apiOk({
      member: {
        id: member.id,
        email: member.email ?? null,
        full_name: member.full_name ?? null,
      },
      entitlement: { active },
    });
  } catch {
    return apiError(503, 'upstream_unavailable', 'Toegangsstatus tijdelijk niet op te halen.');
  }
}
