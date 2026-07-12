'use server';

import { getServerSupabase } from '../../lib/supabase/server';

export interface CouponFormState {
  status: 'idle' | 'redeemed' | 'error';
  message: string | null;
}

const CODE_RE = /^[A-Z0-9]{5}-[A-Z0-9]{5}$/;

/**
 * Calls the redeem_voucher(p_code) RPC (0004) via the member's OWN session —
 * the function is SECURITY DEFINER but keyed off auth.uid() internally, and
 * granted to `authenticated` only (anon/public revoked), so this must go
 * through the request-scoped client, never the service-role one.
 *
 * The RPC returns null (not an error) for every failure case — wrong code,
 * expired, exhausted, already redeemed by this person — deliberately, so a
 * single generic message here doesn't let anyone probe which reason applied.
 */
export async function redeemCouponAction(_prev: CouponFormState, formData: FormData): Promise<CouponFormState> {
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    return { status: 'error', message: 'That doesn’t look like a voucher code — check the format (e.g. ABCDE-FGHJK).' };
  }

  const supabase = await getServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { status: 'error', message: 'Your session expired — please log in again and retry.' };
  }

  const { data, error } = await supabase.rpc('redeem_voucher', { p_code: code });
  if (error) {
    return { status: 'error', message: 'Something went wrong redeeming that code. Please try again in a moment.' };
  }
  if (!data) {
    return { status: 'error', message: 'That code is invalid, expired, already used, or already redeemed on this account.' };
  }

  return { status: 'redeemed', message: null };
}
