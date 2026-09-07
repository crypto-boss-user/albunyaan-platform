import SettingsForm from '../../../../components/admin/SettingsForm';
import { KnopUit, Sectie } from '../../../../components/admin/Veld';
import { requireAdmin } from '../../../../lib/admin';
import { REDEN } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › Domain settings (SR 2b E-domain-settings.json): Current domain, Use different domain, SSL status. DNS = founder (B61) → alleen tonen. */
export default async function DomainSettingsPage() {
  await requireAdmin();
  return (
    <SettingsForm kop="Domain settings">
      <Sectie kop="Current domain" tekst="Your storefront is currently accessible at this address.">
        <p className="mb-4 text-[16px] font-semibold" data-current-domain>https://albunyaan.tv</p>
        <p className="ad-help mb-4">Gemeten bij Uscreen (SR 2b): albunyaan.tv wijst tot de cutover naar Uscreen; het eigen platform draait op de Vercel-preview. Doel na de DNS-cutover: dit domein.</p>
        <KnopUit label="Use different domain" reden={REDEN.dns} />
        <p className="ad-help mt-4">SSL Status: Installed bij Uscreen (gemeten); na de cutover beheert Vercel het certificaat (docs/cutover-runbook.md).</p>
      </Sectie>
    </SettingsForm>
  );
}
