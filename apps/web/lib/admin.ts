/**
 * Admin gate — WS7 security foundation. Server-only.
 *
 * THE rule: every /admin page AND every admin server action calls
 * requireAdmin() first. Layouts are NOT a security boundary in Next (they can
 * be skipped on client navigation, and server actions never touch them), so
 * the layout calling it is UX, not protection — each leaf enforces it again.
 *
 * Gate order (fail-closed at every step):
 *   1. no auth session            → redirect /login
 *   2. not on the platform_admins roster → 404 (NOT 403 — the admin surface's
 *      existence is not revealed to members/visitors)
 *   3. roster row but session is aal1    → redirect to TOTP step-up (or first-
 *      time enrollment when no verified factor exists yet)
 *   4. outranked for the required role   → 404 (same non-disclosure)
 */
import { notFound, redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { getPlatformAdmin, type PlatformAdminRow } from '@albunyaan/core/data';
import { getAuthUser } from './session';
import { getServerSupabase } from './supabase/server';

export type AdminRole = PlatformAdminRow['role'];

/** owner ⊃ admin ⊃ editor ⊃ support. */
const ROLE_RANK: Record<AdminRole, number> = { owner: 4, admin: 3, editor: 2, support: 1 };

/** Heeft deze rol minstens `minRole`? (UI-hulp om knoppen uit te zetten die de action toch zou weigeren — AD 2.2, koude review I-2.) */
export function hasRole(role: AdminRole, minRole: AdminRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export interface AdminContext {
  user: User;
  admin: PlatformAdminRow;
}

/**
 * Auth user + roster row, WITHOUT the aal2 requirement. Only for the MFA
 * enrollment/step-up pages and their actions — everything else uses
 * requireAdmin(). Exported separately so the full gate below stays the
 * obvious default import.
 */
export async function requireAdminPreMfa(): Promise<AdminContext> {
  const user = await getAuthUser();
  if (!user) redirect('/login');
  const admin = await getPlatformAdmin(user.id);
  if (!admin) notFound();
  return { user, admin };
}

/** Full admin gate: session + roster + aal2 (TOTP) + role rank. */
export async function requireAdmin(minRole: AdminRole = 'support'): Promise<AdminContext> {
  const ctx = await requireAdminPreMfa();

  const supabase = await getServerSupabase();
  const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // Fail CLOSED but honestly: an aal read error with a live session is a
  // transient auth-service problem — surfacing it beats a misleading 404 or a
  // redirect loop into the MFA pages.
  if (error || !aal) throw new Error(`admin gate: could not determine MFA assurance level${error ? `: ${error.message}` : ''}`);

  if (aal.currentLevel !== 'aal2') {
    // nextLevel 'aal2' = a verified factor exists, the session just hasn't
    // stepped up; anything else = no verified factor yet → enroll first.
    redirect(aal.nextLevel === 'aal2' ? '/admin/mfa' : '/admin/mfa/enroll');
  }

  if (ROLE_RANK[ctx.admin.role] < ROLE_RANK[minRole]) notFound();
  return ctx;
}
