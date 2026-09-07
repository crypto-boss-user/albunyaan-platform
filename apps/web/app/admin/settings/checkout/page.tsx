import Link from 'next/link';
import SettingsForm from '../../../../components/admin/SettingsForm';
import { KnopUit, Sectie } from '../../../../components/admin/Veld';
import { requireAdmin } from '../../../../lib/admin';
import { REDEN } from '../spec';

export const dynamic = 'force-dynamic';

/**
 * Settings › Checkout (AD0-inventaris §2.8, settings-checkout.json): Connect your payment provider (Stripe, PayPal, Legacy PayPal) en
 * Level up your checkout (Automatic tax collection, Localized pricing, Donations, Cover my fees, Buy now pay later). Alles zichtbaar,
 * alle knoppen uit "tot de betaalbeslissing" (founder 2026-09-07, vraag 6); account-ID's/e-mails nooit tonen.
 */
const PROVIDERS = [
  { naam: 'Stripe', tekst: 'Uscreen: Connected (Account ID niet getoond). Eigen platform: Stripe-code aanwezig, koppeling volgt.', knop: 'Connect' },
  { naam: 'PayPal', tekst: 'Accept wallet payments only. Visit PayPal for pricing and details.', knop: 'Connect' },
  { naam: 'Legacy PayPal', tekst: 'Uscreen: Connected (PayPal Email niet getoond); hier niet gekoppeld.', knop: 'Connect' },
];
const LEVEL_UP = [
  { naam: 'Automatic tax collection', tekst: "Tax is applied based on your customers' location. It requires additional setup in Stripe.", knoppen: ['Preview', 'Get started'] },
  { naam: 'Localized pricing', tekst: 'Sell globally with local pricing. Members pay in their currency, you receive it in yours.', knoppen: ['Edit'], link: '/admin/settings/checkout/localized-pricing', status: 'Connected (Uscreen)' },
  { naam: 'Donations', tekst: 'Fans can support you with custom or suggested amounts. Use it alongside your offers or by itself.', knoppen: ['Preview', 'Get started'] },
  { naam: 'Cover my fees', tekst: 'Let customers cover the processing fees at checkout.', knoppen: ['Preview', 'Get started'] },
  { naam: 'Buy now, pay later', tekst: 'Klarna / Afterpay / Affirm at checkout.', knoppen: ['Disable'], status: 'Connected (Uscreen)' },
];

export default async function CheckoutSettingsPage() {
  await requireAdmin();
  return (
    <SettingsForm kop="Checkout" uitgeschakeld={REDEN.betaal}>
      <Sectie kop="Connect your payment provider" tekst="Sign in to one or more of your existing providers to start getting paid.">
        {PROVIDERS.map((p) => (
          <div key={p.naam} className="mb-3 flex items-center justify-between gap-4 rounded-md p-4" style={{ border: '1px solid var(--ad-border)' }} data-provider={p.naam}>
            <div>
              <span className="font-semibold">{p.naam}</span> <span className="ad-badge ad-badge-muted ml-2">Not connected</span>
              <p className="ad-help mt-1">{p.tekst}</p>
            </div>
            <KnopUit label={p.knop} reden={REDEN.betaal} />
          </div>
        ))}
      </Sectie>
      <Sectie kop="Level up your checkout">
        {LEVEL_UP.map((l) => (
          <div key={l.naam} className="mb-3 flex items-center justify-between gap-4 rounded-md p-4" style={{ border: '1px solid var(--ad-border)' }} data-level-up={l.naam}>
            <div>
              <span className="font-semibold">{l.naam}</span>
              {l.status && <span className="ad-badge ad-badge-muted ml-2">{l.status}</span>}
              <p className="ad-help mt-1">{l.tekst}</p>
            </div>
            <div className="flex gap-2">
              {l.link && <Link href={l.link} className="ad-btn ad-btn-outline">Edit</Link>}
              {l.knoppen.filter((k) => !(l.link && k === 'Edit')).map((k) => <KnopUit key={k} label={k} reden={REDEN.betaal} />)}
            </div>
          </div>
        ))}
      </Sectie>
    </SettingsForm>
  );
}
