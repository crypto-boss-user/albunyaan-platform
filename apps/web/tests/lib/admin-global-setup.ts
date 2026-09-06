import fs from 'node:fs';
import path from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';
import { loginAsAdmin } from './admin-login';

/**
 * Eén admin-login per testrun (AD 1.2): parallelle spec-bestanden die elk generate_link aanriepen maakten elkaars magic-link-token
 * ongeldig (GoTrue houdt één token per gebruiker) → "admin-login eindigde op /login". De sessie (aal2) wordt als storageState
 * bewaard in test-results/.auth/ (gitignored) en door de admin-specs gedeeld. Zonder ADMIN_TEST_* in .env.local wordt niets
 * geschreven en falen alleen de admin-specs met een duidelijke melding (storefront-specs blijven onafhankelijk).
 */
export const ADMIN_STATE = path.resolve(__dirname, '..', '..', 'test-results', '.auth', 'admin.json');

export default async function globalSetup(config: FullConfig): Promise<void> {
  const envFile = path.resolve(__dirname, '..', '..', process.env.E2E_ENV_FILE ?? '.env.local');
  const heeftAdminTest = fs.existsSync(envFile) && /^ADMIN_TEST_TOTP_SECRET=/m.test(fs.readFileSync(envFile, 'utf8'));
  if (!heeftAdminTest && !process.env.ADMIN_TEST_TOTP_SECRET) {
    console.log('admin-global-setup: geen ADMIN_TEST_* — admin-specs krijgen geen sessie');
    return;
  }
  const baseURL = (config.projects[0]?.use?.baseURL as string | undefined) ?? process.env.BASE_URL ?? 'http://localhost:3012';
  const browser = await chromium.launch();
  try {
    const ctx = await loginAsAdmin(browser, baseURL);
    fs.mkdirSync(path.dirname(ADMIN_STATE), { recursive: true });
    await ctx.storageState({ path: ADMIN_STATE });
    await ctx.close();
  } finally {
    await browser.close();
  }
}
