import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * Playwright-structuurtests voor apps/web (RV 2, 2026-09-04; B25/B21).
 * Poort 3012 (B25) — de dev-server op :3010 blijft met rust. `pnpm test` start zelf een dev-server op :3012
 * (of hergebruikt een draaiende) en stopt hem na afloop. E2E_NO_SERVER=1 slaat het starten over.
 * Dit zijn STRUCTUUR-tests (menu, footer, koppen), geen flows met accounts: de zes worker-harnesses blijven
 * de flow-tests en draaien via `pnpm --filter @albunyaan/worker e2e` (B53).
 *
 * Omgeving van de testserver: Next laadt `.env.development.local` vóór `.env.local`; op deze Mac wijst de eerste
 * naar een LOKALE Supabase (:54321) die meestal niet draait, waardoor elke pagina 500 geeft. Daarom leest deze
 * config het bestand uit E2E_ENV_FILE (default `.env.local` = de cloud-leessleutels, alleen lezen) en geeft die
 * variabelen door aan de testserver — al gezette variabelen overschrijft Next niet. Waarden worden nooit gelogd.
 * Draait er wél een lokale stack, zet dan E2E_ENV_FILE=.env.development.local. Alleen de Supabase-sleutels gaan door
 * (whitelist) — specs mogen geen mail (RESEND) of Bunny-/Stripe-mutaties triggeren zolang de testserver cloud-sleutels draagt.
 * Let op: met reuseExistingServer wordt deze env NIET toegepast op een al draaiende :3012.
 */
/** Alleen de sleutels die de layout/structuurpagina's nodig hebben — nooit RESEND/BUNNY/Stripe (specs mogen geen mail of mutaties triggeren). */
const ENV_WHITELIST = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ALBUNYAAN_DB_DRIVER'];

function envFromFile(file: string): Record<string, string> {
  const p = path.resolve(__dirname, file);
  if (!fs.existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && ENV_WHITELIST.includes(m[1])) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

/** process.env bevat `string | undefined`; Playwright's webServer.env eist `string`. */
const definedEnv: Record<string, string> = Object.fromEntries(
  Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string'),
);

export default defineConfig({
  testDir: './tests',
  /** Eén admin-login per run (AD 1.2, admin-test): sessie in test-results/.auth/admin.json; zie tests/lib/admin-global-setup.ts. */
  globalSetup: path.join(__dirname, 'tests', 'lib', 'admin-global-setup.ts'),
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3012',
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'pnpm dev -p 3012',
        url: 'http://localhost:3012/terms',
        reuseExistingServer: true,
        timeout: 180_000,
        env: { ...envFromFile(process.env.E2E_ENV_FILE ?? '.env.local'), ...definedEnv },
      },
});
