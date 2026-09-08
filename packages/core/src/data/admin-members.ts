/**
 * Admin member lookup — server-side only (service role). Read-only surface for
 * support: list/filter people, view a member's entitlements + household.
 * Billing MUTATIONS (grant/revoke access) go through admin-vouchers.ts or the
 * Stripe dashboard — support staff can look, not silently rewrite billing.
 *
 * AD 1.4 (2026-09-06): People › All in de Uscreen-vorm (AD0-inventaris §2.2) — gepagineerde lijst (25) met de gemeten kolommen
 * (naam/e-mail, Tags, Status, Lifetime, Creation date) en de filters user type/status, gelezen uit de Uscreen-export in `people.raw`
 * (Status, Segment, Tags, Lifetime, Lead Source, UTM Source, Subscription Plan…). Bewerken van leden = T2 (ledenmigratie) — niet hier.
 */
import { escapeLike } from './admin-content';
import { createServiceClient } from './client';
import { getEntitlementsForPerson } from './entitlements';
import { getHouseholdByOwner, getProfiles } from './parental';
import type { EntitlementWithPlan, HouseholdRow, PersonRow, ProfileRow } from './rows';

const PERSON_COLS = 'id, email, full_name, auth_user_id, legacy_cohort, stripe_customer_id, email_change_requested_at';
const PEOPLE_LIST_COLS = `${PERSON_COLS}, language, signup_at, created_at, raw`;

export interface AdminMemberSummary extends PersonRow {
  created_at: string;
}

/** Uscreen People-export zoals de importeur hem in `people.raw` bewaart (alleen de gelezen velden). */
export interface UscreenPersonRaw {
  Status?: string;
  Segment?: string;
  Tags?: string;
  Lifetime?: string;
  'Lead Source'?: string;
  'UTM Source'?: string;
  'Subscription Plan'?: string;
  'Subscription Created at'?: string;
  'Next invoice date'?: string;
  'Canceled at'?: string;
  'Churned at date'?: string;
  'Created on date'?: string;
  'Creation Source'?: string;
  'Email Marketing & News Opt-In'?: string;
  'User ID'?: string;
}

export interface AdminPersonListRow extends AdminMemberSummary {
  language: string;
  signup_at: string | null;
  raw: UscreenPersonRaw | null;
}

export const PEOPLE_STATUS_OPTIONS = ['active', 'lead', 'churned', 'new', 'pending_cancellation', 'reactivated', 'on_hold'] as const;
/** Uscreen "Filter by user type": Member (heeft/had een abonnement) vs Lead. Afgeleid uit raw.Status. */
export const PEOPLE_TYPE_OPTIONS = ['member', 'lead'] as const;

export interface AdminPeopleListParams {
  q?: string;
  status?: (typeof PEOPLE_STATUS_OPTIONS)[number];
  type?: (typeof PEOPLE_TYPE_OPTIONS)[number];
  page?: number;
  perPage?: number;
}

/** Gepagineerde ledenlijst (nieuwste eerst op signup_at/created_at), telling exact via Content-Range. */
export async function listPeopleForAdmin(params: AdminPeopleListParams = {}): Promise<{ rows: AdminPersonListRow[]; total: number; page: number; perPage: number }> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 25));
  const from = (page - 1) * perPage;
  const db = createServiceClient();
  let query = db.from('people').select(PEOPLE_LIST_COLS, { count: 'exact' });
  if (params.q?.trim()) {
    // komma en haakjes breken de PostgREST or-syntax (koude review I-2): niet in e-mail/naam nodig → weg
    const pattern = `%${escapeLike(params.q.replace(/[,()]/g, ' '))}%`;
    query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`);
  }
  if (params.status) query = query.eq('raw->>Status', params.status);
  if (params.type === 'lead') query = query.or('raw->>Status.eq.lead,raw->>Status.is.null'); // zonder export-rij = Lead, zoals het detail (koude review I-1)
  if (params.type === 'member') query = query.neq('raw->>Status', 'lead');
  const { data, error, count } = await query.order('signup_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).order('id').range(from, from + perPage - 1);
  if (error) throw error;
  return { rows: (data ?? []) as AdminPersonListRow[], total: count ?? 0, page, perPage };
}

export async function getMemberById(id: string): Promise<AdminPersonListRow | null> {
  const db = createServiceClient();
  const { data, error } = await db.from('people').select(PEOPLE_LIST_COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as AdminPersonListRow | null;
}

export interface AdminMemberDetail {
  person: AdminPersonListRow;
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
