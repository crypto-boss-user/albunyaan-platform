/**
 * Plannenbeheer voor de admin (AD 2.2 lezen, AD 2.3 schrijven) — server-side only (service role). De `plans`-tabel (0001) is het
 * eigen model; koppeling aan een betaalprovider (stripe_price_id) volgt de betaalbeslissing en wordt hier nooit gezet. Ledenkoppeling
 * (subscriptions/entitlements) blijft ongemoeid (founder 2026-09-07, vraag 7).
 */
import { createServiceClient } from './client';
import { logAdminAction } from './admins';
import type { PlanRow } from './rows';

export interface AdminPlanRow extends PlanRow {
  description: string;
  trial_days: number;
  raw: { volgorde?: number; apps_badge?: string | null; members_gemeten?: number | null; uscreen_id?: string } | null;
  created_at: string;
}

const ADMIN_PLAN_COLS = 'id, external_id, source, title, description, platform, amount_cents, currency, billing_period, trial_days, visibility, stripe_price_id, raw, created_at';

/** Alle plannen in beheervolgorde (raw.volgorde, dan titel) — de tabel is klein (11), geen paginering; telling in de test via REST. */
export async function listPlansForAdmin(q?: string): Promise<AdminPlanRow[]> {
  const db = createServiceClient();
  let query = db.from('plans').select(ADMIN_PLAN_COLS).order('title').limit(1000);
  if (q?.trim()) query = query.ilike('title', `%${q.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as AdminPlanRow[];
  return rows.sort((a, b) => (a.raw?.volgorde ?? 9999) - (b.raw?.volgorde ?? 9999) || a.title.localeCompare(b.title));
}

export async function getPlanForAdmin(id: string): Promise<AdminPlanRow | null> {
  const db = createServiceClient();
  const { data, error } = await db.from('plans').select(ADMIN_PLAN_COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as AdminPlanRow | null;
}

/** Leden per plan uit `subscriptions` (status active/trialing) — 0 rijen tot de ledenmigratie; exacte telling per plan via één query + groepering in code (tabel klein). */
export async function countSubscriptionsPerPlan(): Promise<Map<string, { members: number; trial: number }>> {
  const db = createServiceClient();
  const out = new Map<string, { members: number; trial: number }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('subscriptions').select('plan_id, status').in('status', ['active', 'trialing']).range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as { plan_id: string | null; status: string }[]) {
      if (!r.plan_id) continue;
      const cur = out.get(r.plan_id) ?? { members: 0, trial: 0 };
      cur.members += 1;
      if (r.status === 'trialing') cur.trial += 1;
      out.set(r.plan_id, cur);
    }
    if ((data ?? []).length < 1000) return out;
  }
}

export interface PlanInput {
  title: string;
  description: string;
  billing_period: PlanRow['billing_period'];
  amount_cents: number;
  trial_days: number;
  visibility: PlanRow['visibility'];
}

const BILLING = new Set<PlanRow['billing_period']>(['monthly', 'quarterly', 'semiannual', 'yearly', 'onetime']); // 'onetime' = CHECK 0001 (koude review AD 2.2 M-6)

function checkInput(input: PlanInput): void {
  if (!input.title.trim() || input.title.length > 200) throw new Error('Plan name is required (max 200).');
  if (input.description.length > 5000) throw new Error('Description too long (max 5000).');
  if (!BILLING.has(input.billing_period)) throw new Error('Invalid billing period.');
  if (!Number.isInteger(input.amount_cents) || input.amount_cents < 0 || input.amount_cents > 100_000_00) throw new Error('Price must be between 0.00 and 100,000.00.');
  if (!Number.isInteger(input.trial_days) || input.trial_days < 0 || input.trial_days > 365) throw new Error('Free trial: 0–365 days.');
  if (input.visibility !== 'public' && input.visibility !== 'private') throw new Error('Invalid visibility.');
}

/** Nieuw plan (source 'admin', external_id = eigen uuid-achtige sleutel); nooit een stripe_price_id. */
export async function createPlanAdmin(input: PlanInput, actorAuthUserId: string): Promise<AdminPlanRow> {
  checkInput(input);
  const db = createServiceClient();
  const { data: maxRow } = await db.from('plans').select('raw').order('created_at', { ascending: false }).limit(1000);
  const volgorde = 1 + Math.max(0, ...((maxRow ?? []) as { raw: { volgorde?: number } | null }[]).map((r) => r.raw?.volgorde ?? 0));
  const { data, error } = await db
    .from('plans')
    .insert({
      external_id: `admin:${crypto.randomUUID()}`,
      source: 'admin',
      title: input.title.trim(),
      description: input.description,
      platform: 'web',
      amount_cents: input.amount_cents,
      currency: 'EUR',
      billing_period: input.billing_period,
      trial_days: input.trial_days,
      visibility: input.visibility,
      raw: { bron: 'admin AD 2.3', volgorde },
    })
    .select(ADMIN_PLAN_COLS)
    .single();
  if (error) throw new Error(`createPlanAdmin: ${error.message}`);
  const row = data as AdminPlanRow;
  await logAdminAction({ actorAuthUserId, action: 'plan.create', entity: 'plans', entityId: row.id, after: input });
  return row;
}

export async function updatePlanAdmin(id: string, input: PlanInput, actorAuthUserId: string): Promise<void> {
  checkInput(input);
  const db = createServiceClient();
  const before = await getPlanForAdmin(id);
  if (!before) throw new Error('updatePlanAdmin: plan not found');
  // fail-closed (adversarial AD 2.3 N-1): bij een betaalprovider-koppeling zijn prijs/interval daar vastgelegd; /join toont de DB-prijs, Stripe int de zijne
  if (before.stripe_price_id && (input.amount_cents !== before.amount_cents || input.billing_period !== before.billing_period)) throw new Error('Cannot change price or billing period: plan is linked to a payment provider.');
  const { error } = await db
    .from('plans')
    .update({ title: input.title.trim(), description: input.description, billing_period: input.billing_period, amount_cents: input.amount_cents, trial_days: input.trial_days, visibility: input.visibility, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`updatePlanAdmin: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'plan.update', entity: 'plans', entityId: id, before, after: input });
}

/** Verwijderen kan alleen als niets naar het plan verwijst (subscriptions/entitlements/vouchers) — fail-closed vóór de FK-fout. */
export async function deletePlanAdmin(id: string, actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const before = await getPlanForAdmin(id);
  if (!before) throw new Error('deletePlanAdmin: plan not found');
  if (before.stripe_price_id) throw new Error('Cannot delete: plan is linked to a payment provider.'); // fail-closed (koude review AD 2.3 M-4): webhook resolveert op stripe_price_id
  for (const table of ['subscriptions', 'entitlements', 'vouchers']) {
    const { count, error } = await db.from(table).select('id', { count: 'exact', head: true }).eq('plan_id', id);
    if (error) throw new Error(`deletePlanAdmin: ${table}: ${error.message}`);
    if ((count ?? 0) > 0) throw new Error(`Cannot delete: ${count} ${table} row(s) reference this plan.`);
  }
  const { error } = await db.from('plans').delete().eq('id', id);
  if (error) throw new Error(`deletePlanAdmin: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'plan.delete', entity: 'plans', entityId: id, before });
}
