/**
 * Bunny Stream client — the video host we migrate to (replaces Uscreen/Mux).
 * Docs: https://docs.bunny.net/reference/video_createvideo etc.
 *
 * Two ingest modes:
 *  • fetchFromUrl()  — server-to-server: Bunny pulls the video by URL onto its
 *                      own servers. No local bandwidth/disk. Preferred.
 *  • (local upload)  — fallback handled in the pipeline (ffmpeg HLS→MP4 → PUT).
 *
 * Needs env: BUNNY_LIBRARY_ID, BUNNY_API_KEY (Stream library key). Never committed.
 */
const BASE = 'https://video.bunnycdn.com';

export interface BunnyConfig {
  libraryId: string;
  apiKey: string;
}

export function bunnyFromEnv(): BunnyConfig {
  const libraryId = process.env.BUNNY_LIBRARY_ID;
  const apiKey = process.env.BUNNY_API_KEY;
  if (!libraryId || !apiKey) throw new Error('Bunny needs BUNNY_LIBRARY_ID + BUNNY_API_KEY in env');
  return { libraryId, apiKey };
}

function headers(cfg: BunnyConfig) {
  return { AccessKey: cfg.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' };
}

/** Create an empty video object; returns its Bunny guid. */
export async function createVideo(cfg: BunnyConfig, title: string): Promise<string> {
  const res = await fetch(`${BASE}/library/${cfg.libraryId}/videos`, {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`bunny createVideo ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { guid: string };
  return data.guid;
}

/**
 * Ask Bunny to fetch the source URL server-side into an existing video guid.
 * `headers` are forwarded by Bunny to the source (unused for Mux signed URLs).
 * Returns immediately; Bunny encodes asynchronously — poll getVideo() for status.
 */
export async function fetchFromUrl(
  cfg: BunnyConfig,
  guid: string,
  url: string,
  opts?: { title?: string; headers?: Record<string, string> },
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(`${BASE}/library/${cfg.libraryId}/videos/${guid}/fetch`, {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify({ url, ...(opts?.headers ? { headers: opts.headers } : {}) }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 300) };
}

/** Video status: 0 queued,1 processing,2 encoding,3 finished,4 resolution-finished,5 failed. */
export async function getVideo(
  cfg: BunnyConfig,
  guid: string,
): Promise<{ status: number; encodeProgress: number; length: number }> {
  const res = await fetch(`${BASE}/library/${cfg.libraryId}/videos/${guid}`, { headers: headers(cfg) });
  if (!res.ok) throw new Error(`bunny getVideo ${res.status}`);
  const d = (await res.json()) as { status: number; encodeProgress: number; length: number };
  return { status: d.status, encodeProgress: d.encodeProgress, length: d.length };
}

export const BUNNY_STATUS: Record<number, string> = {
  0: 'queued', 1: 'processing', 2: 'encoding', 3: 'finished', 4: 'resolution-finished', 5: 'failed',
};

/**
 * Direct upload of a local file (the working path — Bunny can't fetch Mux HLS).
 * Uses curl -T (--upload-file), which streams the file in chunks and sets
 * Content-Length from disk size. IMPORTANT: --data-binary @file looks similar
 * but reads the WHOLE file into memory first — it OOM-crashed on real videos
 * over ~1GB (silent "out of memory" failure, discovered mid-migration). -T is
 * the correct flag for streaming a file via PUT; never use --data-binary here.
 */
export async function uploadFile(cfg: BunnyConfig, guid: string, filePath: string): Promise<void> {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('curl', [
    '-sS', '-X', 'PUT',
    `${BASE}/library/${cfg.libraryId}/videos/${guid}`,
    '-H', `AccessKey: ${cfg.apiKey}`,
    '-H', 'Content-Type: application/octet-stream',
    '-T', filePath,
    '--max-time', '3600',
  ], { encoding: 'utf8', maxBuffer: 1 << 20 });
  if (r.status !== 0) throw new Error(`bunny uploadFile curl exit ${r.status}: ${(r.stderr || '').slice(0, 200)}`);
  if (r.stdout && /"success"\s*:\s*false/i.test(r.stdout)) throw new Error(`bunny uploadFile: ${r.stdout.slice(0, 200)}`);
}
