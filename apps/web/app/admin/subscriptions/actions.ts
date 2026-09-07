'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createPlanAdmin, deletePlanAdmin, updatePlanAdmin, type PlanInput } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import { UUID_RE, type FormState } from '../../../lib/admin-form';
import { BILLING_OPTIONS } from './plan-form';

export type PlanFormState = FormState;

function lees(formData: FormData): PlanInput | string {
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '');
  const billing = String(formData.get('billing_period') ?? '') as PlanInput['billing_period'];
  const priceStr = String(formData.get('price') ?? '').trim().replace(',', '.');
  const price = Number(priceStr);
  if (!/^\d+(\.\d{1,2})?$/.test(priceStr) || !Number.isFinite(price)) return 'Price must be a number with at most two decimals.';
  const trialOn = formData.get('free_trial') === 'on';
  const trialRaw = String(formData.get('trial_period') ?? '').trim();
  if (trialOn && !/^\d+$/.test(trialRaw)) return 'Free trial: enter the number of days.'; // aan + leeg zou stil 0 worden (adversarial N-4)
  const trialDays = trialOn ? Number(trialRaw) : 0;
  const visibility = String(formData.get('visibility') ?? '') as PlanInput['visibility'];
  if (!BILLING_OPTIONS.some((b) => b.key === billing) && billing !== 'onetime') return 'Choose a billing period.'; // onetime = bestaande CHECK-waarde, alleen behouden (N-3)
  return { title, description, billing_period: billing, amount_cents: Math.round(price * 100), trial_days: trialDays, visibility };
}

export async function createPlanAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const { user } = await requireAdmin('admin');
  const input = lees(formData);
  if (typeof input === 'string') return { error: input, saved: false };
  let id: string;
  try { id = (await createPlanAdmin(input, user.id)).id; } catch (err) { return { error: err instanceof Error ? err.message : 'Could not create plan.', saved: false }; }
  revalidatePath('/admin/subscriptions');
  redirect(`/admin/subscriptions/${id}/edit?created=1`);
}

export async function updatePlanAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const { user } = await requireAdmin('admin');
  const id = String(formData.get('id') ?? '');
  if (!UUID_RE.test(id)) return { error: 'Invalid plan id.', saved: false };
  const input = lees(formData);
  if (typeof input === 'string') return { error: input, saved: false };
  try { await updatePlanAdmin(id, input, user.id); } catch (err) { return { error: err instanceof Error ? err.message : 'Could not save plan.', saved: false }; }
  revalidatePath('/admin/subscriptions');
  revalidatePath(`/admin/subscriptions/${id}/edit`);
  return { error: null, saved: true };
}

export async function deletePlanAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin('admin');
  const id = String(formData.get('plan_id') ?? '');
  if (!UUID_RE.test(id)) return;
  await deletePlanAdmin(id, user.id);
  revalidatePath('/admin/subscriptions');
  redirect('/admin/subscriptions');
}
