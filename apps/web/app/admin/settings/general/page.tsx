import { getAdminSettings } from '@albunyaan/core/data';
import SettingsForm from '../../../../components/admin/SettingsForm';
import { Keuze, Schakelaar, Sectie, Veld } from '../../../../components/admin/Veld';
import { hasRole, requireAdmin } from '../../../../lib/admin';
import { DEFAULTS, REDEN, SECTIES } from '../spec';

export const dynamic = 'force-dynamic';

/** Settings › General (SR 2b D-general-settings.json): Store name, Time zone, Base currency (vast), Storefront locale, Business address, Terms of Service URL, Maintenance mode, Branding. */
export default async function GeneralSettingsPage() {
  const { admin } = await requireAdmin();
  const rolUit = hasRole(admin.role, 'admin') ? undefined : 'opslaan vereist de admin-rol'; // koude review AD 2.2 I-2: Save uit als de action zou weigeren
  const keys = SECTIES.general.velden.map((v) => v.key);
  const s = await getAdminSettings(keys);
  const v = (k: string) => (s[k] ?? DEFAULTS[k]) as string;
  const opties = (k: string) => { const f = SECTIES.general.velden.find((x) => x.key === k); return f && f.type === 'enum' ? f.opties : []; }; // één bron (koude review M-2)
  return (
    <SettingsForm kop="General" section="general" uitgeschakeld={rolUit}>
      <Sectie kop="General" tekst="To manage additional currencies, go to Localized Pricing.">
        <Veld label="Store name" name="general.store_name" value={v('general.store_name')} />
        <Keuze label="Time zone" name="general.time_zone" value={v('general.time_zone')} opties={opties('general.time_zone')} />
        <Keuze label="Base currency" name="general.base_currency" value="Euro (EUR)" opties={['Euro (EUR)']} uitgeschakeld={`${REDEN.betaal} — Uscreen: "You can't change the currency because you already have active subscribers on your current currency."`} />
        <Keuze label="Storefront locale" name="general.storefront_locale" value={v('general.storefront_locale')} opties={opties('general.storefront_locale')} />
        <Veld label="Business address" name="general.business_address" value={v('general.business_address')} help="Your business address appears on invoices and emails per anti-spam laws" placeholder="e.g. 123 Main St. Unit C. New York, NY. 10001" />
        <Veld label="Terms of Service URL" name="general.terms_of_service_url" value={v('general.terms_of_service_url')} type="url" />
        <Schakelaar label="Maintenance mode" name="general.maintenance_mode" checked={(s['general.maintenance_mode'] ?? DEFAULTS['general.maintenance_mode']) === true} help="Alleen bewaard; de storefront leest deze instelling nog niet." />
      </Sectie>
      <Sectie kop="Branding">
        <Schakelaar label="Hide Uscreen Branding" name="general.hide_branding" checked={true} uitgeschakeld="n.v.t. op het eigen platform (geen Uscreen-branding)" help="Hide any mention of the Uscreen Branding which appears in footers, emails, onboarding screens, etc." />
      </Sectie>
    </SettingsForm>
  );
}
