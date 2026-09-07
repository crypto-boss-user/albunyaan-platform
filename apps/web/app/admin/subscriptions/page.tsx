import Link from 'next/link';
import { countSubscriptionsPerPlan, listPlansForAdmin } from '@albunyaan/core/data';
import ConfirmDelete from '../../../components/admin/ConfirmDelete';
import { hasRole, requireAdmin } from '../../../lib/admin';
import { deletePlanAction } from './actions';
import { BILLING_LABEL, REDEN_BETAAL } from './plan-form';

export const dynamic = 'force-dynamic';

/**
 * Subscriptions in de Uscreen-vorm (AD 2.3; norm AD0-inventaris §2.5, subscriptions-lijst.json 2026-09-07): kop + New plan; blok
 * "Performance overview" + See breakdown (tegels leeg met reden: subscriptions-tabel 0 rijen tot de ledenmigratie/betaalbeslissing; geen
 * voorbeeldcijfers buiten Home — founder vraag 5); zoekveld; tabel Plan (+ apps-badge) · Visibility · In trial · Members · Content · Price ·
 * Billing; rij → Edit. De 11 Uscreen-plannen zijn als data geïmporteerd (vraag 7), zonder ledenkoppeling.
 */
export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { admin } = await requireAdmin();
  const magBewerken = hasRole(admin.role, 'admin'); // Delete alleen tonen als de action het toestaat (koude review AD 2.3 I-1)
  const { q = '' } = await searchParams;
  const [plans, perPlan] = await Promise.all([listPlansForAdmin(q || undefined), countSubscriptionsPerPlan()]);
  const totaalLeden = Array.from(perPlan.values()).reduce((n, v) => n + v.members, 0);
  const totaalTrial = Array.from(perPlan.values()).reduce((n, v) => n + v.trial, 0);
  const TEGELS = [
    { titel: 'total members', waarde: totaalLeden, reden: 'ledenkoppeling volgt de ledenmigratie' },
    { titel: 'on trial', waarde: totaalTrial, reden: 'ledenkoppeling volgt de ledenmigratie' },
    { titel: 'MRR', waarde: null as number | null, reden: REDEN_BETAAL },
  ];
  return (
    <div className="mx-auto max-w-[1120px]" data-subscriptions-page>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7">Subscriptions</h1>
        <div className="flex items-center gap-3">
          <span className="ad-help">{REDEN_BETAAL}</span>
          {magBewerken ? (
            <Link href="/admin/subscriptions/new" className="ad-btn ad-btn-primary">New plan</Link>
          ) : (
            <button type="button" className="ad-btn ad-btn-primary" disabled title="New plan — vereist de admin-rol">New plan</button>
          )}
        </div>
      </div>

      <section className="ad-card mb-6 p-6" data-performance-overview>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Performance overview</h2>
          <Link href="/admin/analytics/subscriptions" className="text-[14px]" style={{ color: 'var(--ad-primary)' }}>See breakdown</Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {TEGELS.map((t) => (
            <div key={t.titel} className="rounded-md p-4" style={{ border: '1px solid var(--ad-border)' }} data-overview-tile={t.titel}>
              <span className="block text-[18px] font-semibold" data-tile-value>{t.waarde === null ? '—' : t.waarde.toLocaleString('en-US')}</span>
              <span className="ad-help">{t.titel}</span>
              <span className="ad-help block" data-tile-reden>{t.waarde === null || t.waarde === 0 ? t.reden : ''}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="ad-card">
        <form action="/admin/subscriptions" className="p-4" style={{ borderBottom: '1px solid var(--ad-border)' }}>
          <input type="search" name="q" defaultValue={q} placeholder="Search" aria-label="Search" className="ad-input !w-64" />
        </form>
        <table className="ad-table" data-plans-table>
          <thead>
            <tr><th>Plan</th><th>Visibility</th><th>In trial</th><th>Members</th><th>Content</th><th>Price</th><th>Billing</th><th /></tr>
          </thead>
          <tbody>
            {plans.length === 0 && <tr><td colSpan={8} className="ad-help">No plans{q ? ` for "${q}"` : ''}.</td></tr>}
            {plans.map((p) => {
              const c = perPlan.get(p.id);
              return (
                <tr key={p.id} data-plan-row={p.id}>
                  <td>
                    <Link href={`/admin/subscriptions/${p.id}/edit`} className="font-medium" data-plan-title>{p.title}</Link>
                    {p.raw?.apps_badge && <span className="ad-badge ad-badge-muted ml-2">{p.raw.apps_badge}</span>}
                  </td>
                  <td>{p.visibility === 'public' ? 'Public' : 'Private'}</td>
                  <td>{c?.trial ? c.trial : '-'}</td>
                  <td>{c?.members ? c.members : '-'}</td>{/* Uscreen linkt naar People met planfilter; die filter bestaat pas na de ledenmigratie (koude review M-7) */}
                  <td title={`Manage content — ${REDEN_BETAAL}`}>—</td>
                  <td>€{(p.amount_cents / 100).toFixed(2)}</td>
                  <td>{BILLING_LABEL[p.billing_period] ?? p.billing_period}</td>
                  <td className="text-right">
                    <details className="ad-rowmenu">
                      <summary className="ad-btn ad-btn-ghost !h-8 !w-8 !p-0 justify-center" aria-label={`More options for ${p.title}`}>⋯</summary>
                      <div>
                        <Link href={`/admin/subscriptions/${p.id}/edit`}>Edit</Link>
                        {magBewerken ? (
                          <ConfirmDelete label="Delete" text={`Delete the plan "${p.title}"? Only possible when no subscriptions, entitlements or coupons reference it.`} action={deletePlanAction} hidden={{ plan_id: p.id }} />
                        ) : (
                          <button type="button" disabled title="Delete — verwijderen vereist de admin-rol">Delete</button>
                        )}
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="ad-help p-4" data-plans-count>{plans.length} plans</p>
      </div>
    </div>
  );
}
