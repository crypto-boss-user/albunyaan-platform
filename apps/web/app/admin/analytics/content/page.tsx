import { getAnalyticsCounts } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';
import { ANALYTICS, AnalyticsShell, Blok, REDEN, Tegel, periode } from '../shell';

export const dynamic = 'force-dynamic';

/** Analytics › Content (analytics-content.json): Views · Viewers · Watch Time; Most Popular (Content · Views); tabs Overview/Videos/Live Streaming/Collections/Calendar/Organize (Authors); kaarten Benchmarks/Trends/Audience. Content-tellingen echt per tab. */
export default async function AnalyticsContentPage({ searchParams }: { searchParams: Promise<{ period?: string; tab?: string }> }) {
  await requireAdmin();
  const { period, tab } = await searchParams;
  const per = periode(period, '30d');
  const c = await getAnalyticsCounts(per.since, per.prevSince);
  const p = ANALYTICS.content;
  const actief = p.tabs.includes(tab ?? '') ? tab! : p.tabs[0];
  const perTab: Record<string, { titel: string; waarde: number }[]> = {
    Videos: [{ titel: 'Videos in catalog', waarde: c.content.videos }, { titel: 'Published', waarde: c.content.published }, { titel: 'Unpublished', waarde: c.content.draft }],
    'Live Streaming': [{ titel: 'Live videos', waarde: c.content.live }],
    Collections: [{ titel: 'Collections', waarde: c.content.collections }, { titel: 'Categories', waarde: c.content.categories }],
    Calendar: [{ titel: 'Scheduled videos', waarde: c.content.scheduled }],
    'Organize (Authors)': [{ titel: 'Authors', waarde: c.content.authors }],
  };
  return (
    <AnalyticsShell pagina="content" pad="/admin/analytics/content" periodeKey={per.key} tab={actief}>
      {actief === 'Overview' ? (
        <>
          <div className="mb-4 grid grid-cols-3 gap-4">
            {p.tegels.map((t) => <Tegel key={t} titel={t} waarde={null} reden={REDEN.kijkplatform} />)}
          </div>
          <Blok titel="Most Popular">
            <p className="ad-help mt-1 mb-2">Most watched content in the selected period, based on number of views.</p>
            <table className="ad-table" data-most-popular>
              <thead><tr>{p.kolommen.map((k) => <th key={k}>{k}</th>)}</tr></thead>
              <tbody><tr><td colSpan={2} className="ad-help" data-blok-reden>{REDEN.kijkplatform}</td></tr></tbody>
            </table>
          </Blok>
          <div className="grid grid-cols-3 gap-4">
            {[['Benchmarks', 'Compare your results with benchmarks.'], ['Trends', 'Track performance over time.'], ['Audience', 'Learn who your audience is.']].map(([t, s]) => (
              <div key={t} className="ad-card p-5" data-blok={t}><span className="font-semibold">{t} ›</span><p className="ad-help mt-1">{s} — {REDEN.kijkplatform}</p></div>
            ))}
          </div>
        </>
      ) : (
        <div className="mb-4 grid grid-cols-3 gap-4" data-content-tellingen={actief}>
          {perTab[actief].map((t) => <Tegel key={t.titel} titel={t.titel} waarde={t.waarde} sub={`telling uit de eigen catalogus (exact; ${REDEN.totaal})`} />)}
        </div>
      )}
    </AnalyticsShell>
  );
}
