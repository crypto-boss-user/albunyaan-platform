import Link from 'next/link';
import bron from '../../../../../reference/admin-2026-09/analytics-ad2.json';

/**
 * Gedeelde schil voor Analytics (AD 2.5; norm AD0-inventaris §2.7, analytics-*.json 2026-09-07). Uscreen toont een Omni-iframe; hier eigen
 * pagina's met dezelfde tegels/tabs/filters (founder 2026-09-07). Geen voorbeeldcijfers: echte tellingen uit de DB, anders een lege tegel met reden.
 * Periode-filter werkt (?period=…) voor de tellingen die een periode kennen (ledengroei); de overige gemeten filters staan uit met reden.
 */
export const PERIODES: { key: string; label: string; dagen: number }[] = [
  { key: 'anytime', label: 'anytime', dagen: 36500 }, // gemeten standaard bij Marketing (koude review M-7): alle tijd
  { key: '7d', label: 'in the past 7 days', dagen: 7 },
  { key: '30d', label: 'in the past 30 days', dagen: 30 },
  { key: '8w', label: 'in the past 8 weeks', dagen: 56 },
  { key: '90d', label: 'in the past 90 days', dagen: 90 },
  { key: '12m', label: 'in the past 12 months', dagen: 365 },
];
export const REDEN = {
  betaal: 'tot de betaalbeslissing',
  kijkplatform: 'na de kijkplatformkeuze (geen kijkdata op het eigen platform)',
  leden: 'na de ledenmigratie (subscriptions-tabel leeg)',
  totaal: 'totaal over alle tijd, niet per periode',
  mail: 'na de mailbeslissing',
} as const;

export type PaginaKey = keyof typeof bron.paginas;
export const ANALYTICS = bron.paginas;

export function periode(key: string | undefined, standaard: string): { key: string; label: string; since: string; prevSince: string; tot: string } {
  const p = PERIODES.find((x) => x.key === key) ?? PERIODES.find((x) => x.key === standaard)!;
  const nu = Date.now();
  const since = new Date(nu - p.dagen * 86_400_000);
  const prev = new Date(nu - 2 * p.dagen * 86_400_000);
  return { key: p.key, label: p.label, since: since.toISOString(), prevSince: prev.toISOString(), tot: new Date(nu).toISOString() };
}

const fmtDag = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function AnalyticsShell({
  pagina,
  pad,
  periodeKey,
  tab,
  children,
}: {
  pagina: PaginaKey;
  pad: string;
  periodeKey?: string;
  tab?: string;
  children: React.ReactNode;
}) {
  const p = ANALYTICS[pagina];
  const per = periodeKey ? periode(periodeKey, periodeKey) : null;
  return (
    <div className="mx-auto max-w-[1120px]" data-analytics-page={pagina}>
      <h1 className="mb-4 text-[20px] font-semibold leading-7">{p.kop}</h1>
      <form action={pad} className="mb-4 flex flex-wrap items-center gap-3" data-analytics-filters>
        {p.filters.map((f) => {
          const werkend = f === p.periode_filter && per; // het gemeten filter dat de periode draagt (koude review AD 2.5 I-1)
          const opties = (bron.filter_opties as Record<string, string[]>)[f] ?? ['is any value'];
          const reden = pagina === 'sales' ? REDEN.betaal : pagina === 'subscriptions' ? REDEN.leden : pagina === 'people' ? REDEN.leden : REDEN.kijkplatform;
          return (
            <label key={f} className="flex items-center gap-2 text-[13px]" data-filter={f}>
              <span style={{ color: 'var(--ad-muted-fg)' }}>{f}</span>
              {werkend ? (
                <select name="period" defaultValue={per.key} className="ad-select !w-52">
                  {PERIODES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              ) : (
                <select className="ad-select !w-40" disabled title={`${f} — filter niet gebouwd (${reden})`} defaultValue={opties[0]}>
                  {opties.map((o) => <option key={o}>{o}</option>)}
                </select>
              )}
            </label>
          );
        })}
        {per && <button type="submit" className="ad-btn ad-btn-outline">Update</button>}
        {per && per.key !== 'anytime' && <span className="ad-help" data-periode-bereik>{fmtDag(per.since)} - {fmtDag(per.tot)} vs. {fmtDag(per.prevSince)} - {fmtDag(new Date(Date.parse(per.since) - 86_400_000).toISOString())}</span>}
        {tab && <input type="hidden" name="tab" value={tab} />}
      </form>
      {p.tabs.length > 0 && (
        <nav role="tablist" className="mb-4 flex gap-1" data-analytics-tabs style={{ borderBottom: '1px solid var(--ad-border)' }}>
          {p.tabs.map((t, i) => {
            const actief = (tab ?? p.tabs[0]) === t;
            const href = `${pad}?${new URLSearchParams({ ...(per ? { period: per.key } : {}), ...(i === 0 ? {} : { tab: t }) }).toString()}`.replace(/\?$/, '');
            return (
              <Link key={t} href={href} role="tab" aria-selected={actief} className="px-3 py-2 text-[14px]" style={{ borderBottom: actief ? '2px solid var(--ad-primary)' : '2px solid transparent', color: actief ? 'var(--ad-fg)' : 'var(--ad-muted-fg)' }}>
                {t}
              </Link>
            );
          })}
        </nav>
      )}
      {children}
      <p className="ad-help mt-6">Uscreen: Omni-dashboard (iframe) — hier eigen tegels; geen export (Uscreen ook niet).</p>
    </div>
  );
}

/** KPI-tegel: echte waarde, of leeg ("—") met reden. */
export function Tegel({ titel, waarde, reden, sub }: { titel: string; waarde?: string | number | null; reden?: string; sub?: string }) {
  const leeg = waarde === null || waarde === undefined;
  return (
    <div className="ad-card p-5" data-tegel={titel} data-leeg={leeg}>
      <span className="block text-[14px]" style={{ color: 'var(--ad-muted-fg)' }} data-tegel-titel>{titel} ›</span>
      <span className="mt-1 block text-[22px] font-semibold leading-7" data-tegel-waarde>{leeg ? '—' : typeof waarde === 'number' ? waarde.toLocaleString('en-US') : waarde}</span>
      {leeg && reden && <span className="ad-help block" data-tegel-reden>{reden}</span>}
      {sub && <span className="ad-help block" data-tegel-sub>{sub}</span>}
    </div>
  );
}

/** Grafiek-/tabelblok zonder data: titel + reden (Uscreen-tegel als structuur). */
export function Blok({ titel, reden, children }: { titel: string; reden?: string; children?: React.ReactNode }) {
  return (
    <section className="ad-card mb-4 p-5" data-blok={titel}>
      <h2 className="text-[16px] font-semibold">{titel}</h2>
      {children ?? <p className="ad-help mt-2" data-blok-reden>{reden}</p>}
    </section>
  );
}
