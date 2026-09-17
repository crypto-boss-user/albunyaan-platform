/**
 * Verzonnen gegevens voor de demo-admin. **Hier staat geen enkel echt lid, e-mailadres of bedrag.**
 *
 * Alle namen eindigen op "(demo)" en alle adressen op @example.org, zodat niemand een demoscherm
 * kan aanzien voor productie. De aantallen volgen wél de echte orde van grootte, want een lijst met
 * drie rijen laat niet zien hoe paginering en filters zich houden.
 *
 * Bron van de vorm: de types in packages/core/src/data — verandert daar een veld, dan faalt tsc hier.
 */
import type { User } from '@supabase/supabase-js';
import type {
  AdminCategoryRow, AdminFilter, AdminPlanRow, AdminResourceRow,
  AnalyticsCounts, PlatformAdminListRow, PlatformAdminRow, VoucherRow,
} from '@albunyaan/core/data';

const NU = '2026-09-17T10:00:00.000Z';

/* ---------- identiteit van de demo-bezoeker ---------- */

/**
 * Rol `admin`, bewust niet `support`. Reden: met een lagere rol geeft de rolpoort 404 op de
 * aanmaak-schermen en op Settings › Team, en juist die horen bij de 27 schermen die het team moet
 * beoordelen — een 404 leest als "kapot", niet als "alleen lezen". Gemeten: 3 pagina's eisen `admin`,
 * 2 eisen `editor`, geen enkele eist `owner`. Settings › Team toont in de demo de verzonnen namen
 * uit DEMO_TEAM, dus er lekt geen echt beheerdersadres.
 *
 * Schrijven blijft onmogelijk, en niet door deze rol maar door een EIGEN slot: elke admin-action
 * roept `weigerInDemo()` aan direct na zijn rolcontrole (26 van de 26 acties + de MFA-acties,
 * gemeten 2026-09-17). De bezoeker ziet dus het echte formulier, en krijgt bij opslaan een nette
 * uitleg in plaats van een stille mislukking.
 */
export const DEMO_ADMIN: PlatformAdminRow = {
  auth_user_id: '00000000-0000-4000-8000-000000000001',
  role: 'admin',
  note: 'Demo-bezoeker (kijken mag, opslaan niet)',
};

export const DEMO_USER = {
  id: DEMO_ADMIN.auth_user_id,
  email: 'demo@example.org',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: NU,
} as User;

/* ---------- bouwstenen ---------- */

const ONDERWERPEN = [
  'Tafsir van soera al-Baqarah', 'De vijf zuilen uitgelegd', 'Arabisch voor beginners',
  'Het leven van de Profeet ﷺ', 'Fiqh van het gebed', 'Tajwid stap voor stap',
  'Geschiedenis van al-Andalus', 'Opvoeding in de islam', 'De namen van Allah',
  'Ramadan van dag tot dag', 'Hadith voor het gezin', 'Reis door de Koran',
];
const CATEGORIEN = [
  'Nieuw', 'Koran', 'Tafsir', 'Fiqh', 'Arabisch', 'Kinderen', 'Gezin', 'Geschiedenis',
  'Ramadan', 'Hadith', 'Aqidah', 'Sirah', 'Dawah', 'Lezingen', 'Podcast',
];
const VOORNAMEN = ['Amina', 'Yusuf', 'Fatima', 'Ibrahim', 'Khadija', 'Omar', 'Layla', 'Hamza', 'Sara', 'Idris'];

const slugVan = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'item';

function dagenGeleden(n: number): string {
  return new Date(Date.parse(NU) - n * 86_400_000).toISOString();
}

/* ---------- video's ---------- */

export interface DemoVideo {
  id: string; external_id: string; source: string; title: string; slug: string;
  short_description: string | null; description: string | null;
  thumbnail_url: string | null; thumbnail_hue: number | null; duration_seconds: number | null;
  status: string; access: string | null; age_rating: string | null; created_at: string;
}

export const DEMO_VIDEOS: DemoVideo[] = Array.from({ length: 48 }, (_, i) => {
  const titel = `${ONDERWERPEN[i % ONDERWERPEN.length]} — deel ${Math.floor(i / ONDERWERPEN.length) + 1} (demo)`;
  const status = i % 9 === 0 ? 'draft' : i % 17 === 0 ? 'scheduled' : 'published';
  return {
    id: `demo-video-${String(i + 1).padStart(3, '0')}`,
    external_id: `${900000 + i}`,
    source: 'demo',
    title: titel,
    slug: `${slugVan(titel)}-${i + 1}`,
    short_description: 'Verzonnen omschrijving voor de demo.',
    description: '<p>Deze les bestaat niet. De tekst staat er zodat de opmaak te beoordelen is.</p>',
    thumbnail_url: null,
    thumbnail_hue: (i * 37) % 360,
    duration_seconds: 600 + (i % 12) * 240,
    status,
    access: i % 4 === 0 ? 'free' : 'members',
    age_rating: null,
    created_at: dagenGeleden(i * 3),
  };
});

/* ---------- categorieën, collecties, filters ---------- */

export const DEMO_CATEGORIES: AdminCategoryRow[] = CATEGORIEN.map((naam, i) => ({
  id: `demo-cat-${i + 1}`,
  external_id: `${800000 + i}`,
  name: naam,
  slug: slugVan(naam),
  position: i + 1,
  content_sort: 'manual',
  item_count: 3 + ((i * 7) % 14),
}));

export interface DemoCollection {
  id: string; external_id: string; source: string; title: string; slug: string;
  description: string | null; status: string; item_count: number; created_at: string;
}

export const DEMO_COLLECTIONS: DemoCollection[] = ONDERWERPEN.map((t, i) => ({
  id: `demo-col-${i + 1}`,
  external_id: `${700000 + i}`,
  source: 'demo',
  title: `${t} (demo)`,
  slug: slugVan(t),
  description: 'Verzonnen serie voor de demo.',
  status: i % 5 === 0 ? 'draft' : 'published',
  item_count: 2 + (i % 9),
  created_at: dagenGeleden(i * 11),
}));

export const DEMO_FILTERS: AdminFilter[] = [
  {
    id: 'demo-filter-1', name: 'Type', slug: 'type', volgorde: 1,
    values: ['Lezing', 'Serie', 'Podcast', 'Kort'].map((v, i) => ({
      id: `demo-fv-t${i}`, value: v, slug: slugVan(v), volgorde: i + 1,
    })),
  },
  {
    id: 'demo-filter-2', name: 'Subject', slug: 'subject', volgorde: 2,
    values: ['Koran', 'Fiqh', 'Arabisch', 'Sirah', 'Aqidah'].map((v, i) => ({
      id: `demo-fv-s${i}`, value: v, slug: slugVan(v), volgorde: i + 1,
    })),
  },
];

/* ---------- mensen ---------- */

export interface DemoPersoon {
  id: string; email: string; full_name: string | null; language: string;
  signup_at: string | null; status: string; type: 'member' | 'lead';
  lifetime_cents: number; raw: Record<string, unknown> | null;
}

const STATUSSEN = ['active', 'active', 'active', 'new', 'lead', 'churned', 'reactivated', 'pending_cancellation'];

export const DEMO_PEOPLE: DemoPersoon[] = Array.from({ length: 137 }, (_, i) => {
  const naam = `${VOORNAMEN[i % VOORNAMEN.length]} Demo-${i + 1}`;
  const status = STATUSSEN[i % STATUSSEN.length];
  return {
    id: `demo-person-${String(i + 1).padStart(3, '0')}`,
    email: `lid${i + 1}@example.org`,
    full_name: naam,
    language: ['nl', 'en', 'ar'][i % 3],
    signup_at: dagenGeleden(i * 2 + 1),
    status,
    type: status === 'lead' ? 'lead' : 'member',
    lifetime_cents: status === 'lead' ? 0 : (i % 7) * 1250,
    raw: { Status: status },
  };
});

/* ---------- plannen, coupons, bijlagen, team ---------- */

export const DEMO_PLANS: AdminPlanRow[] = [
  ['Maandelijks (demo)', 995, 'monthly', 0],
  ['Jaarlijks (demo)', 8995, 'yearly', 14],
  ['Student (demo)', 495, 'monthly', 0],
  ['Gezin (demo)', 14995, 'yearly', 30],
].map(([titel, bedrag, periode, proef], i) => ({
  id: `demo-plan-${i + 1}`,
  external_id: `demo:${i + 1}`,
  source: 'demo',
  title: titel as string,
  description: 'Verzonnen abonnement voor de demo.',
  platform: 'web',
  amount_cents: bedrag as number,
  currency: 'EUR',
  billing_period: periode as AdminPlanRow['billing_period'],
  trial_days: proef as number,
  visibility: i === 2 ? 'private' : 'public',
  stripe_price_id: null,
  raw: { volgorde: i + 1, apps_badge: null, members_gemeten: null },
  created_at: dagenGeleden(120 - i * 10),
})) as AdminPlanRow[];

export const DEMO_VOUCHERS: VoucherRow[] = Array.from({ length: 9 }, (_, i) => ({
  id: `demo-voucher-${i + 1}`,
  code: `DEMO${String(i + 1).padStart(3, '0')}`,
  plan_id: DEMO_PLANS[i % DEMO_PLANS.length].id,
  duration_days: [30, 90, 365][i % 3],
  max_redemptions: i % 4 === 0 ? 0 : 25,
  redemption_count: i % 5,
  status: i === 8 ? 'disabled' : 'active',
  expires_at: i % 3 === 0 ? null : dagenGeleden(-60),
} as VoucherRow));

export const DEMO_RESOURCES: AdminResourceRow[] = DEMO_VIDEOS.slice(0, 22).map((v, i) => ({
  video_id: v.id,
  video_title: v.title,
  title: `werkblad-${i + 1}.pdf`,
  extension: 'pdf',
  size: `${200 + i * 37} KB`,
  url: null,
}));

export const DEMO_TEAM: PlatformAdminListRow[] = [
  { auth_user_id: 'demo-owner', role: 'owner', note: 'Eigenaar (demo)', email: 'owner@example.org', created_at: dagenGeleden(300) },
  { auth_user_id: 'demo-editor', role: 'editor', note: 'Redactie (demo)', email: 'editor@example.org', created_at: dagenGeleden(120) },
  // Dezelfde rol als DEMO_ADMIN, anders toont Settings › Team een andere rol dan de bezoeker heeft.
  { auth_user_id: DEMO_ADMIN.auth_user_id, role: DEMO_ADMIN.role, note: DEMO_ADMIN.note, email: 'demo@example.org', created_at: dagenGeleden(10) },
];

/* ---------- afgeleide tellingen ---------- */

export function demoAnalytics(): AnalyticsCounts {
  // Alle statussen die de echte laag oplevert, óók de statussen die in de demodata niet voorkomen.
  // De analytics-pagina indexeert een VASTE lijst en crasht op een ontbrekende sleutel — gemeten 17-09.
  const ALLE = ['lead', 'active', 'new', 'reactivated', 'pending_cancellation', 'on_hold', 'churned', 'trialing', 'paused'];
  const perStatus: Record<string, number> = Object.fromEntries(ALLE.map((k) => [k, 0]));
  for (const p of DEMO_PEOPLE) perStatus[p.status] = (perStatus[p.status] ?? 0) + 1;
  const gepubliceerd = DEMO_VIDEOS.filter((v) => v.status === 'published').length;
  return {
    people: {
      total: DEMO_PEOPLE.length,
      members: DEMO_PEOPLE.filter((p) => p.type === 'member').length,
      leads: DEMO_PEOPLE.filter((p) => p.type === 'lead').length,
      byStatus: perStatus,
    },
    signups: { period: 14, previous: 9 },
    content: {
      videos: DEMO_VIDEOS.length,
      published: gepubliceerd,
      draft: DEMO_VIDEOS.filter((v) => v.status === 'draft').length,
      scheduled: DEMO_VIDEOS.filter((v) => v.status === 'scheduled').length,
      live: 0,
      collections: DEMO_COLLECTIONS.length,
      categories: DEMO_CATEGORIES.length,
      authors: 0,
    },
    subscriptions: { total: 0, active: 0, trialing: 0 },
    vouchers: { total: DEMO_VOUCHERS.length, redemptions: DEMO_VOUCHERS.reduce((s, v) => s + v.redemption_count, 0) },
  };
}
