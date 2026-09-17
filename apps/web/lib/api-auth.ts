/**
 * Bearer-token authenticatie voor de app-API (`/api/app/v1/...`).
 *
 * Het web draait op cookies (`lib/session.ts`); een telefoonapp kan dat niet en stuurt
 * `Authorization: Bearer <supabase access token>`. Dit bestand is de tegenhanger van
 * `getAuthUser`/`getMember` voor die route, en niets meer.
 *
 * Twee regels die niet mogen verschuiven:
 *  1. De token wordt geverifieerd door Supabase zelf (`auth.getUser(token)`) met de ANON-sleutel.
 *     Wij ontleden of vertrouwen nooit zelf een JWT, en de service-role-sleutel komt hier niet voor —
 *     die omzeilt alle RLS en mag nooit in het bereik van een clientverzoek staan
 *     (change-control regel 8).
 *  2. Fail-closed: elke fout, elk ontbrekend stuk en elke onbekende vorm levert `null` op, en de
 *     aanroeper maakt daar 401 van. Nooit "bij twijfel toelaten".
 */
import type { User } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { getPersonByAuthUserId, type PersonRow } from '@albunyaan/core/data';

/** Session-less anon client, enkel om een meegestuurde token te laten verifiëren. */
function getTokenVerifierClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * De token uit de Authorization-header, of null.
 * Accepteert uitsluitend de vorm `Bearer <token>` (schema hoofdletterongevoelig, precies één spatie
 * ertussen na trimmen). Alles anders is null — geen token uit een querystring of cookie.
 */
export function getBearerToken(req: Request): string | null {
  const raw = req.headers.get('authorization');
  if (!raw) return null;
  const m = /^Bearer[ \t]+(\S+)$/i.exec(raw.trim());
  if (!m) return null;
  const token = m[1];
  // Grofmazige vormcontrole: een JWT heeft drie punt-gescheiden delen. Weigert lege of
  // afgeknotte waarden vóór we er een netwerkverzoek aan wagen.
  if (token.split('.').length !== 3) return null;
  return token;
}

/** De geverifieerde auth-gebruiker achter de bearer-token, of null. */
export async function getApiUser(req: Request): Promise<User | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  const supabase = getTokenVerifierClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/**
 * Het lid (people-rij) achter de bearer-token, of null — null zowel voor anonieme verzoeken
 * als voor auth-gebruikers zonder gekoppelde people-rij.
 */
export async function getApiMember(req: Request): Promise<PersonRow | null> {
  const user = await getApiUser(req);
  if (!user) return null;
  return getPersonByAuthUserId(user.id).catch(() => null);
}

/** Standaard JSON-omhulsel, zodat elke route hetzelfde teruggeeft. */
export function apiOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, { status: 200, ...init });
}

export function apiError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** 401 met een vaste vorm, zodat de app er één pad voor heeft. */
export function apiUnauthorized(): Response {
  return apiError(401, 'unauthorized', 'Geldige Authorization: Bearer <token> vereist.');
}
