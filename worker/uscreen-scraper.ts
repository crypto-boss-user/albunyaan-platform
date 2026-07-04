// Uscreen admin scraper base — copied from
// ~/projects/albunyaan-command-center/worker/uscreen-scraper.ts and adapted:
// the CC datastore/env imports are replaced by a local JSONL status log and
// process.env; the dashboard-metric probe loop is generalized into a session
// helper the Phase-1 exporter drives. The DESIGN RULES are kept verbatim:
//   • persisted storageState — authenticate once via `pnpm … uscreen:login`
//     (~/.albunyaan-cc/uscreen-storageState.json, shared with the command center)
//   • login lost (2FA/session expiry) → LOUD "login_lost" status, never retried silently
//   • selector self-check fails → "scrape_broken" — NEVER a zero, blank, or
//     guessed value ("fails honest, not silent")
//   • ~2s politeness between page loads, sequential, never parallel tabs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright-core';

export type ScrapeStatus = 'ok' | 'login_lost' | 'scrape_broken';

export const POLITENESS_MS = 2_000; // ~2s between page loads (PRD §4b)

const STATUS_LOG = path.join(path.dirname(fileURLToPath(import.meta.url)), 'state', 'scrape-status.jsonl');

export function storageStatePath(): string {
  return process.env.USCREEN_STORAGE_STATE ?? path.join(os.homedir(), '.albunyaan-cc', 'uscreen-storageState.json');
}

/** Loud, append-only status trail (replaces the CC datastore snapshot insert). */
export function logScrapeStatus(status: ScrapeStatus, detail: string): void {
  fs.mkdirSync(path.dirname(STATUS_LOG), { recursive: true });
  fs.appendFileSync(STATUS_LOG, JSON.stringify({ at: new Date().toISOString(), status, detail }) + '\n');
  // eslint-disable-next-line no-console
  console[status === 'ok' ? 'log' : 'error'](`[scraper:${status}] ${detail}`);
}

export interface AdminSession {
  browser: Browser;
  page: Page;
}

export type SessionResult = { status: 'ok'; session: AdminSession } | { status: 'login_lost'; detail: string };

/**
 * Open a headless admin session from the persisted storageState and verify it
 * is actually signed in (login-lost detection: sign-in redirect or password
 * field). Caller owns `browser.close()`.
 */
export async function openAdminSession(startUrl: string): Promise<SessionResult> {
  const statePath = storageStatePath();
  if (!fs.existsSync(statePath)) {
    const detail = `No storageState at ${statePath} — run \`pnpm --filter @albunyaan/worker uscreen:login\` once (headed) to sign in.`;
    logScrapeStatus('login_lost', detail);
    return { status: 'login_lost', detail };
  }

  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ storageState: statePath });
  const page = await context.newPage();
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });

  const url = page.url();
  const passwordField = await page.locator('input[type="password"]').count();
  if (url.includes('sign_in') || url.includes('login') || passwordField > 0) {
    await browser.close();
    const detail = 'Uscreen session expired (login page detected) — re-run `uscreen:login`.';
    logScrapeStatus('login_lost', detail);
    return { status: 'login_lost', detail };
  }
  return { status: 'ok', session: { browser, page } };
}

/**
 * Selector self-check: try candidates in order; the first that yields
 * non-empty text wins. NO match → null, and the caller MUST abort the item
 * as scrape_broken — a guessed/blank value is never written (design rule).
 */
export async function probeText(page: Page, candidates: string[], timeoutMs = 8_000): Promise<string | null> {
  for (const sel of candidates) {
    try {
      const text = await page.locator(sel).first().textContent({ timeout: timeoutMs });
      if (text && text.trim().length > 0) return text.trim();
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

export function politeDelay(ms = POLITENESS_MS): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
