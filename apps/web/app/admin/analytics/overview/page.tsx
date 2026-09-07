import { getAnalyticsCounts } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';
import { ANALYTICS, AnalyticsShell, Blok, REDEN, Tegel, periode } from '../shell';

export const dynamic = 'force-dynamic';

/** Analytics › Overview (analytics-overview.json): Net Sales · Engagement: Active Users · MRR · Watch Time · Active Subscriptions · Net Growth; AI Insights; Subscriptions-grafiek. */
export default async function AnalyticsOverviewPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const { period } = await searchParams;
  const per = periode(period, '30d');
  const c = await getAnalyticsCounts(per.since, per.prevSince, per.tot);
  const p = ANALYTICS.overview;
  const waarden: Record<string, { waarde?: string | number | null; reden?: string; sub?: string }> = {
    'Net Sales': { waarde: null, reden: REDEN.betaal },
    'Engagement: Active Users': { waarde: null, reden: REDEN.kijkplatform },
    MRR: { waarde: null, reden: REDEN.betaal },
    'Watch Time': { waarde: null, reden: REDEN.kijkplatform },
    'Active Subscriptions': { waarde: c.subscriptions.total === 0 ? null : c.subscriptions.active, reden: REDEN.leden },
    // Uscreen: New + Reactivated − Churn (abonnementen); reactivatie/churn zijn er nog niet → leeg met reden, de aanmeldingen wel als regel (koude review I-3)
    'Net Growth': { waarde: null, reden: REDEN.leden, sub: `New (sign-ups): ${c.signups.period} | Previous period: ${c.signups.previous}` },
  };
  return (
    <AnalyticsShell pagina="overview" pad="/admin/analytics/overview" periodeKey={per.key}>
      <div className="mb-4 grid grid-cols-3 gap-4">
        {p.tegels.map((t) => <Tegel key={t} titel={t} {...waarden[t]} />)}
      </div>
      <Blok titel="AI Insights" reden="Geen AI-samenvatting op het eigen platform (Uscreen: Omni ✨ AI Insights)." />
      <Blok titel="Subscriptions" reden={`Acquisities/reactivaties/churn per periode: ${REDEN.leden}.`} />
    </AnalyticsShell>
  );
}
