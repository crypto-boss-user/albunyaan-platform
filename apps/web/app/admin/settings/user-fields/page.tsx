import { getAdminSettings } from '@albunyaan/core/data';
import SettingsForm from '../../../../components/admin/SettingsForm';
import { Sectie, Veld } from '../../../../components/admin/Veld';
import { hasRole, requireAdmin } from '../../../../lib/admin';
import { DEFAULTS, SECTIES } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › User fields (settings-user-fields.json): kop "Custom user fields", User Field 1/2/3 met de gemeten placeholders; Save. Checkout gebruikt ze pas na de ledenmigratie. */
const PLACEHOLDERS = ['How did you hear about us?', 'Where are you located?', 'T-shirt size?'];

export default async function UserFieldsPage() {
  const { admin } = await requireAdmin();
  const rolUit = hasRole(admin.role, 'admin') ? undefined : 'opslaan vereist de admin-rol'; // koude review AD 2.2 I-2: Save uit als de action zou weigeren
  const keys = SECTIES.user_fields.velden.map((v) => v.key);
  const s = await getAdminSettings(keys);
  return (
    <SettingsForm kop="Custom user fields" section="user_fields" uitgeschakeld={rolUit}>
      <Sectie kop="User fields" tekst="Collect additional information from your users during checkout.">
        {keys.map((k, i) => (
          <Veld key={k} label={`User Field ${i + 1}`} name={k} value={(s[k] ?? DEFAULTS[k]) as string} placeholder={PLACEHOLDERS[i]} />
        ))}
      </Sectie>
    </SettingsForm>
  );
}
