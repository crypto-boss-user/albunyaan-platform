/**
 * Uscreen metadata export — Phase 1 skeleton (PRD §4a/§4b).
 *
 * ONE resumable manifest (worker/lib/manifest.ts, PRD §4b) drives BOTH strategies:
 *
 *   --strategy=api     Publisher API pager (PRD §4a — preferred; BLOCKED on
 *                      Phase 0 ⑤ confirming the endpoints exist on our plan).
 *                      Reads USCREEN_API_KEY from env. Endpoint paths below are
 *                      typed STUBS marked TO-VALIDATE.
 *   --strategy=scrape  Admin scraper fallback (PRD §4b) on the copied base
 *                      (worker/uscreen-scraper.ts): persisted session,
 *                      login_lost / scrape_broken fail-honest statuses.
 *
 * Two-stage, both strategies:
 *   1. enumerate — list pages → all external_ids into the manifest (`pending`).
 *      The stage-1 total is itself a validation number (PRD §7).
 *   2. detail    — per manifest row: fetch, save RAW to worker/raw/<entity>/<id>.(json|html)
 *      BEFORE parsing (parser fixes never re-fetch), then parse → upsert.
 *
 * Politeness: ~2s between requests, strictly sequential. ~6,700 details ≈ 4h.
 *
 * --dry-run prints the plan and returns BEFORE ANY NETWORK CALL — the network
 * dependencies (deps) are not even touched in dry-run mode; tests rely on that.
 *
 * HARD GUARD (README + PRD header): do NOT run non-dry at scale until the
 * Uscreen contract has been reviewed (Phase 0 ③).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openManifest, type ExportManifest, type ManifestStats } from './lib/manifest.ts';
import { createDb, type Db, type DbRow } from './lib/db.ts';
import {
  openAdminSession,
  probeText,
  politeDelay,
  logScrapeStatus,
  POLITENESS_MS,
  type SessionResult,
} from './uscreen-scraper.ts';

const WORKER_DIR = path.dirname(fileURLToPath(import.meta.url));

export type Strategy = 'api' | 'scrape';
export type Entity = 'videos' | 'categories' | 'collections' | 'filters' | 'authors' | 'plans';
export const ENTITIES: Entity[] = ['videos', 'categories', 'collections', 'filters', 'authors', 'plans'];

// ── typed endpoint / page stubs — ⚠️ TO-VALIDATE in Phase 0 (⑤ API, ③ contract) ──

const API_BASE = 'https://www.uscreen.io/publisher_api/v1'; // TO-VALIDATE: base + version

interface ApiEntityConfig {
  /** Paged list endpoint; `{page}` placeholder. TO-VALIDATE against real API docs. */
  list: string;
  /** Detail endpoint per id; null ⇒ list payload is already complete. */
  detail: ((id: string) => string) | null;
  /** Field in list items holding Uscreen's id. */
  idField: string;
  table: string;
}

const API_ENTITIES: Record<Entity, ApiEntityConfig> = {
  videos: { list: `${API_BASE}/videos?page={page}`, detail: (id) => `${API_BASE}/videos/${id}`, idField: 'id', table: 'videos' },
  categories: { list: `${API_BASE}/categories?page={page}`, detail: null, idField: 'id', table: 'categories' },
  collections: { list: `${API_BASE}/collections?page={page}`, detail: (id) => `${API_BASE}/collections/${id}`, idField: 'id', table: 'collections' },
  filters: { list: `${API_BASE}/filters?page={page}`, detail: null, idField: 'id', table: 'filters' },
  authors: { list: `${API_BASE}/authors?page={page}`, detail: null, idField: 'id', table: 'authors' },
  plans: { list: `${API_BASE}/offers?page={page}`, detail: null, idField: 'id', table: 'plans' },
};

interface ScrapeEntityConfig {
  /** Admin list page; `{page}` placeholder. TO-VALIDATE on first supervised run. */
  listUrl: string;
  detailUrl: (id: string) => string;
  /** Selector candidates whose href/data-id yields the external id — self-checked. */
  listItemProbes: string[];
  table: string;
}

const ADMIN_BASE = 'https://app.uscreen.tv/manage';

const SCRAPE_ENTITIES: Record<Entity, ScrapeEntityConfig> = {
  videos: {
    listUrl: `${ADMIN_BASE}/content/videos?page={page}`,
    detailUrl: (id) => `${ADMIN_BASE}/content/videos/${id}`,
    listItemProbes: ['a[href*="/content/videos/"]', '[data-testid="video-row"] a'],
    table: 'videos',
  },
  categories: {
    listUrl: `${ADMIN_BASE}/content/categories?page={page}`,
    detailUrl: (id) => `${ADMIN_BASE}/content/categories/${id}`,
    listItemProbes: ['a[href*="/content/categories/"]'],
    table: 'categories',
  },
  collections: {
    listUrl: `${ADMIN_BASE}/content/collections?page={page}`,
    detailUrl: (id) => `${ADMIN_BASE}/content/collections/${id}`,
    listItemProbes: ['a[href*="/content/collections/"]'],
    table: 'collections',
  },
  filters: {
    listUrl: `${ADMIN_BASE}/content/filters?page={page}`,
    detailUrl: (id) => `${ADMIN_BASE}/content/filters/${id}`,
    listItemProbes: ['a[href*="/content/filters/"]'],
    table: 'filters',
  },
  authors: {
    listUrl: `${ADMIN_BASE}/content/authors?page={page}`,
    detailUrl: (id) => `${ADMIN_BASE}/content/authors/${id}`,
    listItemProbes: ['a[href*="/content/authors/"]'],
    table: 'authors',
  },
  plans: {
    listUrl: `${ADMIN_BASE}/offers?page={page}`,
    detailUrl: (id) => `${ADMIN_BASE}/offers/${id}`,
    listItemProbes: ['a[href*="/offers/"]'],
    table: 'plans',
  },
};

// ── injectable network deps (tests inject throwing fakes; dry-run never touches them) ──

export interface ExportDeps {
  fetchJson(url: string, headers: Record<string, string>): Promise<unknown>;
  openSession(startUrl: string): Promise<SessionResult>;
  delay(ms: number): Promise<void>;
}

function realDeps(): ExportDeps {
  return {
    async fetchJson(url, headers) {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res.json();
    },
    openSession: openAdminSession,
    delay: politeDelay,
  };
}

// ── run ──────────────────────────────────────────────────────────────────────

export interface ExportOptions {
  strategy: Strategy;
  entities?: Entity[];
  dryRun: boolean;
  manifestPath?: string;
  rawDir?: string;
  db?: Db;
  deps?: ExportDeps;
  maxPages?: number; // stage-1 safety valve
}

export interface ExportRunResult {
  status: 'dry_run' | 'ok' | 'login_lost' | 'scrape_broken' | 'blocked';
  strategy: Strategy;
  entities: Entity[];
  planned: string[]; // human-readable plan lines (dry-run) / executed steps
  stats: Record<string, ManifestStats>;
  detail?: string;
}

export async function runExport(opts: ExportOptions): Promise<ExportRunResult> {
  const entities = opts.entities ?? ENTITIES;
  const manifestPath = opts.manifestPath ?? path.join(WORKER_DIR, 'state', 'export-manifest.jsonl');
  const rawDir = opts.rawDir ?? path.join(WORKER_DIR, 'raw');
  const manifest = openManifest(manifestPath);
  const planned: string[] = [];

  const statsAll = () =>
    Object.fromEntries(entities.map((e) => [e, manifest.stats(e)])) as Record<string, ManifestStats>;

  // ---- DRY RUN: plan only. Returns HERE, before deps/db/network exist. ----
  for (const entity of entities) {
    if (opts.strategy === 'api') {
      const cfg = API_ENTITIES[entity];
      planned.push(
        `[api] ${entity}: page ${cfg.list} (auth: USCREEN_API_KEY) → enumerate ids → ` +
          `${cfg.detail ? `detail ${cfg.detail('<id>')}` : 'list payload is detail'} → ${rawDir}/${entity}/<id>.json → upsert ${cfg.table}`,
      );
    } else {
      const cfg = SCRAPE_ENTITIES[entity];
      planned.push(
        `[scrape] ${entity}: session ${cfg.listUrl} → enumerate via [${cfg.listItemProbes.join(' | ')}] → ` +
          `detail ${cfg.detailUrl('<id>')} → raw ${rawDir}/${entity}/<id>.html BEFORE parse → upsert ${cfg.table}`,
      );
    }
  }
  planned.push(`politeness ${POLITENESS_MS}ms sequential; manifest ${manifestPath}; resume = pending/failed only`);
  if (opts.dryRun) {
    return { status: 'dry_run', strategy: opts.strategy, entities, planned, stats: statsAll() };
  }

  // ---- LIVE PATHS BELOW — hard-gated on Phase 0 (contract review). ----
  const deps = opts.deps ?? realDeps();
  const db = opts.db ?? createDb();

  if (opts.strategy === 'api') {
    const apiKey = process.env.USCREEN_API_KEY;
    if (!apiKey) {
      return { status: 'blocked', strategy: 'api', entities, planned, stats: statsAll(), detail: 'USCREEN_API_KEY not set — API strategy cannot run (and endpoint paths are still TO-VALIDATE, Phase 0 ⑤).' };
    }
    for (const entity of entities) {
      await runApiEntity(entity, { manifest, db, deps, rawDir, apiKey, maxPages: opts.maxPages ?? 1000 });
    }
    await db.flush();
    return { status: 'ok', strategy: 'api', entities, planned, stats: statsAll() };
  }

  // scrape
  for (const entity of entities) {
    const out = await runScrapeEntity(entity, { manifest, db, deps, rawDir });
    if (out !== 'ok') {
      await db.flush();
      return { status: out, strategy: 'scrape', entities, planned, stats: statsAll(), detail: `aborted at entity ${entity}` };
    }
  }
  await db.flush();
  return { status: 'ok', strategy: 'scrape', entities, planned, stats: statsAll() };
}

interface EntityCtx {
  manifest: ExportManifest;
  db: Db;
  deps: ExportDeps;
  rawDir: string;
}

// ── API strategy (PRD §4a) ───────────────────────────────────────────────────

async function runApiEntity(
  entity: Entity,
  ctx: EntityCtx & { apiKey: string; maxPages: number },
): Promise<void> {
  const cfg = API_ENTITIES[entity];
  const headers = { Authorization: `Bearer ${ctx.apiKey}`, Accept: 'application/json' }; // TO-VALIDATE: auth scheme
  const entityRawDir = path.join(ctx.rawDir, entity);
  fs.mkdirSync(entityRawDir, { recursive: true });

  // Stage 1 — enumerate list pages into the manifest.
  for (let page = 1; page <= ctx.maxPages; page += 1) {
    const url = cfg.list.replace('{page}', String(page));
    const body = await ctx.deps.fetchJson(url, headers);
    const rawPath = path.join(entityRawDir, `list-page-${page}.json`);
    fs.writeFileSync(rawPath, JSON.stringify(body, null, 2)); // raw to disk before any interpretation
    const items = Array.isArray(body) ? body : (body as any)?.items ?? (body as any)?.data;
    if (!Array.isArray(items)) {
      throw new Error(`[api:${entity}] unexpected list shape at ${url} — endpoint stub needs validation (Phase 0 ⑤). Raw saved to ${rawPath}; nothing guessed.`);
    }
    if (items.length === 0) break; // last page
    ctx.manifest.enumerate(entity, items.map((it: any) => String(it[cfg.idField])));
    await ctx.deps.delay(POLITENESS_MS);
  }

  // Stage 2 — per manifest row (pending/failed only): fetch detail → raw → parse → upsert.
  let row;
  while ((row = ctx.manifest.next(entity))) {
    const id = row.external_id;
    try {
      let detail: unknown;
      const rawPath = path.join(entityRawDir, `${id}.json`);
      if (cfg.detail) {
        detail = await ctx.deps.fetchJson(cfg.detail(id), headers);
        fs.writeFileSync(rawPath, JSON.stringify(detail, null, 2)); // BEFORE parsing
        ctx.manifest.mark(entity, id, 'fetched', { rawPath });
        await ctx.deps.delay(POLITENESS_MS);
      } else {
        // list payload is the detail; raw already on disk from stage 1
        ctx.manifest.mark(entity, id, 'fetched');
        detail = null;
      }
      const parsed = parseApiDetail(entity, id, detail);
      ctx.manifest.mark(entity, id, 'parsed');
      await ctx.db.upsert(cfg.table, [parsed]);
      ctx.manifest.mark(entity, id, 'upserted');
    } catch (err) {
      ctx.manifest.mark(entity, id, 'failed', { error: String(err) });
    }
  }
}

/**
 * Minimal honest mapping: id + raw always; field mapping filled in once real
 * payloads exist (raw is on disk — parser iteration never re-fetches).
 */
function parseApiDetail(entity: Entity, id: string, detail: unknown): DbRow {
  const d = (detail ?? {}) as Record<string, unknown>;
  return {
    source: 'uscreen',
    external_id: id,
    ...(typeof d.title === 'string' ? { title: d.title } : {}),
    ...(typeof d.name === 'string' ? { name: d.name } : {}),
    raw: detail,
  };
}

// ── scrape strategy (PRD §4b, fail-honest) ──────────────────────────────────

async function runScrapeEntity(entity: Entity, ctx: EntityCtx): Promise<'ok' | 'login_lost' | 'scrape_broken'> {
  const cfg = SCRAPE_ENTITIES[entity];
  const entityRawDir = path.join(ctx.rawDir, entity);
  fs.mkdirSync(entityRawDir, { recursive: true });

  const sessionResult = await ctx.deps.openSession(cfg.listUrl.replace('{page}', '1'));
  if (sessionResult.status !== 'ok') return 'login_lost';
  const { browser, page } = sessionResult.session;

  try {
    // Stage 1 — crawl list pages, enumerate ids (self-checked selectors).
    for (let pageNo = 1; ; pageNo += 1) {
      if (pageNo > 1) {
        await ctx.deps.delay(POLITENESS_MS);
        await page.goto(cfg.listUrl.replace('{page}', String(pageNo)), { waitUntil: 'domcontentloaded', timeout: 45_000 });
      }
      const ids = await enumerateListPage(page, cfg);
      if (ids === null) {
        logScrapeStatus('scrape_broken', `[${entity}] list probes matched nothing on page ${pageNo} — layout changed or selectors not yet validated. Update SCRAPE_ENTITIES in worker/uscreen-export.ts. Nothing written.`);
        // Page 1 with zero matches = broken selectors; later pages = end of listing.
        if (pageNo === 1) return 'scrape_broken';
        break;
      }
      if (ids.length === 0) break; // ran off the end of pagination
      ctx.manifest.enumerate(entity, ids);
    }

    // Stage 2 — detail per manifest row: RAW HTML to disk BEFORE parsing.
    let row;
    while ((row = ctx.manifest.next(entity))) {
      const id = row.external_id;
      try {
        await ctx.deps.delay(POLITENESS_MS);
        await page.goto(cfg.detailUrl(id), { waitUntil: 'domcontentloaded', timeout: 45_000 });
        const rawPath = path.join(entityRawDir, `${id}.html`);
        fs.writeFileSync(rawPath, await page.content()); // raw first, always
        ctx.manifest.mark(entity, id, 'fetched', { rawPath });

        // Parse self-check — probes TO-VALIDATE on the first supervised run.
        // Until validated this fails LOUD per item (designed behavior; raw is
        // already saved, so validating selectors never re-fetches).
        const title = await probeText(page, ['h1', '[data-testid="content-title"]']);
        if (title === null) {
          ctx.manifest.mark(entity, id, 'failed', { error: 'scrape_broken: title probe matched nothing — validate selectors, then re-run (raw HTML already on disk)' });
          continue;
        }
        ctx.manifest.mark(entity, id, 'parsed');
        await ctx.db.upsert(cfg.table, [{ source: 'uscreen', external_id: id, title, raw: { raw_path: rawPath } }]);
        ctx.manifest.mark(entity, id, 'upserted');
      } catch (err) {
        ctx.manifest.mark(entity, id, 'failed', { error: String(err) });
      }
    }
    return 'ok';
  } finally {
    await browser.close();
  }
}

/** Extract external ids from a list page via the probe selectors; null = self-check failed. */
async function enumerateListPage(page: import('playwright-core').Page, cfg: ScrapeEntityConfig): Promise<string[] | null> {
  for (const sel of cfg.listItemProbes) {
    const hrefs: (string | null)[] = await page.locator(sel).evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    const ids = hrefs
      .map((h) => h?.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null)
      .filter((x): x is string => x !== null);
    if (ids.length > 0) return [...new Set(ids)];
  }
  return null;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const get = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const strategy = get('strategy') as Strategy | undefined;
  const dryRun = args.includes('--dry-run');
  const entityArg = get('entity') ?? get('entities');
  const entities = entityArg ? (entityArg.split(',') as Entity[]) : undefined;

  if (strategy !== 'api' && strategy !== 'scrape') {
    console.error('usage: uscreen-export --strategy=api|scrape [--entity=videos,categories,…] [--dry-run]');
    process.exit(1);
  }
  for (const e of entities ?? []) {
    if (!ENTITIES.includes(e)) {
      console.error(`unknown entity "${e}" — valid: ${ENTITIES.join(', ')}`);
      process.exit(1);
    }
  }
  runExport({ strategy, entities, dryRun }).then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'ok' && result.status !== 'dry_run') process.exitCode = 2;
  });
}
