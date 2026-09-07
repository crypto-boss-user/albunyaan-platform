import { listPlansForAdmin } from '@albunyaan/core/data';
import SettingsForm from '../../../../../components/admin/SettingsForm';
import { KnopUit } from '../../../../../components/admin/Veld';
import { requireAdmin } from '../../../../../lib/admin';
import { REDEN } from '../../spec';

export const dynamic = 'force-dynamic';

const VALUTA = ['AUD', 'CAD', 'GBP', 'USD'];

/** Settings › Checkout › Localized Pricing (settings-checkout-tab-localized-pricing.json): Products · Base price (EUR) · AUD · CAD · GBP · USD; Add currency + Save uit tot de betaalbeslissing. */
export default async function LocalizedPricingPage() {
  await requireAdmin();
  const plans = await listPlansForAdmin();
  return (
    <SettingsForm kop="Localized Pricing" uitgeschakeld={REDEN.betaal} extra={<KnopUit label="Add currency" reden={REDEN.betaal} />}>
      <div className="ad-card">
        <div className="p-4" style={{ borderBottom: '1px solid var(--ad-border)' }}>
          <input type="search" placeholder="Search by product" aria-label="Search by product" className="ad-input !w-64" disabled title={REDEN.betaal} />
        </div>
        <table className="ad-table" data-localized-pricing>
          <thead>
            <tr>
              <th>Products</th>
              <th>Base price (EUR)</th>
              {VALUTA.map((v) => <th key={v}>{v}</th>)}
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && (
              <tr><td colSpan={6} className="ad-help">No plans yet — plannen komen in Subscriptions (AD 2.3).</td></tr>
            )}
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td>€{(p.amount_cents / 100).toFixed(2)}</td>
                {VALUTA.map((v) => (
                  <td key={v}><input type="number" defaultValue="0.00" className="ad-input !w-24" disabled title={REDEN.betaal} aria-label={`${p.title} ${v}`} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsForm>
  );
}
