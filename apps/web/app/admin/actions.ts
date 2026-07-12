'use server';

/**
 * Admin MFA actions — the ONLY writes that elevate a session to aal2.
 *
 * Both gate on requireAdminPreMfa() (session + roster) but deliberately NOT the
 * full aal2 requireAdmin — these actions are how an admin REACHES aal2, so
 * requiring it here would be a deadlock. challengeAndVerify runs in a server
 * action (cookies writable) so the elevated session actually persists.
 */
import { redirect } from 'next/navigation';
import { logAdminAction } from '@albunyaan/core/data';
import { requireAdminPreMfa } from '../../lib/admin';
import { getServerSupabase } from '../../lib/supabase/server';

const CODE_RE = /^\d{6}$/;

/** Verify the 6-digit code against the pending (unverified) TOTP factor → aal2. */
export async function verifyEnrollAction(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const { user } = await requireAdminPreMfa();
  const code = String(formData.get('code') ?? '').trim();
  if (!CODE_RE.test(code)) return { error: 'Enter the 6-digit code from your authenticator app.' };

  const supabase = await getServerSupabase();
  const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
  if (listErr) return { error: 'Could not read your authenticator factors — try again.' };
  // Re-derive the factor server-side (never trust a client-supplied id): the
  // most recent unverified TOTP factor is the one this QR just enrolled. The
  // per-type arrays (data.totp) are verified-only — unverified factors live in
  // data.all.
  const pending = (factors?.all ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'unverified').at(-1);
  if (!pending) redirect('/admin/mfa/enroll'); // nothing to verify — restart enrollment

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: pending.id, code });
  if (error) return { error: 'That code was not accepted. Check your app’s clock and try again.' };

  await logAdminAction({ actorAuthUserId: user.id, action: 'admin.mfa_enrolled', entity: 'platform_admins', entityId: user.id });
  redirect('/admin');
}

/** Step an existing verified factor up to aal2 for this session. */
export async function stepUpAction(
  _prev: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const { user } = await requireAdminPreMfa();
  const code = String(formData.get('code') ?? '').trim();
  if (!CODE_RE.test(code)) return { error: 'Enter the 6-digit code from your authenticator app.' };

  const supabase = await getServerSupabase();
  const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
  if (listErr) return { error: 'Could not read your authenticator factors — try again.' };
  const verified = (factors?.totp ?? [])[0]; // per-type array is verified-only
  if (!verified) redirect('/admin/mfa/enroll'); // no factor to step up — enroll first

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: verified.id, code });
  if (error) return { error: 'That code was not accepted. Check your app’s clock and try again.' };

  await logAdminAction({ actorAuthUserId: user.id, action: 'admin.mfa_stepup', entity: 'platform_admins', entityId: user.id });
  redirect('/admin');
}
