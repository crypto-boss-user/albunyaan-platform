import { getAdminSettings } from '@albunyaan/core/data';
import SettingsForm from '../../../../components/admin/SettingsForm';
import { KnopUit, Sectie, Veld } from '../../../../components/admin/Veld';
import { hasRole, requireAdmin } from '../../../../lib/admin';
import { DEFAULTS, REDEN, SECTIES } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › Security (settings-security.json): Captcha for end users (n.v.t.: magic link), Device session limits (Max devices per member = 7, bewaard), DRM Beta (na kijkplatform). */
export default async function SecurityPage() {
  const { admin } = await requireAdmin();
  const rolUit = hasRole(admin.role, 'admin') ? undefined : 'opslaan vereist de admin-rol'; // koude review AD 2.2 I-2: Save uit als de action zou weigeren
  const s = await getAdminSettings(SECTIES.security.velden.map((v) => v.key));
  return (
    <SettingsForm kop="Security" section="security" uitgeschakeld={rolUit}>
      <Sectie kop="Captcha for end users" tekst="Helps prevent spam and fraud during sign in and checkout">
        <p className="mb-3"><span className="ad-badge ad-badge-muted">Not applicable</span> <span className="ad-help">Inloggen gaat via magic link + TOTP voor beheerders; Uscreen: Enabled.</span></p>
        <KnopUit label="Contact us to disable" reden="n.v.t. (magic link, geen captcha)" />
      </Sectie>
      <Sectie kop="Device session limits" tekst="Control how many devices each member can use">
        <Veld label="Max devices per member" name="security.max_devices" type="number" value={(s['security.max_devices'] ?? DEFAULTS['security.max_devices']) as number} help={`Bewaard in admin_settings; afdwingen op de speler volgt ${REDEN.kijkplatform}. Uscreen: 7.`} />
        <div className="flex gap-2">
          <KnopUit label="Use subscription plan overrides →" reden={REDEN.betaal} />
          <KnopUit label="Remove limit" reden={REDEN.kijkplatform} />
        </div>
      </Sectie>
      <Sectie kop="Digital Rights Management (DRM)" tekst="Control how your content is accessed and shared. DRM is in Beta while we actively stabilize it. Review the device requirements and limitations.">
        <p className="mb-3"><span className="ad-badge-beta">Beta</span></p>
        <KnopUit label="Contact us to enable" reden={REDEN.kijkplatform} />
      </Sectie>
    </SettingsForm>
  );
}
