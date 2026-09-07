import { getAnalyticsCounts } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';
import { ANALYTICS, AnalyticsShell, REDEN, periode } from '../shell';

export const dynamic = 'force-dynamic';

/** Analytics › Marketing (analytics-marketing.json): per tool een kaart in 3 groepen (Generate Leads / Nurture Audience / Win-back); Coupons › Redemptions echt (voucher_redemptions), Email Broadcasts/Gifts leeg met reden, rest tekst zonder "Try it now!"-link. */
export default async function AnalyticsMarketingPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const { period } = await searchParams;
  const per = periode(period, 'anytime'); // gemeten: "Date Range anytime"
  const c = await getAnalyticsCounts(per.since, per.prevSince);
  const p = ANALYTICS.marketing;
  const cijfers: Record<string, { waarde: number | null; reden?: string }> = {
    Coupons: { waarde: c.vouchers.redemptions },
    'Email Broadcasts': { waarde: null, reden: REDEN.mail },
    Gifts: { waarde: null, reden: REDEN.betaal },
  };
  return (
    <AnalyticsShell pagina="marketing" pad="/admin/analytics/marketing" periodeKey={per.key}>
      {p.groepen.map((g) => (
        <section key={g.naam} className="mb-6" data-marketing-groep={g.naam}>
          <h2 className="mb-3 text-[16px] font-semibold">{g.naam}</h2>
          <div className="grid grid-cols-3 gap-4">
            {g.kaarten.map((k) => {
              const cf = 'cijfer' in k ? cijfers[k.naam] : null;
              return (
                <div key={k.naam} className="ad-card p-5" data-marketing-kaart={k.naam} data-leeg={cf ? cf.waarde === null : undefined}>
                  <span className="font-semibold">{k.naam} ›</span>
                  {'cijfer' in k && cf ? (
                    <>
                      <span className="mt-2 block text-[22px] font-semibold" data-tegel-waarde>{cf.waarde === null ? '—' : cf.waarde.toLocaleString('en-US')}</span>
                      <span className="ad-help">{k.cijfer}{'sub' in k && k.sub ? ` · ${k.sub}: —` : ''}{cf.waarde === null ? ` — ${cf.reden}` : ` (voucher_redemptions, exact; ${REDEN.totaal})`}</span>
                    </>
                  ) : (
                    <p className="ad-help mt-1">{'tekst' in k ? k.tekst : ''} <span className="italic">Niet gebouwd (Uscreen: "Try it now!").</span></p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </AnalyticsShell>
  );
}
