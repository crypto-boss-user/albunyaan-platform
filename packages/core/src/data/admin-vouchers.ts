/**
 * Admin voucher management — server-side only (service role). Minting/listing
 * only: redemption is member-initiated via the redeem_voucher() RPC (0004),
 * which stays the only writer of voucher_redemptions/redemption_count.
 */
import { randomBytes } from 'node:crypto';
import { createServiceClient } from './client';
import { logAdminAction } from './admins';
import type { VoucherRow } from './rows';

const VOUCHER_COLS =
  'id, code, plan_id, duration_days, max_redemptions, redemption_count, status, expires_at, sponsor_label, created_at';

/** Unambiguous alphabet (no 0/O/1/I/L) — vouchers get read aloud/typed by hand. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode(): string {
  const bytes = randomBytes(10);
  let code = '';
  for (let i = 0; i < 10; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export async function listVouchers(limit = 100): Promise<VoucherRow[]> {
  const db = createServiceClient();
  const { data, error } = await db.from('vouchers').select(VOUCHER_COLS).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as VoucherRow[];
}

export interface CreateVoucherInput {
  planId: string | null;
  durationDays: number;
  maxRedemptions: number;
  expiresAt: string | null;
  sponsorLabel: string | null;
  /** How many distinct codes to mint in this batch (each max_redemptions=1 unless maxRedemptions>1 was explicit for a shared code). */
  count: number;
}

/** Mint `count` new voucher codes with identical terms. Collision-safe (unique constraint + retry). */
export async function createVouchers(input: CreateVoucherInput, actorAuthUserId: string): Promise<VoucherRow[]> {
  const db = createServiceClient();
  const created: VoucherRow[] = [];

  for (let i = 0; i < input.count; i++) {
    let attempt = 0;
    for (;;) {
      attempt += 1;
      const { data, error } = await db
        .from('vouchers')
        .insert({
          code: generateCode(),
          plan_id: input.planId,
          duration_days: input.durationDays,
          max_redemptions: input.maxRedemptions,
          expires_at: input.expiresAt,
          sponsor_label: input.sponsorLabel,
        })
        .select(VOUCHER_COLS)
        .single();
      if (!error) { created.push(data as VoucherRow); break; }
      if (error.code === '23505' && attempt < 5) continue; // code collision — vanishingly rare, just retry
      throw new Error(`createVouchers: ${error.message}`);
    }
  }

  await logAdminAction({
    actorAuthUserId,
    action: 'voucher.create',
    entity: 'vouchers',
    entityId: created.map((v) => v.code).join(','),
    after: { ...input, createdCount: created.length },
  });
  return created;
}

/** Disable a voucher (status='disabled') — blocks any FUTURE redemption; past redemptions stand. */
export async function setVoucherStatus(id: string, status: 'active' | 'disabled', actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data: before } = await db.from('vouchers').select(VOUCHER_COLS).eq('id', id).maybeSingle();
  const { error } = await db.from('vouchers').update({ status }).eq('id', id);
  if (error) throw new Error(`setVoucherStatus: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'voucher.set_status', entity: 'vouchers', entityId: id, before, after: { status } });
}
