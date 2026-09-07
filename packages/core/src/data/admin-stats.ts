/**
 * Tellingen voor de admin-Home en Analytics (AD 2.1/2.5) — server-side only (service role). Alleen exacte tellingen via
 * Content-Range (`count: 'exact'`, head-verzoek): geen rijen ophalen, dus geen 1000-rij-clamp (CLAUDE.md).
 */
import { createServiceClient } from './client';

/** Aantal personen met signup_at ≥ `sinceIso` (Uscreen "Sign Ups" = nieuwe aanmeldingen in de periode). */
export async function countSignupsSince(sinceIso: string): Promise<number> {
  const db = createServiceClient();
  const { count, error } = await db.from('people').select('id', { count: 'exact', head: true }).gte('signup_at', sinceIso);
  if (error) throw error;
  return count ?? 0;
}

/** Exacte telling (head + count) van één tabel met optionele filters — geen rijen, dus geen 1000-rij-clamp. */
async function tel(table: string, filter?: (q: any) => any): Promise<number> {
  const db = createServiceClient();
  let q = db.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = filter(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export interface AnalyticsCounts {
  /** people totaal, leden/leads (raw.Status), per Uscreen-subscriptiestatus en activiteitsstatus — uit de Uscreen-export in people.raw. */
  people: { total: number; members: number; leads: number; byStatus: Record<string, number> };
  signups: { period: number; previous: number };
  content: { videos: number; published: number; draft: number; scheduled: number; live: number; collections: number; categories: number; authors: number };
  subscriptions: { total: number; active: number; trialing: number };
  vouchers: { total: number; redemptions: number };
}

/** Alle tellingen voor Analytics (AD 2.5) in één keer; elke telling is exact (Content-Range). `since`/`prevSince` = ISO-grenzen van de periode en de vorige periode. */
export async function getAnalyticsCounts(since: string, prevSince: string): Promise<AnalyticsCounts> {
  const STATUSSEN = ['lead', 'active', 'new', 'reactivated', 'pending_cancellation', 'on_hold', 'churned', 'trialing', 'paused'];
  const [total, statusNull, ...perStatus] = await Promise.all([
    tel('people'),
    tel('people', (q) => q.is('raw->>Status', null)),
    ...STATUSSEN.map((s) => tel('people', (q) => q.eq('raw->>Status', s))),
  ]);
  const byStatus: Record<string, number> = Object.fromEntries(STATUSSEN.map((s, i) => [s, perStatus[i]]));
  const leads = byStatus.lead + statusNull; // zonder export-rij = Lead (admin-members.ts, koude review AD 1.4 I-1)
  const [period, previous, videos, published, draft, scheduled, live, collections, categories, authors, subsTotal, subsActive, subsTrial, vouchers, redemptions] = await Promise.all([
    tel('people', (q) => q.gte('signup_at', since)),
    tel('people', (q) => q.gte('signup_at', prevSince).lt('signup_at', since)),
    tel('videos'),
    tel('videos', (q) => q.eq('status', 'published')),
    tel('videos', (q) => q.eq('status', 'draft')),
    tel('videos', (q) => q.eq('status', 'scheduled')),
    tel('videos', (q) => q.eq('status', 'live')),
    tel('collections'),
    tel('categories'),
    tel('authors'),
    tel('subscriptions'),
    tel('subscriptions', (q) => q.eq('status', 'active')),
    tel('subscriptions', (q) => q.eq('status', 'trialing')),
    tel('vouchers'),
    tel('voucher_redemptions'),
  ]);
  return {
    people: { total, members: total - leads, leads, byStatus },
    signups: { period, previous },
    content: { videos, published, draft, scheduled, live, collections, categories, authors },
    subscriptions: { total: subsTotal, active: subsActive, trialing: subsTrial },
    vouchers: { total: vouchers, redemptions },
  };
}
