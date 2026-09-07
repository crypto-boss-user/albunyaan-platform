import Link from 'next/link';
import { countSignupsSince, getRecentAuditEntries } from '@albunyaan/core/data';
import { requireAdmin } from '../../lib/admin';

export const dynamic = 'force-dynamic';

/**
 * Home in de Uscreen-vorm (AD 2.1; norm AD0-inventaris §2.4, home.json 2026-09-07): kopbalk "Welcome, <naam>." (AdminTopbar), blok
 * "Last 30-day performance" met drie tegels + "View more". Sign Ups = echt (people.signup_at in de laatste 30 dagen, exacte telling).
 * Gross Revenue en Video Views = VOORBEELD met label en tooltip tot de betaal-/kijkplatformkoppeling (founder 2026-09-07, vraag 5, B84);
 * de voorbeeldwaarden zijn de meetwaarden van 07-09. Membership+-upsell = Uscreen-reclame, niet nagebouwd. Recent activity (eigen,
 * audit-log) blijft eronder (werklijst §8: EXTRA behouden).
 */
const VOORBEELD_TOOLTIP = 'echte cijfers na betaal-/kijkplatformkoppeling';
const DAGEN = 30;

interface Tegel {
  titel: string;
  waarde: string;
  href: string;
  voorbeeld: boolean;
  icoon: React.ReactNode;
}

export default async function AdminHome() {
  await requireAdmin(); // full gate: session + roster + aal2
  const sinds = new Date(Date.now() - DAGEN * 24 * 60 * 60 * 1000).toISOString();
  const [signups, audit] = await Promise.all([countSignupsSince(sinds), getRecentAuditEntries(12)]);

  const tegels: Tegel[] = [
    {
      titel: 'Gross Revenue',
      waarde: '841.02 EUR',
      href: '/admin/analytics/sales',
      voorbeeld: true,
      icoon: (
        <>
          <rect width="20" height="12" x="2" y="6" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
        </>
      ),
    },
    {
      titel: 'Sign Ups',
      waarde: signups.toLocaleString('en-US'),
      href: '/admin/people',
      voorbeeld: false,
      icoon: (
        <>
          <path d="M2 21a8 8 0 0 1 13.292-6" />
          <circle cx="10" cy="8" r="5" />
          <path d="M19 16v6M22 19h-6" />
        </>
      ),
    },
    {
      titel: 'Video Views',
      waarde: '44,455',
      href: '/admin/analytics/content',
      voorbeeld: true,
      icoon: <path d="M5 3l14 9-14 9V3z" />,
    },
  ];

  return (
    <div className="mx-auto max-w-[1120px]" data-admin-home>
      <h1 className="mb-6 text-[20px] font-semibold leading-7">Last {DAGEN}-day performance</h1>
      <div className="grid grid-cols-3 gap-4" data-home-tegels>
        {tegels.map((t) => (
          <div key={t.titel} className="ad-card p-6" data-home-tile={t.titel} data-voorbeeld={t.voorbeeld}>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md" style={{ border: '1px solid var(--ad-border)', color: 'var(--ad-muted-fg)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {t.icoon}
                </svg>
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[18px] font-semibold leading-6" data-tile-value>{t.waarde}</span>
                  {t.voorbeeld && (
                    <span className="ad-badge ad-badge-scheduled" title={VOORBEELD_TOOLTIP} data-voorbeeld-label>
                      VOORBEELD
                    </span>
                  )}
                </div>
                <span className="block text-[14px]" style={{ color: 'var(--ad-muted-fg)' }} data-tile-title>{t.titel}</span>
              </div>
            </div>
            <Link href={t.href} className="mt-4 inline-block text-[14px] font-medium" style={{ color: 'var(--ad-muted-fg)' }}>
              View more
            </Link>
          </div>
        ))}
      </div>

      <section className="mt-8" data-recent-activity>
        <h2 className="mb-3 text-[16px] font-semibold">Recent activity</h2>
        <div className="ad-card" style={{ overflow: 'hidden' }}>
          {audit.length === 0 ? (
            <p className="p-5 ad-help">No admin actions logged yet.</p>
          ) : (
            audit.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3 text-[13px]" style={{ borderBottom: '1px solid var(--ad-border)' }}>
                <span className="font-medium">{e.action}{e.entity ? ` · ${e.entity}` : ''}{e.entity_id ? ` (${e.entity_id.slice(0, 8)}…)` : ''}</span>
                <time className="tabular-nums" style={{ color: 'var(--ad-muted-fg)' }}>{new Date(e.created_at).toISOString().replace('T', ' ').slice(0, 16)}</time>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
