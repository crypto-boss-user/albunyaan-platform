'use server';

/**
 * Auth server actions — magic-link login (TOKEN_HASH flow, scanner-proof
 * interstitial), sign-out, and email change. All verification happens here,
 * server-side; nothing auth-critical runs in the browser.
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { syncPersonEmail } from '@albunyaan/core/data';
import { getOtpRequestClient, getServerSupabase } from '../../lib/supabase/server';
import { PARENT_COOKIE, PROFILE_COOKIE, getAuthUser } from '../../lib/session';

export interface AuthFormState {
  status: 'idle' | 'sent' | 'error';
  message: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Only ever redirect within our own app (no open redirects via ?next=). */
function safeNext(raw: unknown): string {
  const v = typeof raw === 'string' ? raw : '';
  return v.startsWith('/') && !v.startsWith('//') ? v : '/account';
}

// ── /login — request a magic link ────────────────────────────────────────────

export async function requestMagicLinkAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  // Session-less implicit-flow client → plain (non-pkce) token hash in the email.
  // shouldCreateUser:false is DELIBERATE — public signup stays closed until the
  // subscriber re-import (WS8). Unknown emails get the friendly message below.
  const { error } = await getOtpRequestClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });

  if (error) {
    // GoTrue answers "Signups not allowed for otp" (otp_disabled) for unknown emails.
    if (error.code === 'otp_disabled' || /signups? not allowed/i.test(error.message)) {
      return {
        status: 'error',
        message: 'This email has no Albunyaan account yet — membership signup opens soon.',
      };
    }
    if (error.status === 429) {
      return { status: 'error', message: 'Too many attempts — please wait a moment and try again.' };
    }
    return { status: 'error', message: 'Could not send the login link. Please try again.' };
  }

  return { status: 'sent', message: email };
}

// ── /auth/confirm — verify the token from the interstitial POST ─────────────

export async function confirmAuthAction(formData: FormData): Promise<void> {
  const tokenHash = String(formData.get('token_hash') ?? '');
  const rawType = String(formData.get('type') ?? '');
  const next = safeNext(formData.get('next'));
  // 'email' = magic-link login; 'email_change' = double-confirm email change.
  const type = rawType === 'email_change' ? 'email_change' : 'email';

  if (!tokenHash) redirect('/login?error=invalid-link');

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error || !data.user) {
    redirect(type === 'email_change' ? '/account?error=confirm-failed' : '/login?error=confirm-failed');
  }

  if (type === 'email_change' && data.user.email) {
    // Keep people.email in step with the auth email (service client, matched on
    // auth_user_id). With double confirmation this runs on BOTH confirms; the
    // second one writes the final new address. Never blocks the redirect.
    await syncPersonEmail(data.user.id, data.user.email);
    revalidatePath('/account');
    redirect('/account?notice=email-updated');
  }

  redirect(next);
}

// ── /account — change login email (double-confirm via /auth/confirm) ────────

export async function changeEmailAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getAuthUser();
  if (!user) return { status: 'error', message: 'You are signed out — log in again first.' };

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }
  if (email === (user.email ?? '').toLowerCase()) {
    return { status: 'error', message: 'That is already your login email.' };
  }

  // Direct GoTrue call with the member's bearer token instead of the ssr
  // client's updateUser: the ssr client is pinned to the PKCE flow, which
  // would bind the email-change tokens to THIS browser. A plain PUT /user
  // keeps them TOKEN_HASH based — confirmable from any device via /auth/confirm.
  const supabase = await getServerSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { status: 'error', message: 'You are signed out — log in again first.' };

  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY ?? '',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    return { status: 'error', message: 'Could not start the email change. Please try again.' };
  }
  return {
    status: 'sent',
    message:
      'Confirmation links were sent to BOTH your current and your new address — open each email and press Continue to finish.',
  };
}

// ── sign out ─────────────────────────────────────────────────────────────────

export async function signOutAction(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete(PROFILE_COOKIE);
  jar.delete(PARENT_COOKIE);
  revalidatePath('/', 'layout');
  redirect('/');
}
