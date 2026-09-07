import { getAdminSettings } from '@albunyaan/core/data';
import SettingsForm from '../../../../components/admin/SettingsForm';
import { KnopUit, Sectie } from '../../../../components/admin/Veld';
import { hasRole, requireAdmin } from '../../../../lib/admin';
import { DEFAULTS, REDEN, SECTIES } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › Geo-Blocking (settings-geo-blocking.json): Blocked countries — zoek/toevoegen, Block all, "No countries are currently blocked."; lijst bewaard in admin_settings, afdwingen na kijkplatform. */
export default async function GeoBlockingPage() {
  const { admin } = await requireAdmin();
  const rolUit = hasRole(admin.role, 'admin') ? undefined : 'opslaan vereist de admin-rol'; // koude review AD 2.2 I-2: Save uit als de action zou weigeren
  const s = await getAdminSettings(SECTIES.geo_blocking.velden.map((v) => v.key));
  const landen = (s['geo_blocking.blocked_countries'] ?? DEFAULTS['geo_blocking.blocked_countries']) as string[];
  return (
    <SettingsForm kop="Geo-Blocking" section="geo_blocking" uitgeschakeld={rolUit}>
      <Sectie kop="Blocked countries" tekst="Users from blocked countries will not be able to access your storefront.">
        <p className="ad-help mb-3">Afdwingen op de storefront volgt {REDEN.kijkplatform}; de lijst wordt wel bewaard.</p>
        <div className="mb-4 flex items-center gap-3">
          <input name="geo_blocking.blocked_countries.new" placeholder="Search and add a country..." aria-label="Search and add a country..." className="ad-input !w-80" />
          <KnopUit label="Block all" reden={REDEN.kijkplatform} />
        </div>
        {landen.length === 0 ? (
          <p className="ad-help" data-geo-empty>No countries are currently blocked.</p>
        ) : (
          <ul className="flex flex-wrap gap-2" data-geo-list>
            {landen.map((l) => (
              <li key={l} className="inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-[13px]" style={{ background: 'var(--ad-secondary)' }}>
                <input type="checkbox" name="geo_blocking.blocked_countries" value={l} defaultChecked aria-label={`Keep ${l} blocked`} /> {l}
              </li>
            ))}
          </ul>
        )}
      </Sectie>
    </SettingsForm>
  );
}
