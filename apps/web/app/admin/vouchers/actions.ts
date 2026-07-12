'use server';

import { revalidatePath } from 'next/cache';
import { createVouchers, setVoucherStatus } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';

export interface CreateVoucherState {
  error: string | null;
  createdCodes: string[] | null;
}

/** Minting vouchers is money-adjacent (grants free access) — admin role and up. */
export async function createVoucherAction(_prev: CreateVoucherState, formData: FormData): Promise<CreateVoucherState> {
  const { user } = await requireAdmin('admin');

  const durationDays = Number(formData.get('durationDays'));
  const count = Number(formData.get('count') ?? '1');
  const maxRedemptions = Number(formData.get('maxRedemptions') ?? '1');
  const sponsorLabel = String(formData.get('sponsorLabel') ?? '').trim() || null;
  const expiresRaw = String(formData.get('expiresAt') ?? '').trim();

  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
    return { error: 'Duration must be between 1 and 3650 days.', createdCodes: null };
  }
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    return { error: 'Batch size must be between 1 and 500.', createdCodes: null };
  }
  if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 10000) {
    return { error: 'Max redemptions must be a positive number.', createdCodes: null };
  }
  const expiresAt = expiresRaw ? new Date(expiresRaw).toISOString() : null;
  if (expiresRaw && Number.isNaN(new Date(expiresRaw).getTime())) {
    return { error: 'Invalid expiry date.', createdCodes: null };
  }

  try {
    const created = await createVouchers(
      { planId: null, durationDays, maxRedemptions, expiresAt, sponsorLabel, count },
      user.id,
    );
    revalidatePath('/admin/vouchers');
    return { error: null, createdCodes: created.map((v) => v.code) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not create vouchers.', createdCodes: null };
  }
}

export async function disableVoucherAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('admin');
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await setVoucherStatus(id, 'disabled', user.id);
  revalidatePath('/admin/vouchers');
}
