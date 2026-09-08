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

/**
 * D-5 (Codex 2026-09-07, T-testronde 2026-09-08): specs die rijen schrijven die een ÁNDER bestand telt, draaien in een
 * eigen fase ná de lezende specs — Playwright-projectafhankelijkheden zijn de serialisatie over bestandsgrenzen heen.
 *  - lezen: storefront + admin-specs die alleen eigen rijen schrijven (settings/plans/vouchers telt niemand anders);
 *  - content-people: admin-content maakt video's/collecties/categorieën (geteld door analytics, catalog, categorie, videos),
 *    admin-people maakt een lid (geteld door analytics); onderling geen overlap, dus samen;
 *  - videos: admin-videos telt video's exact en publiceert er tijdelijk één in de eerste categorie → als laatste.
 * Let op: faalt een fase, dan slaat Playwright de afhankelijke fasen over (zichtbaar als "skipped") — dat is de prijs
 * van isolatie zonder eigen testdatabase. De tellingen in analytics/videos zijn daardoor weer exact (geen interval).
 */
const CONTENT_PEOPLE = ['**/admin-content.spec.ts', '**/admin-people.spec.ts'];
const VIDEOS = ['**/admin-videos.spec.ts'];

export default defineConfig({
  testDir: './tests',
  projects: [
    { name: 'lezen', testIgnore: [...CONTENT_PEOPLE, ...VIDEOS] },
    { name: 'content-people', testMatch: CONTENT_PEOPLE, dependencies: ['lezen'] },
    { name: 'videos', testMatch: VIDEOS, dependencies: ['content-people'] },
  ],
  /** Eén admin-login per run (AD 1.2, admin-test): sessie in test-results/.auth/admin.json; zie tests/lib/admin-global-setup.ts. */
  globalSetup: path.join(__dirname, 'tests', 'lib', 'admin-global-setup.ts'),
  // 30 s was krap: een test die een pagina laadt én een screenshot met font-wacht maakt haalde het
  // niet op een belaste machine (2026-09-07, admin-subscriptions AD 2.3 lijst-test). De vorige 40/40
  // is gemeten op een rustige machine; deze marge maakt de suite reproduceerbaar i.p.v. stemmingsafhankelijk.
  timeout: 60_000,
  // 10 s was te krap voor een assertie die op een server-action-round-trip wacht ([data-form-saved],
  // [data-plan-created]). Onder belasting faalde daarop wisselend een andere test per run — de
  // handtekening van een omgevingsprobleem, niet van een bug (2026-09-07).
  expect: { timeout: 30_000 },
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
        // Koude Turbopack heeft >120 s nodig; op een belaste machine (2026-09-07: load 22, dev-server
        // en /admin/settings kwamen niet binnen 300 s op) haalde 180 s het niet en faalde de hele run
        // op de webServer-poort in plaats van op een test. Ruim boven de ergste gemeten koude start.
        timeout: 600_000,
        env: { ...envFromFile(process.env.E2E_ENV_FILE ?? '.env.local'), ...definedEnv },
      },
});
