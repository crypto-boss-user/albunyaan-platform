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

// Every API call gets a hard timeout. A raw fetch() with none hung ALL FIVE
// transfer workers at createVideo() before any ffmpeg spawned (whole rounds
// logged "TRANSFER: N ready" then went silent until the watchdog killed them —
// recurring overnight 2026-07-10/11). A stalled call must throw so the worker's
// catch path requeues the video instead of freezing the round.
const API_TIMEOUT_MS = 30_000;

/** Create an empty video object; returns its Bunny guid. */
export async function createVideo(cfg: BunnyConfig, title: string): Promise<string> {
  const res = await fetch(`${BASE}/library/${cfg.libraryId}/videos`, {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify({ title }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
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
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 300) };
}

/** Video status: 0 queued,1 processing,2 encoding,3 finished,4 resolution-finished,5 failed. */
export async function getVideo(
  cfg: BunnyConfig,
  guid: string,
): Promise<{ status: number; encodeProgress: number; length: number }> {
  const res = await fetch(`${BASE}/library/${cfg.libraryId}/videos/${guid}`, {
    headers: headers(cfg),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`bunny getVideo ${res.status}`);
  const d = (await res.json()) as { status: number; encodeProgress: number; length: number };
  return { status: d.status, encodeProgress: d.encodeProgress, length: d.length };
}

/** Delete a video object (used to clean up the empty placeholder createVideo()
 * leaves behind when a transfer attempt fails before upload completes). */
export async function deleteVideo(cfg: BunnyConfig, guid: string): Promise<void> {
  const res = await fetch(`${BASE}/library/${cfg.libraryId}/videos/${guid}`, {
    method: 'DELETE',
    headers: headers(cfg),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!res.ok && res.status !== 404) throw new Error(`bunny deleteVideo ${res.status}: ${(await res.text()).slice(0, 200)}`);
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
 *
 * ASYNC spawn, not spawnSync: spawnSync blocks Node's single JS thread for the
 * ENTIRE upload — with N "concurrent" workers all calling spawnSync, only one
 * can ever actually run at a time (discovered overnight: CONCURRENCY=5 was
 * configured but only 1 ffmpeg/curl was ever observed running). Async spawn
 * lets the event loop interleave multiple in-flight child processes for real.
 */
export async function uploadFile(cfg: BunnyConfig, guid: string, filePath: string): Promise<void> {
  const { spawn } = await import('node:child_process');
  await new Promise<void>((resolve, reject) => {
    const child = spawn('curl', [
      '-sS', '-X', 'PUT',
      `${BASE}/library/${cfg.libraryId}/videos/${guid}`,
      '-H', `AccessKey: ${cfg.apiKey}`,
      '-H', 'Content-Type: application/octet-stream',
      '-T', filePath,
      // 3h cap (was 1h): on the metered ~1.2MB/s line shared by 5 workers, a
      // multi-GB upload can legitimately exceed an hour — a timeout here throws
      // the file away and burns the bundle twice on the re-download. Genuinely
      // dead uploads are caught by --speed-limit: abort if under 1KB/s for 60s.
      '--max-time', '10800',
      '--speed-limit', '1024', '--speed-time', '60',
    ]);
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`bunny uploadFile curl exit ${code}: ${stderr.slice(0, 200)}`));
      if (/"success"\s*:\s*false/i.test(stdout)) return reject(new Error(`bunny uploadFile: ${stdout.slice(0, 200)}`));
      resolve();
    });
  });
}
