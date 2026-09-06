/**
 * Admin content structure — server-side only (service role). AD 1.3 (2026-09-06): Collections, Categories, Custom filters en
 * Resources in de Uscreen-vorm (AD0-inventaris §2.1). Volgorde = de position-kolommen van 0001/0013 die de storefront leest;
 * nieuwe plaatsingen gaan naar de TOP van een categorie (Uscreen "New content will be added to the top") en naar het EIND van een
 * collectie-playlist. Elke schrijfactie wordt geauditeerd. Never import this from a public page.
 */
import { createServiceClient } from './client';
import { logAdminAction } from './admins';

/** ILIKE-patroon-escape (één plek; koude review N-1). */
export const escapeLike = (s: string) => s.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'item';

// ── Collections ─────────────────────────────────────────────────────────────

export interface AdminCollectionListRow {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  created_at: string;
  /** Afgeleid (collections hebben geen statuskolom): Published = ≥ 1 published/live aflevering, zoals de storefront-zichtbaarheidsregel. */
  published: boolean;
  item_count: number;
}

/** Collectie-ids met ≥ 1 published/live aflevering (klein: ≈ 200 gepubliceerde video's) — basis van de afgeleide status én het statusfilter. */
async function publishedCollectionIds(): Promise<string[]> {
  const db = createServiceClient();
  const out = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('collection_items').select('collection_id, videos!inner ( status )').in('videos.status', ['published', 'live']).order('id').range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) out.add(r.collection_id as string);
    if ((data ?? []).length < 1000) break;
  }
  return [...out];
}

export async function listCollectionsForAdmin(params: { q?: string; status?: 'published' | 'draft'; page?: number; perPage?: number } = {}): Promise<{ rows: AdminCollectionListRow[]; total: number; page: number; perPage: number }> {
  const page = Math.max(1, params.page ?? 1);
  const perPage = Math.min(100, Math.max(1, params.perPage ?? 12));
  const from = (page - 1) * perPage;
  const db = createServiceClient();
  let query = db.from('collections').select('id, title, slug, raw, created_at, collection_items ( videos ( status ) )', { count: 'exact' });
  if (params.q?.trim()) query = query.ilike('title', `%${escapeLike(params.q)}%`);
  if (params.status) {
    // statusfilter over ALLE collecties (niet alleen de huidige pagina; koude review I-3)
    const pub = await publishedCollectionIds();
    query = params.status === 'published' ? query.in('id', pub) : query.not('id', 'in', `(${pub.join(',')})`);
  }
  const { data, error, count } = await query.order('created_at', { ascending: false }).order('id').range(from, from + perPage - 1);
  if (error) throw error;
  const rows = ((data ?? []) as any[]).map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    cover_url: c.raw?.cover_url ?? null,
    created_at: c.created_at,
    published: (c.collection_items ?? []).some((ci: any) => ci.videos && ['published', 'live'].includes(ci.videos.status)),
    item_count: (c.collection_items ?? []).length,
  }));
  return { rows, total: count ?? 0, page, perPage };
}

export interface AdminCollectionItem {
  video_id: string;
  position: number;
  title: string;
  slug: string;
  status: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
}
export interface AdminCollectionDetail {
  id: string;
  external_id: string;
  source: string;
  title: string;
  slug: string;
  description: string;
  cover_url: string | null;
  created_at: string;
  items: AdminCollectionItem[];
  categoryIds: string[];
}

export async function getCollectionForAdmin(id: string): Promise<AdminCollectionDetail | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('collections')
    .select('id, external_id, source, title, slug, description, raw, created_at, collection_items ( position, videos ( id, title, slug, status, thumbnail_url, duration_seconds ) )')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: cats, error: catErr } = await db.from('category_items').select('category_id').eq('collection_id', id);
  if (catErr) throw catErr;
  const c = data as any;
  const items: AdminCollectionItem[] = (c.collection_items ?? [])
    .filter((ci: any) => ci.videos)
    .map((ci: any) => ({ video_id: ci.videos.id, position: ci.position, title: ci.videos.title, slug: ci.videos.slug, status: ci.videos.status, thumbnail_url: ci.videos.thumbnail_url, duration_seconds: ci.videos.duration_seconds }))
    .sort((a: AdminCollectionItem, b: AdminCollectionItem) => a.position - b.position);
  return { id: c.id, external_id: c.external_id, source: c.source, title: c.title, slug: c.slug, description: c.description, cover_url: c.raw?.cover_url ?? null, created_at: c.created_at, items, categoryIds: (cats ?? []).map((r) => r.category_id as string) };
}

/** Nieuwe collectie via een formulier (Uscreen maakt direct aan; wij vragen eerst de titel — AD0-inventaris §2.1, B83). */
export async function createCollectionAdmin(title: string, actorAuthUserId: string): Promise<{ id: string; slug: string }> {
  const db = createServiceClient();
  const base = slugify(title);
  const suffix = Math.random().toString(36).slice(2, 8);
  const slug = `${base}-${suffix}`;
  const { data, error } = await db.from('collections').insert({ external_id: `admin:${slug}`, source: 'admin', title, slug, description: '' }).select('id, slug').single();
  if (error) throw new Error(`createCollectionAdmin: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'collection.create', entity: 'collections', entityId: data.id, after: { title, slug } });
  return data as { id: string; slug: string };
}

export async function updateCollectionAdmin(id: string, patch: { title?: string; description?: string; cover_url?: string | null }, actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data: before, error: readErr } = await db.from('collections').select('id, title, description, raw').eq('id', id).maybeSingle();
  if (readErr || !before) throw new Error(`updateCollectionAdmin: collection ${id} not found`);
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.cover_url !== undefined) row.raw = { ...(before.raw ?? {}), cover_url: patch.cover_url };
  const { error } = await db.from('collections').update(row).eq('id', id);
  if (error) throw new Error(`updateCollectionAdmin: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'collection.update', entity: 'collections', entityId: id, before, after: patch });
}

export async function deleteCollectionAdmin(id: string, actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data: before, error: readErr } = await db.from('collections').select('id, title, slug, external_id').eq('id', id).maybeSingle();
  if (readErr || !before) throw new Error(`deleteCollectionAdmin: collection ${id} not found`);
  const { error } = await db.from('collections').delete().eq('id', id); // collection_items + category_items cascaden (0001/0013); video's blijven (zoals Uscreen meldt)
  if (error) throw new Error(`deleteCollectionAdmin: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'collection.delete', entity: 'collections', entityId: id, before });
}

/** Playlist-volgorde: `videoIds` moet exact de huidige set zijn (fail-closed), posities worden 1..n. */
export async function setCollectionOrder(collectionId: string, videoIds: string[], actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data: current, error } = await db.from('collection_items').select('id, video_id, position').eq('collection_id', collectionId);
  if (error) throw new Error(`setCollectionOrder: ${error.message}`);
  const byVideo = new Map((current ?? []).map((r) => [r.video_id as string, r]));
  if (videoIds.length !== byVideo.size || videoIds.some((v) => !byVideo.has(v)) || new Set(videoIds).size !== videoIds.length) {
    throw new Error('setCollectionOrder: order does not match the current playlist — reload and try again');
  }
  for (const [i, videoId] of videoIds.entries()) {
    const row = byVideo.get(videoId)!;
    if (row.position === i + 1) continue;
    const { error: upErr } = await db.from('collection_items').update({ position: i + 1, updated_at: new Date().toISOString() }).eq('id', row.id);
    if (upErr) throw new Error(`setCollectionOrder: ${upErr.message}`);
  }
  await logAdminAction({ actorAuthUserId, action: 'collection.reorder', entity: 'collections', entityId: collectionId, before: { order: (current ?? []).sort((a, b) => a.position - b.position).map((r) => r.video_id) }, after: { order: videoIds } });
}

export async function addCollectionItem(collectionId: string, videoId: string, actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const [{ data: coll }, { data: video }] = await Promise.all([
    db.from('collections').select('external_id, source').eq('id', collectionId).maybeSingle(),
    db.from('videos').select('external_id').eq('id', videoId).maybeSingle(),
  ]);
  if (!coll || !video) throw new Error('addCollectionItem: collection or video not found');
  const { data: bestaat } = await db.from('collection_items').select('id').eq('collection_id', collectionId).eq('video_id', videoId).maybeSingle();
  if (bestaat) return; // al in de playlist: geen dubbele rij, geen foutpagina (koude review M-4)
  const { data: last } = await db.from('collection_items').select('position').eq('collection_id', collectionId).order('position', { ascending: false }).limit(1);
  const position = last && last.length ? (last[0].position as number) + 1 : 1;
  const { error } = await db.from('collection_items').insert({ external_id: `${coll.external_id}:${video.external_id}`, source: coll.source, collection_id: collectionId, video_id: videoId, position });
  if (error) throw new Error(`addCollectionItem: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'collection.add_item', entity: 'collections', entityId: collectionId, after: { videoId, position } });
}

export async function removeCollectionItem(collectionId: string, videoId: string, actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data, error } = await db.from('collection_items').delete().eq('collection_id', collectionId).eq('video_id', videoId).select('id');
  if (error) throw new Error(`removeCollectionItem: ${error.message}`);
  if ((data ?? []).length) await logAdminAction({ actorAuthUserId, action: 'collection.remove_item', entity: 'collections', entityId: collectionId, before: { videoId } });
}

/** Titel-zoeker voor "Add video" / "Add content" (max 20, alle statussen). */
export async function searchVideosForAdmin(q: string, limit = 20): Promise<{ id: string; title: string; status: string; thumbnail_url: string | null }[]> {
  if (q.trim().length < 2) return [];
  const db = createServiceClient();
  const { data, error } = await db.from('videos').select('id, title, status, thumbnail_url').ilike('title', `%${escapeLike(q)}%`).order('title').limit(limit);
  if (error) throw error;
  return (data ?? []) as any[];
}
export async function searchCollectionsForAdmin(q: string, limit = 20): Promise<{ id: string; title: string }[]> {
  if (q.trim().length < 2) return [];
  const db = createServiceClient();
  const { data, error } = await db.from('collections').select('id, title').ilike('title', `%${escapeLike(q)}%`).order('title').limit(limit);
  if (error) throw error;
  return (data ?? []) as any[];
}

// ── Category placements (video or collection) ───────────────────────────────

/**
 * Vervang de directe categorie-plaatsingen van één video of collectie. Nieuwe plaatsingen bovenaan (min(position) − 1);
 * verwijderde plaatsingen weg. Geauditeerd met before/after ids. Gebruikt door admin-videos (video) en de collectie-detail.
 */
export async function setCategoryMembership(target: { videoId: string } | { collectionId: string }, categoryIds: string[], actorAuthUserId: string): Promise<{ added: number; removed: number }> {
  const db = createServiceClient();
  const isVideo = 'videoId' in target;
  const targetId = isVideo ? target.videoId : target.collectionId;
  const col = isVideo ? 'video_id' : 'collection_id';
  const { data: row, error: rowErr } = await db.from(isVideo ? 'videos' : 'collections').select('external_id, source').eq('id', targetId).maybeSingle();
  if (rowErr || !row) throw new Error(`setCategoryMembership: ${isVideo ? 'video' : 'collection'} ${targetId} not found`);
  const { data: cur, error: curErr } = await db.from('category_items').select('category_id').eq(col, targetId);
  if (curErr) throw new Error(`setCategoryMembership: ${curErr.message}`);
  const current = new Set((cur ?? []).map((r) => r.category_id as string));
  const wanted = new Set(categoryIds);
  const toAdd = [...wanted].filter((c) => !current.has(c));
  const toRemove = [...current].filter((c) => !wanted.has(c));
  for (const categoryId of toAdd) {
    const { data: cat, error: catErr } = await db.from('categories').select('external_id').eq('id', categoryId).maybeSingle();
    if (catErr || !cat) throw new Error(`setCategoryMembership: category ${categoryId} not found`);
    const { data: top, error: topErr } = await db.from('category_items').select('position').eq('category_id', categoryId).order('position', { ascending: true }).limit(1);
    if (topErr) throw new Error(`setCategoryMembership: ${topErr.message}`);
    const position = top && top.length ? (top[0].position as number) - 1 : 0;
    const { error } = await db.from('category_items').insert({ external_id: `${cat.external_id}:${isVideo ? 'video' : 'collection'}:${row.external_id}`, source: row.source, category_id: categoryId, [col]: targetId, position });
    if (error) throw new Error(`setCategoryMembership: ${error.message}`);
  }
  if (toRemove.length) {
    const { error } = await db.from('category_items').delete().eq(col, targetId).in('category_id', toRemove);
    if (error) throw new Error(`setCategoryMembership: ${error.message}`);
  }
  if (toAdd.length || toRemove.length) {
    await logAdminAction({ actorAuthUserId, action: isVideo ? 'video.categories' : 'collection.categories', entity: isVideo ? 'videos' : 'collections', entityId: targetId, before: { categoryIds: [...current] }, after: { categoryIds: [...wanted] } });
  }
  return { added: toAdd.length, removed: toRemove.length };
}

// ── Categories ──────────────────────────────────────────────────────────────

export const CATEGORY_CONTENT_SORTS = ['manual', 'newest', 'oldest', 'title_asc', 'title_desc', 'popular_7d', 'popular_30d'] as const;
export type CategoryContentSort = (typeof CATEGORY_CONTENT_SORTS)[number];
/** Labels exact zoals gemeten (AD0-inventaris §2.1 "Sort content by"). */
export const CATEGORY_CONTENT_SORT_LABELS: Record<CategoryContentSort, string> = {
  manual: 'Manual', newest: 'Newest first', oldest: 'Oldest first', title_asc: 'Title A→Z', title_desc: 'Title Z→A', popular_7d: 'Popular (7 days)', popular_30d: 'Popular (30 days)',
};

export interface AdminCategoryRow {
  id: string;
  external_id: string;
  name: string;
  slug: string;
  position: number | null;
  content_sort: string | null;
  item_count: number;
}

/** Alle categorieën in site-nav-volgorde met itemtelling (category_items gepagineerd per 1000 — 1540 rijen). */
export async function listCategoriesForAdmin(): Promise<AdminCategoryRow[]> {
  const db = createServiceClient();
  const { data: cats, error } = await db.from('categories').select('id, external_id, name, slug, position, content_sort').order('position', { ascending: true, nullsFirst: false }).order('name');
  if (error) throw error;
  const counts = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await db.from('category_items').select('category_id').order('id').range(from, from + 999); // stabiele volgorde over pagina's (koude review M-2)
    if (e) throw e;
    for (const r of data ?? []) counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
    if ((data ?? []).length < 1000) break;
  }
  return (cats ?? []).map((c) => ({ ...(c as any), item_count: counts.get(c.id) ?? 0 }));
}

export interface AdminCategoryItem {
  id: string;
  video_id: string | null;
  collection_id: string | null;
  position: number;
  kind: 'video' | 'collection';
  title: string;
  status: string; // video: status; collection: 'collection'
  published_at: string | null;
}
export interface AdminCategoryDetail extends AdminCategoryRow {
  items: AdminCategoryItem[];
}

export async function getCategoryForAdmin(id: string): Promise<AdminCategoryDetail | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('categories')
    .select('id, external_id, name, slug, position, content_sort, category_items ( id, position, video_id, collection_id, videos ( title, status, publish_at, created_at ), collections ( title, created_at ) )')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const c = data as any;
  const items: AdminCategoryItem[] = (c.category_items ?? [])
    .map((it: any) => it.videos
      ? { id: it.id, video_id: it.video_id, collection_id: null, position: it.position, kind: 'video' as const, title: it.videos.title, status: it.videos.status, published_at: it.videos.publish_at ?? it.videos.created_at }
      : it.collections ? { id: it.id, video_id: null, collection_id: it.collection_id, position: it.position, kind: 'collection' as const, title: it.collections.title, status: 'collection', published_at: it.collections.created_at } : null)
    .filter(Boolean)
    .sort((a: AdminCategoryItem, b: AdminCategoryItem) => a.position - b.position);
  return { id: c.id, external_id: c.external_id, name: c.name, slug: c.slug, position: c.position, content_sort: c.content_sort, item_count: items.length, items };
}

export async function createCategoryAdmin(name: string, actorAuthUserId: string): Promise<{ id: string }> {
  const db = createServiceClient();
  const { data: last } = await db.from('categories').select('position').order('position', { ascending: false, nullsFirst: false }).limit(1);
  const position = last && last.length && last[0].position != null ? (last[0].position as number) + 1 : 1;
  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await db.from('categories').insert({ external_id: `admin:${slug}`, source: 'admin', name, slug, position, content_sort: 'manual' }).select('id').single();
  if (error) throw new Error(`createCategoryAdmin: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'category.create', entity: 'categories', entityId: data.id, after: { name, slug, position } });
  return data as { id: string };
}

export async function updateCategoryAdmin(id: string, patch: { name?: string; position?: number; content_sort?: CategoryContentSort }, actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data: before, error: readErr } = await db.from('categories').select('id, name, position, content_sort').eq('id', id).maybeSingle();
  if (readErr || !before) throw new Error(`updateCategoryAdmin: category ${id} not found`);
  const { error } = await db.from('categories').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(`updateCategoryAdmin: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'category.update', entity: 'categories', entityId: id, before, after: patch });
}

export async function deleteCategoryAdmin(id: string, actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data: before, error: readErr } = await db.from('categories').select('id, name, slug, position').eq('id', id).maybeSingle();
  if (readErr || !before) throw new Error(`deleteCategoryAdmin: category ${id} not found`);
  const { error } = await db.from('categories').delete().eq('id', id); // category_items cascaden; video's/collecties blijven
  if (error) throw new Error(`deleteCategoryAdmin: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'category.delete', entity: 'categories', entityId: id, before });
}

/** Site-nav-volgorde van categorieën (Reorder-handvatten in de lijst): `ids` = exact alle categorieën (fail-closed). */
export async function setCategoriesOrder(ids: string[], actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data: cur, error } = await db.from('categories').select('id, position');
  if (error) throw new Error(`setCategoriesOrder: ${error.message}`);
  const all = new Set((cur ?? []).map((c) => c.id as string));
  if (ids.length !== all.size || ids.some((i) => !all.has(i)) || new Set(ids).size !== ids.length) throw new Error('setCategoriesOrder: order does not match the current categories — reload and try again');
  for (const [i, id] of ids.entries()) {
    const { error: upErr } = await db.from('categories').update({ position: i + 1, updated_at: new Date().toISOString() }).eq('id', id);
    if (upErr) throw new Error(`setCategoriesOrder: ${upErr.message}`);
  }
  await logAdminAction({ actorAuthUserId, action: 'category.reorder', entity: 'categories', entityId: 'all', before: { order: (cur ?? []).sort((a, b) => (a.position ?? 999) - (b.position ?? 999)).map((c) => c.id) }, after: { order: ids } });
}

/** Content-volgorde binnen een categorie (Manage content, slepen): `itemIds` = exact alle items van die categorie (fail-closed). */
export async function setCategoryItemsOrder(categoryId: string, itemIds: string[], actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data: cur, error } = await db.from('category_items').select('id, position').eq('category_id', categoryId);
  if (error) throw new Error(`setCategoryItemsOrder: ${error.message}`);
  const all = new Set((cur ?? []).map((c) => c.id as string));
  if (itemIds.length !== all.size || itemIds.some((i) => !all.has(i)) || new Set(itemIds).size !== itemIds.length) throw new Error('setCategoryItemsOrder: order does not match the current content — reload and try again');
  for (const [i, id] of itemIds.entries()) {
    const { error: upErr } = await db.from('category_items').update({ position: i + 1, updated_at: new Date().toISOString() }).eq('id', id);
    if (upErr) throw new Error(`setCategoryItemsOrder: ${upErr.message}`);
  }
  await logAdminAction({ actorAuthUserId, action: 'category.reorder_items', entity: 'categories', entityId: categoryId, before: { order: (cur ?? []).sort((a, b) => a.position - b.position).map((c) => c.id) }, after: { order: itemIds } });
}

export async function removeCategoryItem(categoryId: string, itemId: string, actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data, error } = await db.from('category_items').delete().eq('category_id', categoryId).eq('id', itemId).select('id, video_id, collection_id');
  if (error) throw new Error(`removeCategoryItem: ${error.message}`);
  if ((data ?? []).length) await logAdminAction({ actorAuthUserId, action: 'category.remove_item', entity: 'categories', entityId: categoryId, before: data![0] });
}

// ── Custom filters ──────────────────────────────────────────────────────────

export interface AdminFilter {
  id: string;
  name: string;
  slug: string;
  volgorde: number;
  values: { id: string; value: string; slug: string; volgorde: number }[];
}

export async function listFiltersForAdmin(): Promise<AdminFilter[]> {
  const db = createServiceClient();
  const { data, error } = await db.from('filters').select('id, name, slug, raw, filter_values ( id, value, slug, raw )');
  if (error) throw error;
  return ((data ?? []) as any[])
    .map((f) => ({
      id: f.id, name: f.name, slug: f.slug, volgorde: Number(f.raw?.volgorde ?? 999),
      values: (f.filter_values ?? []).map((v: any) => ({ id: v.id, value: v.value, slug: v.slug, volgorde: Number(v.raw?.volgorde ?? 999) })).sort((a: any, b: any) => a.volgorde - b.volgorde || a.value.localeCompare(b.value)),
    }))
    .sort((a, b) => a.volgorde - b.volgorde || a.name.localeCompare(b.name));
}

export async function createFilterAdmin(name: string, values: string[], actorAuthUserId: string): Promise<{ id: string }> {
  const db = createServiceClient();
  const existing = await listFiltersForAdmin();
  const slug = slugify(name);
  if (existing.some((f) => f.slug === slug)) throw new Error(`createFilterAdmin: filter "${name}" already exists`);
  const { data, error } = await db.from('filters').insert({ external_id: `admin:${slug}`, source: 'admin', name, slug, raw: { volgorde: existing.length + 1 } }).select('id').single();
  if (error) throw new Error(`createFilterAdmin: ${error.message}`);
  for (const [i, value] of values.entries()) {
    const vs = `${slugify(value.split(' - ')[0])}-${i + 1}`;
    const { error: e } = await db.from('filter_values').insert({ external_id: `admin:${slug}:${vs}`, source: 'admin', filter_id: data.id, value, slug: vs, raw: { volgorde: i + 1 } });
    if (e) throw new Error(`createFilterAdmin: ${e.message}`);
  }
  await logAdminAction({ actorAuthUserId, action: 'filter.create', entity: 'filters', entityId: data.id, after: { name, values } });
  return data as { id: string };
}

export async function addFilterValueAdmin(filterId: string, value: string, actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data: f, error: fErr } = await db.from('filters').select('slug, filter_values ( id )').eq('id', filterId).maybeSingle();
  if (fErr || !f) throw new Error('addFilterValueAdmin: filter not found');
  const n = ((f as any).filter_values ?? []).length + 1;
  const vs = `${slugify(value.split(' - ')[0])}-${Date.now().toString(36)}`; // uniek, ook na verwijderen (koude review M-4)
  const { error } = await db.from('filter_values').insert({ external_id: `admin:${(f as any).slug}:${vs}:${Date.now()}`, source: 'admin', filter_id: filterId, value, slug: vs, raw: { volgorde: n } });
  if (error) throw new Error(`addFilterValueAdmin: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'filter.add_value', entity: 'filters', entityId: filterId, after: { value } });
}

export async function removeFilterValueAdmin(valueId: string, actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data, error } = await db.from('filter_values').delete().eq('id', valueId).select('id, filter_id, value'); // video_filter_values cascaden
  if (error) throw new Error(`removeFilterValueAdmin: ${error.message}`);
  if ((data ?? []).length) await logAdminAction({ actorAuthUserId, action: 'filter.remove_value', entity: 'filters', entityId: data![0].filter_id, before: data![0] });
}

export async function deleteFilterAdmin(filterId: string, actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const { data, error } = await db.from('filters').delete().eq('id', filterId).select('id, name');
  if (error) throw new Error(`deleteFilterAdmin: ${error.message}`);
  if ((data ?? []).length) await logAdminAction({ actorAuthUserId, action: 'filter.delete', entity: 'filters', entityId: filterId, before: data![0] });
}

/** Filterwaarden van één video (Uscreen "Custom filters: Type · Subject" op het videodetail). */
export async function getVideoFilterValueIds(videoId: string): Promise<string[]> {
  const db = createServiceClient();
  const { data, error } = await db.from('video_filter_values').select('filter_value_id').eq('video_id', videoId);
  if (error) throw error;
  return (data ?? []).map((r) => r.filter_value_id as string);
}
export async function setVideoFilterValues(videoId: string, valueIds: string[], actorAuthUserId: string): Promise<void> {
  const db = createServiceClient();
  const current = new Set(await getVideoFilterValueIds(videoId));
  const wanted = new Set(valueIds.filter(Boolean));
  const toAdd = [...wanted].filter((v) => !current.has(v));
  const toRemove = [...current].filter((v) => !wanted.has(v));
  if (toAdd.length) {
    const { error } = await db.from('video_filter_values').insert(toAdd.map((filter_value_id) => ({ video_id: videoId, filter_value_id })));
    if (error) throw new Error(`setVideoFilterValues: ${error.message}`);
  }
  if (toRemove.length) {
    const { error } = await db.from('video_filter_values').delete().eq('video_id', videoId).in('filter_value_id', toRemove);
    if (error) throw new Error(`setVideoFilterValues: ${error.message}`);
  }
  if (toAdd.length || toRemove.length) await logAdminAction({ actorAuthUserId, action: 'video.filters', entity: 'videos', entityId: videoId, before: { valueIds: [...current] }, after: { valueIds: [...wanted] } });
}

// ── Resources (alleen lezen: videos.resources jsonb, geïmporteerd uit Uscreen) ──

export interface AdminResourceRow {
  video_id: string;
  video_title: string;
  title: string;
  extension: string | null;
  size: string | null;
  url: string | null;
}

/** Alle bijlagen, gepagineerd over de video's met een niet-lege resources-array (76 video's op 2026-09-06). */
export async function listResourcesForAdmin(): Promise<AdminResourceRow[]> {
  const db = createServiceClient();
  const out: AdminResourceRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('videos').select('id, title, resources').neq('resources', '[]').order('title').order('id').range(from, from + 999);
    if (error) throw error;
    for (const v of (data ?? []) as any[]) for (const r of v.resources ?? []) out.push({ video_id: v.id, video_title: v.title, title: r.title ?? '', extension: r.extension ?? null, size: r.size ?? null, url: r.url ?? null });
    if ((data ?? []).length < 1000) break;
  }
  return out;
}
