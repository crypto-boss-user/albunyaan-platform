/**
 * Datalaag van de admin, met een demo-aftakking.
 *
 * Elke admin-pagina importeert hier vandaan in plaats van rechtstreeks uit `@albunyaan/core/data`.
 * Buiten demo-modus is dit een doorgeefluik: `export *` levert exact dezelfde functies, types en
 * constanten. In demo-modus geven de LEESfuncties verzonnen gegevens terug (zie demo-data.ts).
 *
 * **Schrijffuncties staan hier bewust niet in.** Dat hoeft niet: elke admin-action roept
 * `requireAdmin('editor')` of `requireAdmin('admin')` aan (26 van de 26, gemeten 2026-09-17), en de
 * demo-bezoeker heeft de laagste rol `support`. De bestaande, al gereviewde rolpoort weigert dus
 * elke schrijfactie vóór de datalaag in beeld komt. Een tweede slot hier zou een tweede plek zijn
 * waar iemand een gat kan laten vallen.
 *
 * De typen komen uit `typeof core.fn`, zodat een wijziging in core hier een typefout geeft in
 * plaats van stilzwijgend afwijkende demo-gegevens.
 */
import * as core from '@albunyaan/core/data';
import { isDemo } from './demo';
import {
  DEMO_CATEGORIES, DEMO_COLLECTIONS, DEMO_FILTERS, DEMO_PEOPLE, DEMO_PLANS,
  DEMO_RESOURCES, DEMO_TEAM, DEMO_VIDEOS, DEMO_VOUCHERS, demoAnalytics,
} from './demo-data';

export * from '@albunyaan/core/data';

/** Kleine hulp: pagineer een lijst zoals de echte laag dat doet. */
function pagineer<T>(rijen: T[], page = 1, perPage = 30) {
  const p = Math.max(1, page);
  const pp = Math.min(100, Math.max(1, perPage));
  return { rows: rijen.slice((p - 1) * pp, p * pp), total: rijen.length, page: p, perPage: pp };
}

/** DemoPersoon → de vorm die de admin verwacht (AdminPersonListRow = PersonRow + extra's). */
function naarPersonListRow(p: (typeof DEMO_PEOPLE)[number]) {
  return {
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    auth_user_id: null,
    legacy_cohort: null,
    stripe_customer_id: null,
    created_at: p.signup_at ?? '2026-01-01T00:00:00.000Z',
    language: p.language,
    signup_at: p.signup_at,
    raw: { Status: p.status, Lifetime: (p.lifetime_cents / 100).toFixed(2) },
  };
}

function bevat(haystack: string | null | undefined, naald?: string) {
  if (!naald?.trim()) return true;
  return (haystack ?? '').toLowerCase().includes(naald.trim().toLowerCase());
}

/* ---------- video's ---------- */

export const listVideosForAdmin: typeof core.listVideosForAdmin = async (params = {}) => {
  if (!isDemo()) return core.listVideosForAdmin(params);
  let rijen = DEMO_VIDEOS.filter((v) => bevat(v.title, params.q));
  if (params.status) rijen = rijen.filter((v) => v.status === params.status);
  const p = pagineer(rijen, params.page, params.perPage);
  return { videos: p.rows, total: p.total, page: p.page, perPage: p.perPage } as Awaited<ReturnType<typeof core.listVideosForAdmin>>;
};

export const getVideoForAdmin: typeof core.getVideoForAdmin = async (id) => {
  if (!isDemo()) return core.getVideoForAdmin(id);
  const v = DEMO_VIDEOS.find((x) => x.id === id) ?? null;
  return v as Awaited<ReturnType<typeof core.getVideoForAdmin>>;
};

export const searchVideosForAdmin: typeof core.searchVideosForAdmin = async (q, limit = 20) => {
  if (!isDemo()) return core.searchVideosForAdmin(q, limit);
  return DEMO_VIDEOS.filter((v) => bevat(v.title, q)).slice(0, limit) as Awaited<ReturnType<typeof core.searchVideosForAdmin>>;
};

export const getVideoCategoryIds: typeof core.getVideoCategoryIds = async (videoId) =>
  isDemo() ? [DEMO_CATEGORIES[0].id] : core.getVideoCategoryIds(videoId);

export const getVideoFilterValueIds: typeof core.getVideoFilterValueIds = async (videoId) =>
  isDemo() ? [DEMO_FILTERS[0].values[0].id] : core.getVideoFilterValueIds(videoId);

/* ---------- collecties ---------- */

export const listCollectionsForAdmin: typeof core.listCollectionsForAdmin = async (params = {}) => {
  if (!isDemo()) return core.listCollectionsForAdmin(params);
  let rijen = DEMO_COLLECTIONS.filter((c) => bevat(c.title, params.q));
  if (params.status) rijen = rijen.filter((c) => c.status === params.status);
  const lijst = rijen.map((c) => ({
    id: c.id, title: c.title, slug: c.slug, cover_url: null,
    created_at: c.created_at, published: c.status === 'published', item_count: c.item_count,
  }));
  return pagineer(lijst, params.page, params.perPage ?? 12);
};

export const getCollectionForAdmin: typeof core.getCollectionForAdmin = async (id) => {
  if (!isDemo()) return core.getCollectionForAdmin(id);
  const c = DEMO_COLLECTIONS.find((x) => x.id === id);
  if (!c) return null;
  return {
    id: c.id, external_id: c.external_id, source: c.source, title: c.title, slug: c.slug,
    description: c.description ?? '', cover_url: null, created_at: c.created_at,
    categoryIds: [DEMO_CATEGORIES[1].id],
    items: DEMO_VIDEOS.slice(0, c.item_count).map((v, i) => ({
      video_id: v.id, position: i + 1, title: v.title, slug: v.slug, status: v.status,
      thumbnail_url: v.thumbnail_url, duration_seconds: v.duration_seconds,
    })),
  };
};

export const searchCollectionsForAdmin: typeof core.searchCollectionsForAdmin = async (q, limit = 20) => {
  if (!isDemo()) return core.searchCollectionsForAdmin(q, limit);
  return DEMO_COLLECTIONS.filter((c) => bevat(c.title, q)).slice(0, limit) as Awaited<ReturnType<typeof core.searchCollectionsForAdmin>>;
};

/* ---------- categorieën ---------- */

export const listCategoriesForAdmin: typeof core.listCategoriesForAdmin = async () =>
  isDemo() ? DEMO_CATEGORIES : core.listCategoriesForAdmin();

export const getAllCategories: typeof core.getAllCategories = async () => {
  if (!isDemo()) return core.getAllCategories();
  return DEMO_CATEGORIES.map((c) => ({ id: c.id, external_id: c.external_id, name: c.name, slug: c.slug, position: c.position })) as Awaited<ReturnType<typeof core.getAllCategories>>;
};

export const getCategoryForAdmin: typeof core.getCategoryForAdmin = async (id) => {
  if (!isDemo()) return core.getCategoryForAdmin(id);
  const c = DEMO_CATEGORIES.find((x) => x.id === id);
  if (!c) return null;
  return {
    ...c,
    items: DEMO_VIDEOS.slice(0, c.item_count).map((v, i) => ({
      id: `${c.id}-item-${i + 1}`, video_id: v.id, collection_id: null, position: i + 1,
      kind: 'video' as const, title: v.title, status: v.status, published_at: v.created_at,
    })),
  };
};

/* ---------- mensen ---------- */

export const listPeopleForAdmin: typeof core.listPeopleForAdmin = async (params = {}) => {
  if (!isDemo()) return core.listPeopleForAdmin(params);
  let rijen = DEMO_PEOPLE.filter((p) => bevat(p.full_name, params.q) || bevat(p.email, params.q));
  if (params.status) rijen = rijen.filter((p) => p.status === params.status);
  if (params.type) rijen = rijen.filter((p) => p.type === params.type);
  return pagineer(rijen.map(naarPersonListRow), params.page, params.perPage ?? 25);
};

export const getMemberDetail: typeof core.getMemberDetail = async (id) => {
  if (!isDemo()) return core.getMemberDetail(id);
  const p = DEMO_PEOPLE.find((x) => x.id === id);
  if (!p) return null;
  return { person: naarPersonListRow(p), entitlements: [], household: null, profiles: [] };
};

/* ---------- plannen, coupons, bijlagen, filters, team ---------- */

export const listPlansForAdmin: typeof core.listPlansForAdmin = async (q) =>
  isDemo() ? DEMO_PLANS.filter((p) => bevat(p.title, q)) : core.listPlansForAdmin(q);

export const getPlanForAdmin: typeof core.getPlanForAdmin = async (id) =>
  isDemo() ? (DEMO_PLANS.find((p) => p.id === id) ?? null) : core.getPlanForAdmin(id);

export const countSubscriptionsPerPlan: typeof core.countSubscriptionsPerPlan = async () =>
  isDemo() ? new Map() : core.countSubscriptionsPerPlan();

export const listVouchers: typeof core.listVouchers = async (limit = 100) =>
  isDemo() ? DEMO_VOUCHERS.slice(0, limit) : core.listVouchers(limit);

export const listResourcesForAdmin: typeof core.listResourcesForAdmin = async () =>
  isDemo() ? DEMO_RESOURCES : core.listResourcesForAdmin();

export const listFiltersForAdmin: typeof core.listFiltersForAdmin = async () =>
  isDemo() ? DEMO_FILTERS : core.listFiltersForAdmin();

export const listPlatformAdmins: typeof core.listPlatformAdmins = async () =>
  isDemo() ? DEMO_TEAM : core.listPlatformAdmins();

/* ---------- instellingen en cijfers ---------- */

export const getAdminSettings: typeof core.getAdminSettings = async (keys) => {
  if (!isDemo()) return core.getAdminSettings(keys);
  // Leeg = de pagina toont overal zijn standaardwaarde; dat is precies wat een verse demo hoort te zijn.
  return {} as Awaited<ReturnType<typeof core.getAdminSettings>>;
};

export const getAnalyticsCounts: typeof core.getAnalyticsCounts = async (since, prevSince, tot) =>
  isDemo() ? demoAnalytics() : core.getAnalyticsCounts(since, prevSince, tot);

export const countSignupsSince: typeof core.countSignupsSince = async (sinceIso, totIso) =>
  isDemo() ? 14 : core.countSignupsSince(sinceIso, totIso);

export const getRecentAuditEntries: typeof core.getRecentAuditEntries = async (limit = 15) => {
  if (!isDemo()) return core.getRecentAuditEntries(limit);
  return [
    { id: 'demo-a1', actor_auth_user_id: 'demo-editor', action: 'video.update', entity: 'videos', entity_id: DEMO_VIDEOS[0].id, created_at: '2026-09-17T09:12:00.000Z' },
    { id: 'demo-a2', actor_auth_user_id: 'demo-owner', action: 'plan.create', entity: 'plans', entity_id: DEMO_PLANS[0].id, created_at: '2026-09-16T16:40:00.000Z' },
  ].slice(0, limit);
};
