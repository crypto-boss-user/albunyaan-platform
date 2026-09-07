/**
 * Tellingen voor de admin-Home en Analytics (AD 2.1/2.5) — server-side only (service role). Alleen exacte tellingen via
 * Content-Range (`count: 'exact'`, head-verzoek): geen rijen ophalen, dus geen 1000-rij-clamp (CLAUDE.md).
 */
import { createServiceClient } from './client';

/** Aantal personen met signup_at ≥ `sinceIso` (Uscreen "Sign Ups" = nieuwe aanmeldingen in de periode). */
export async function countSignupsSince(sinceIso: string): Promise<number> {
  const db = createServiceClient();
  const { count, error } = await db.from('people').select('id', { count: 'exact', head: true }).gte('signup_at', sinceIso);
  if (error) throw error;
  return count ?? 0;
}
