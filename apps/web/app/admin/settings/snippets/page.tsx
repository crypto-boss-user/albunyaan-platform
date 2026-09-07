import { getAdminSettings } from '@albunyaan/core/data';
import SettingsForm from '../../../../components/admin/SettingsForm';
import { hasRole, requireAdmin } from '../../../../lib/admin';
import { DEFAULTS, REDEN, SECTIES } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › Snippets (SR 2b snippets/): drie tabbladen Head code · Post-purchase code · Custom styles (Monaco bij Uscreen; hier textarea's). Bewaard in admin_settings; de storefront leest ze nog niet. */
const TABS = [
  { key: 'snippets.head_code', naam: 'Head code', tekst: 'HTML or JavaScript injected into the <head> of every storefront page. Common uses: analytics, tracking pixels, fonts, and site-wide third-party scripts.' },
  { key: 'snippets.post_purchase_code', naam: 'Post-purchase code', tekst: 'Code that runs once on the page shown right after a purchase (conversion tracking).' },
  { key: 'snippets.custom_styles', naam: 'Custom styles', tekst: 'CSS applied to every storefront page.' },
];

export default async function SnippetsPage() {
  const { admin } = await requireAdmin();
  const rolUit = hasRole(admin.role, 'admin') ? undefined : 'opslaan vereist de admin-rol'; // koude review AD 2.2 I-2: Save uit als de action zou weigeren
  const s = await getAdminSettings(SECTIES.snippets.velden.map((v) => v.key));
  return (
    <SettingsForm kop="Snippets" section="snippets" uitgeschakeld={rolUit}>
      <p className="ad-help mb-4">{REDEN.storefront}. Gemeten stand bij Uscreen (SR 2b 2026-09-04): head code 347 regels (checkout-redirects), post-purchase en custom styles leeg.</p>
      <div className="ad-card p-6">
        <div className="mb-4 flex gap-2" data-snippet-tabs>
          {TABS.map((t) => <span key={t.key} className="ad-badge ad-badge-muted">{t.naam}</span>)}
        </div>
        {TABS.map((t) => (
          <div key={t.key} className="mb-6" data-veld={t.key}>
            <label className="ad-label" htmlFor={t.key}>{t.naam}</label>
            <p className="ad-help mb-2">{t.tekst}</p>
            <textarea id={t.key} name={t.key} rows={8} className="ad-textarea font-mono text-[12px]" defaultValue={(s[t.key] ?? DEFAULTS[t.key]) as string} spellCheck={false} />
          </div>
        ))}
      </div>
    </SettingsForm>
  );
}
