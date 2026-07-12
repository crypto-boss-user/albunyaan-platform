import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMemberDetail, isEntitlementActive } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';

export const dynamic = 'force-dynamic';

const ENT_DOT: Record<string, string> = {
  active: 'bg-brand', trialing: 'bg-brand', past_due: 'bg-amber-500', canceled: 'bg-ink-muted', expired: 'bg-ink-muted',
};

export default async function AdminMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getMemberDetail(id);
  if (!detail) notFound();

  const { person, entitlements, household, profiles } = detail;
  const hasAccess = entitlements.some((e) => isEntitlementActive(e));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/members" className="text-[13px] font-semibold text-ink-muted hover:text-brand transition">← Members</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{person.email}</h1>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${hasAccess ? 'bg-brand-soft text-brand-dark' : 'bg-black/5 text-ink-muted'}`}>
            {hasAccess ? 'Has access' : 'No access'}
          </span>
        </div>
        {person.full_name && <p className="text-[13px] text-ink-secondary mt-1">{person.full_name}</p>}
      </div>

      <div className="rounded-2xl bg-white border border-black/10 p-6">
        <h2 className="font-bold text-ink mb-3">Account</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-[13px]">
          <dt className="text-ink-muted">Person id</dt><dd className="font-mono text-ink">{person.id}</dd>
          <dt className="text-ink-muted">Auth linked</dt><dd className="text-ink">{person.auth_user_id ? 'Yes' : 'No — never logged in'}</dd>
          <dt className="text-ink-muted">Legacy cohort</dt><dd className="text-ink">{person.legacy_cohort ?? '—'}</dd>
          <dt className="text-ink-muted">Stripe customer</dt><dd className="font-mono text-ink">{person.stripe_customer_id ?? '—'}</dd>
        </dl>
      </div>

      <div className="rounded-2xl bg-white border border-black/10 p-6">
        <h2 className="font-bold text-ink mb-3">Entitlements</h2>
        {entitlements.length === 0 ? (
          <p className="text-[13px] text-ink-muted">No entitlements on record.</p>
        ) : (
          <div className="divide-y divide-black/5">
            {entitlements.map((e) => (
              <div key={e.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-[13px]">
                <div>
                  <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                    <span className={`w-1.5 h-1.5 rounded-full ${ENT_DOT[e.status] ?? 'bg-ink-muted'}`} />
                    {e.status} · {e.provider}
                  </span>
                  {e.plan && <p className="text-ink-secondary mt-0.5">{e.plan.title} — {(e.plan.amount_cents / 100).toFixed(2)} {e.plan.currency}/{e.plan.billing_period}</p>}
                </div>
                <div className="text-right text-ink-muted">
                  {e.current_period_end && <p>until {new Date(e.current_period_end).toISOString().slice(0, 10)}</p>}
                  {e.provider_ref && <p className="font-mono text-[11px]">{e.provider_ref}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-white border border-black/10 p-6">
        <h2 className="font-bold text-ink mb-3">Household</h2>
        {!household ? (
          <p className="text-[13px] text-ink-muted">No household set up yet.</p>
        ) : (
          <div className="text-[13px] space-y-2">
            <p className="text-ink"><span className="text-ink-muted">PIN set:</span> {household.pin_hash ? 'Yes' : 'No'}</p>
            <p className="text-ink-secondary">{profiles.length} profile(s): {profiles.map((p) => `${p.name} (${p.kind})`).join(', ') || '—'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
