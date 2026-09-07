/**
 * Admin-instellingen (AD 2.2) — server-side only (service role). Key/value in `admin_settings` (0014): één rij per instelling,
 * waarde als JSON. Alleen keys uit een whitelist van de aanroeper (apps/web/app/admin/settings/actions.ts) komen hier binnen;
 * geheime waarden (API-sleutels, wachtwoorden) horen hier NOOIT — die blijven in env/Vercel.
 */
import { createServiceClient } from './client';
import { logAdminAction } from './admins';
import type { PlatformAdminRow } from './rows';

export type SettingValue = string | number | boolean | string[] | null;

const KEY_RE = /^[a-z][a-z0-9_.]{1,80}$/;

/** Waarden voor een lijst keys; ontbrekende keys komen als `null` terug. */
export async function getAdminSettings(keys: string[]): Promise<Record<string, SettingValue>> {
  const out: Record<string, SettingValue> = Object.fromEntries(keys.map((k) => [k, null]));
  if (keys.length === 0) return out;
  const db = createServiceClient();
  const { data, error } = await db.from('admin_settings').select('key, value').in('key', keys);
  if (error) throw error;
  for (const row of (data ?? []) as { key: string; value: SettingValue }[]) out[row.key] = row.value;
  return out;
}

/** Slaat een set instellingen op (upsert per key) en schrijft één audit-rij met before/after. */
export async function setAdminSettings(entries: Record<string, SettingValue>, actorAuthUserId: string): Promise<void> {
  const keys = Object.keys(entries);
  if (keys.length === 0) return;
  for (const k of keys) if (!KEY_RE.test(k)) throw new Error(`setAdminSettings: ongeldige key ${k}`);
  const before = await getAdminSettings(keys);
  const db = createServiceClient();
  const { error } = await db
    .from('admin_settings')
    .upsert(keys.map((key) => ({ key, value: entries[key], updated_by: actorAuthUserId, updated_at: new Date().toISOString() })), { onConflict: 'key' });
  if (error) throw new Error(`setAdminSettings: ${error.message}`);
  await logAdminAction({ actorAuthUserId, action: 'settings.update', entity: 'admin_settings', entityId: keys.join(','), before, after: entries });
}

export interface PlatformAdminListRow extends PlatformAdminRow {
  email: string | null;
  created_at: string;
}

/**
 * Team-lijst (extra kaart in Settings, founder 2026-09-07): de roster-rijen met het e-mailadres uit auth (admin-API per gebruiker;
 * de roster is klein). Alleen lezen — toevoegen/verwijderen van beheerders = T2 en blijft buiten deze laag.
 */
export async function listPlatformAdmins(): Promise<PlatformAdminListRow[]> {
  const db = createServiceClient();
  const { data, error } = await db.from('platform_admins').select('auth_user_id, role, note, created_at').order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as (PlatformAdminRow & { created_at: string })[];
  return Promise.all(
    rows.map(async (r) => {
      const { data: u } = await db.auth.admin.getUserById(r.auth_user_id);
      return { ...r, email: u?.user?.email ?? null };
    }),
  );
}
