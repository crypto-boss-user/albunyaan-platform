import { requireAdmin } from '../../../../lib/admin';
import { ANALYTICS, AnalyticsShell, Blok, REDEN, Tegel, periode } from '../shell';

export const dynamic = 'force-dynamic';

/** Analytics › Sales (analytics-sales.json): Gross Sales · Net Sales · Number of Sales; tabs Sales/Payouts; grafieken en rapporten als structuur — alles leeg tot de betaalbeslissing (Net Sales by Customer is persoonsgebonden, B84). */
export default async function AnalyticsSalesPage({ searchParams }: { searchParams: Promise<{ period?: string; tab?: string }> }) {
  await requireAdmin();
  const { period, tab } = await searchParams;
  const per = periode(period, '8w');
  const p = ANALYTICS.sales;
  const actief = p.tabs.includes(tab ?? '') ? tab! : p.tabs[0];
  return (
    <AnalyticsShell pagina="sales" pad="/admin/analytics/sales" periodeKey={per.key} tab={actief}>
      {actief === 'Sales' ? (
        <>
          <div className="mb-4 grid grid-cols-3 gap-4">
            {p.tegels.map((t) => <Tegel key={t} titel={t} waarde={null} reden={REDEN.betaal} />)}
          </div>
          {p.blokken.map((b) => <Blok key={b} titel={b} reden={b === 'Net Sales by Customer' ? `${REDEN.betaal}; persoonsgebonden rapport (B84: geen bedragen per persoon in de referentie)` : REDEN.betaal} />)}
        </>
      ) : (
        <Blok titel="Payouts" reden={REDEN.betaal} />
      )}
    </AnalyticsShell>
  );
}
