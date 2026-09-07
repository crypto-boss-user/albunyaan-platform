import { getAnalyticsCounts } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';
import { ANALYTICS, AnalyticsShell, Blok, REDEN, Tegel, periode } from '../shell';

export const dynamic = 'force-dynamic';

/** Analytics › Subscriptions (analytics-subscriptions.json): In Trial · Active Subscriptions · Created Via API · From Migrated Users · Current MRR; tabs Overview/Trials/New/Engagement/Churn/MRR/Benchmarks; 4 grafieken. subscriptions-tabel = 0 rijen → tegels leeg met reden. */
export default async function AnalyticsSubscriptionsPage({ searchParams }: { searchParams: Promise<{ period?: string; tab?: string }> }) {
  await requireAdmin();
  const { period, tab } = await searchParams;
  const per = periode(period, '12m');
  const c = await getAnalyticsCounts(per.since, per.prevSince, per.tot);
  const p = ANALYTICS.subscriptions;
  const actief = p.tabs.includes(tab ?? '') ? tab! : p.tabs[0];
  const leeg = c.subscriptions.total === 0;
  const waarden: Record<string, { waarde: number | null; reden: string }> = {
    'In Trial': { waarde: leeg ? null : c.subscriptions.trialing, reden: REDEN.leden },
    'Active Subscriptions': { waarde: leeg ? null : c.subscriptions.active, reden: REDEN.leden },
    'Active Subscriptions Created Via API': { waarde: null, reden: 'geen API-abonnementen op het eigen platform' },
    'Active Subscriptions From Migrated Users': { waarde: null, reden: REDEN.leden },
    'Current MRR': { waarde: null, reden: REDEN.betaal },
  };
  return (
    <AnalyticsShell pagina="subscriptions" pad="/admin/analytics/subscriptions" periodeKey={per.key} tab={actief}>
      {actief === 'Overview' ? (
        <>
          <div className="mb-4 grid grid-cols-5 gap-4">
            {p.tegels.map((t) => <Tegel key={t} titel={t} {...waarden[t]} />)}
          </div>
          {p.blokken.map((b) => <Blok key={b} titel={b} reden={REDEN.leden} />)}
        </>
      ) : (
        <Blok titel={actief} reden={REDEN.leden} />
      )}
    </AnalyticsShell>
  );
}
