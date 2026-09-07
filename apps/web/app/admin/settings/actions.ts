'use server';

import { revalidatePath } from 'next/cache';
import { setAdminSettings, type SettingValue } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import type { FormState } from '../../../lib/admin-form';
import { SECTIES } from './spec';

/**
 * Eén server action voor alle Settings-formulieren (AD 2.2): `section` kiest de whitelist uit spec.ts; alles buiten die lijst wordt
 * genegeerd. Opslaan = admin-rol en hoger (Uscreen: instellingen zijn eigenaarswerk). Betalings-/secret-velden hebben geen spec en
 * kunnen dus nooit opgeslagen worden — ook niet met een gemanipuleerd formulier.
 */
export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireAdmin('admin');
  const section = String(formData.get('section') ?? '');
  const spec = Object.hasOwn(SECTIES, section) ? SECTIES[section] : undefined; // geen prototype-keys (koude review M-1)
  if (!spec) return { error: 'Unknown settings section.', saved: false };

  const entries: Record<string, SettingValue> = {};
  for (const v of spec.velden) {
    const raw = formData.get(v.key);
    switch (v.type) {
      case 'text': {
        const s = String(raw ?? '').trim();
        if (s.length > (v.max ?? 2000)) return { error: `${v.key}: too long (max ${v.max ?? 2000}).`, saved: false };
        entries[v.key] = s;
        break;
      }
      case 'code': {
        const s = String(raw ?? '');
        if (s.length > (v.max ?? 50000)) return { error: `${v.key}: too long (max ${v.max ?? 50000}).`, saved: false };
        entries[v.key] = s;
        break;
      }
      case 'bool':
        entries[v.key] = raw === 'on' || raw === 'true';
        break;
      case 'number': {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < v.min || n > v.max) return { error: `${v.key}: enter a whole number between ${v.min} and ${v.max}.`, saved: false };
        entries[v.key] = n;
        break;
      }
      case 'enum': {
        const s = String(raw ?? '');
        if (!v.opties.includes(s)) return { error: `${v.key}: invalid choice.`, saved: false };
        entries[v.key] = s;
        break;
      }
      case 'list': {
        // bestaande items = aangevinkte checkboxes met dezelfde naam; nieuw item = <key>.new
        const items = formData.getAll(v.key).map((x) => String(x).trim()).filter(Boolean);
        const nieuw = String(formData.get(`${v.key}.new`) ?? '').trim();
        if (nieuw) items.push(nieuw);
        const uniek = Array.from(new Set(items.map((s) => s.slice(0, 100))));
        if (uniek.length > (v.max ?? 250)) return { error: `${v.key}: too many items.`, saved: false };
        entries[v.key] = uniek;
        break;
      }
    }
  }
  try {
    await setAdminSettings(entries, user.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save settings.', saved: false };
  }
  revalidatePath(spec.pad);
  return { error: null, saved: true };
}
