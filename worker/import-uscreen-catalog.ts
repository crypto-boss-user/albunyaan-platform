/**
 * Import the REAL Uscreen catalog into the DB using the REAL structure scraped
 * from the admin (not title-guessing):
 *   ~/.albunyaan-cc/uscreen-videos-rich.jsonl        -> videos (title, thumb, duration, status)
 *   ~/.albunyaan-cc/uscreen-collection-members.jsonl -> collections + ordered collection_items
 *   ~/.albunyaan-cc/uscreen-people.jsonl             -> people
 *
 * Collections carry their real Uscreen id + title + real ordered membership.
 * Deterministic UUIDs → idempotent reruns. source='uscreen'.
 *
 * Run: ALBUNYAAN_DB_DRIVER=supabase (env from ~/.albunyaan-cc/cloud.env) tsx import-uscreen-catalog.ts
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDb, type DbRow } from './lib/db';

const CC = path.join(os.homedir(), '.albunyaan-cc');
const SOURCE = 'uscreen';
const now = new Date().toISOString();

function uuidFor(name: string): string {
  const h = createHash('sha256').update(`albunyaan:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
function hashNum(s: string): number { let n = 0; for (const c of s) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; }
function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function readJsonl(f: string): any[] {
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function durationSeconds(d: string | null): number | null {
  if (!d) return null;
  const p = d.split(':').map(Number); if (p.some(isNaN)) return null;
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
}
const vid = (id: string) => uuidFor(`videos:uscreen:${id}`);

async function main() {
  const db = createDb({ driver: 'supabase' });
  const rich = readJsonl(path.join(CC, 'uscreen-videos-rich.jsonl'));
  const members = readJsonl(path.join(CC, 'uscreen-collection-members.jsonl'));
  const catMembers = readJsonl(path.join(CC, 'uscreen-category-members.jsonl'));
  const people = readJsonl(path.join(CC, 'uscreen-people.jsonl'));
  console.log(`source: ${rich.length} videos, ${members.length} collections, ${catMembers.length} categories, ${people.length} people`);

  const byId = new Map<string, any>();
  for (const v of rich) if (v.id && v.title) byId.set(String(v.id), v);

  const videos: DbRow[] = [];
  const emitVideo = (v: any) => videos.push({
    id: vid(String(v.id)), source: SOURCE, external_id: String(v.id),
    title: v.title, slug: `${slugify(v.title) || 'video'}-${v.id}`,
    duration_seconds: durationSeconds(v.duration), thumbnail_url: v.thumb || null,
    thumbnail_hue: hashNum(String(v.id)) % 360,
    status: v.status === 'draft' ? 'draft' : 'published', access: 'subscription',
    raw: v, created_at: now, updated_at: now,
  });
  // Emit every scraped video (so standalone ones exist too).
  for (const v of byId.values()) emitVideo(v);

  // Real collections + real ordered membership. A membership row may reference a
  // video we haven't scraped yet (enumeration paused mid-way) — emit a minimal
  // stub for it so the FK holds; the rich pass upserts full fields later.
  const collections: DbRow[] = [];
  const collectionItems: DbRow[] = [];
  const emitted = new Set(videos.map((v) => v.external_id as string));
  for (const c of members) {
    if (!c.id || !c.title || !Array.isArray(c.videoIds) || c.videoIds.length === 0) continue;
    const cid = uuidFor(`collections:uscreen:${c.id}`);
    collections.push({
      id: cid, source: SOURCE, external_id: String(c.id),
      title: c.title, slug: `${slugify(c.title) || 'series'}-${c.id}`, description: '',
      raw: { uscreen_id: c.id, count: c.videoIds.length }, created_at: now, updated_at: now,
    });
    c.videoIds.forEach((videoExt: string, i: number) => {
      const ve = String(videoExt);
      if (!emitted.has(ve)) {
        emitted.add(ve);
        videos.push({
          id: vid(ve), source: SOURCE, external_id: ve, title: `(video ${ve})`,
          slug: `video-${ve}`, thumbnail_hue: hashNum(ve) % 360, status: 'published',
          access: 'subscription', raw: { stub: true }, created_at: now, updated_at: now,
        });
      }
      collectionItems.push({
        id: uuidFor(`ci:uscreen:${c.id}:${ve}`), source: SOURCE, external_id: `${c.id}:${ve}`,
        collection_id: cid, video_id: vid(ve), position: i, raw: null, created_at: now, updated_at: now,
      });
    });
  }

  // Real categories + real membership (video_categories link table).
  const categories: DbRow[] = [];
  const videoCategories: DbRow[] = [];
  const vcSeen = new Set<string>();
  for (const c of catMembers) {
    if (!c.id || !c.title) continue;
    const catId = uuidFor(`categories:uscreen:${c.id}`);
    categories.push({
      id: catId, source: SOURCE, external_id: String(c.id),
      name: c.title, slug: `${slugify(c.title) || 'category'}-${c.id}`,
      raw: { uscreen_id: c.id, count: (c.videoIds || []).length }, created_at: now, updated_at: now,
    });
    for (const ve of c.videoIds || []) {
      const v = String(ve);
      if (!emitted.has(v)) {
        emitted.add(v);
        videos.push({ id: vid(v), source: SOURCE, external_id: v, title: `(video ${v})`, slug: `video-${v}`, thumbnail_hue: hashNum(v) % 360, status: 'published', access: 'subscription', raw: { stub: true }, created_at: now, updated_at: now });
      }
      const k = `${catId}:${vid(v)}`;
      if (!vcSeen.has(k)) { vcSeen.add(k); videoCategories.push({ video_id: vid(v), category_id: catId }); }
    }
  }

  const peopleRows: DbRow[] = [];
  for (const p of people) {
    if (!p.email && !p.id) continue;
    peopleRows.push({
      id: uuidFor(`people:uscreen:${p.id || p.email}`), source: SOURCE,
      external_id: String(p.id || p.email),
      email: (p.email || `noemail-${p.id}@unknown.local`).toLowerCase().trim(),
      full_name: null, language: 'en', raw: p, created_at: now, updated_at: now,
    });
  }

  const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
  const push = async (t: string, rows: DbRow[], conflict?: string[]) => {
    let d = 0; for (const c of chunk(rows, 500)) { await db.upsert(t, c, conflict); d += c.length; process.stdout.write(`\r  ${t}: ${d}/${rows.length}`); }
    console.log(`\r  ${t}: ${rows.length} done            `);
  };
  await push('videos', videos);
  await push('collections', collections);
  await push('collection_items', collectionItems);
  await push('categories', categories);
  if (videoCategories.length) await push('video_categories', videoCategories, ['video_id', 'category_id']);
  await push('people', peopleRows);
  console.log('\nDONE:', { videos: videos.length, collections: collections.length, collection_items: collectionItems.length, categories: categories.length, video_categories: videoCategories.length, people: peopleRows.length });
}
main().catch((e) => { console.error(e); process.exit(1); });
