/**
 * Admin member lookup — server-side only (service role). Read-only surface for
 * support: search by email/name, view a member's entitlements + household.
 * Billing MUTATIONS (grant/revoke access) go through admin-vouchers.ts or the
 * Stripe dashboard — support staff can look, not silently rewrite billing.
 */
import { createServiceClient } from './client';
import { getEntitlementsForPerson } from './entitlements';
import { getHouseholdByOwner, getProfiles } from './parental';
import type { EntitlementWithPlan, HouseholdRow, PersonRow, ProfileRow } from './rows';

const PERSON_COLS = 'id, email, full_name, auth_user_id, legacy_cohort, stripe_customer_id, email_change_requested_at';

export interface AdminMemberSummary extends PersonRow {
  created_at: string;
}

/** Search by email or name (ILIKE) — capped, newest first. */
export async function searchMembers(q: string, limit = 30): Promise<AdminMemberSummary[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];
  const db = createServiceClient();
  const pattern = `%${trimmed.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { data, error } = await db
    .from('people')
    .select(`${PERSON_COLS}, created_at`)
    .or(`email.ilike.${pattern},full_name.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AdminMemberSummary[];
}

export async function getMemberById(id: string): Promise<AdminMemberSummary | null> {
  const db = createServiceClient();
  const { data, error } = await db.from('people').select(`${PERSON_COLS}, created_at`).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as AdminMemberSummary | null;
}

export interface AdminMemberDetail {
  person: AdminMemberSummary;
  entitlements: EntitlementWithPlan[];
  household: HouseholdRow | null;
  profiles: ProfileRow[];
}

/** Full support view: entitlements + household + kid profiles, all read-only. */
export async function getMemberDetail(id: string): Promise<AdminMemberDetail | null> {
  const person = await getMemberById(id);
  if (!person) return null;

  const [entitlements, household] = await Promise.all([getEntitlementsForPerson(id), getHouseholdByOwner(id)]);
  const profiles = household ? await getProfiles(household.id) : [];

  return { person, entitlements, household, profiles };
}
