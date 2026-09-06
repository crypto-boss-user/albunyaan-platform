'use server';

import { revalidatePath } from 'next/cache';
import { VOUCHER_CODE_RE, VOUCHER_NO_LIMIT, createVouchers, setVoucherStatus } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';

export interface CreateVoucherState {
  error: string | null;
  createdCodes: string[] | null;
}

/**
 * Minting vouchers is money-adjacent (grants free access) — admin role and up.
 * AD 1.5: velden in de Uscreen-coupon-vorm (Code · Coupon description = sponsor_label · Never expires/Expires on · No limit/Limit to);
 * de voucher-eigen "Free access duration (days)" blijft (het is wat een voucher hier doet). Batch (count > 1) alleen zonder eigen code.
 */
export async function createVoucherAction(_prev: CreateVoucherState, formData: FormData): Promise<CreateVoucherState> {
  const { user } = await requireAdmin('admin');

  const code = String(formData.get('code') ?? '').trim().toUpperCase() || null;
  if (code && !VOUCHER_CODE_RE.test(code)) return { error: 'Code: 4–32 characters, A–Z, 0–9 and - only.', createdCodes: null };
  const durationDays = Number(formData.get('durationDays'));
  const count = Number(formData.get('count') ?? '1');
  if (code && count !== 1) return { error: 'Batch only without a custom code (one code = one coupon).', createdCodes: null };
  const limit = String(formData.get('limit') ?? 'no_limit');
  const maxRedemptions = limit === 'limit_to' ? Number(formData.get('maxRedemptions') ?? '1') : VOUCHER_NO_LIMIT;
  const sponsorLabel = String(formData.get('sponsorLabel') ?? '').trim() || null;
  const expiresMode = String(formData.get('expires') ?? 'never');
  const expiresRaw = expiresMode === 'expires_on' ? String(formData.get('expiresAt') ?? '').trim() : '';

  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
    return { error: 'Duration must be between 1 and 3650 days.', createdCodes: null };
  }
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    return { error: 'Batch size must be between 1 and 500.', createdCodes: null };
  }
  if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > VOUCHER_NO_LIMIT) {
    return { error: 'Max redemptions must be a positive number.', createdCodes: null };
  }
  if (expiresMode === 'expires_on' && (!/^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) || Number.isNaN(new Date(`${expiresRaw}T23:59:59Z`).getTime()))) {
    return { error: 'Invalid expiry date.', createdCodes: null };
  }
  const expiresAt = expiresRaw ? new Date(`${expiresRaw}T23:59:59Z`).toISOString() : null;

  try {
    const created = await createVouchers(
      { code, planId: null, durationDays, maxRedemptions, expiresAt, sponsorLabel, count },
      user.id,
    );
    revalidatePath('/admin/marketing/coupons');
    return { error: null, createdCodes: created.map((v) => v.code) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not create vouchers.', createdCodes: null };
  }
}

export async function disableVoucherAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('admin');
  const id = String(formData.get('id') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return;
  await setVoucherStatus(id, 'disabled', user.id);
  revalidatePath('/admin/marketing/coupons');
}
