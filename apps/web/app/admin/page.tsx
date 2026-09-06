import Link from 'next/link';
import { getRecentAuditEntries } from '@albunyaan/core/data';
import { requireAdmin } from '../../lib/admin';

export const dynamic = 'force-dynamic';

const CARDS = [
  { href: '/admin/videos', title: 'Videos', body: 'Publish, unpublish, edit titles & age ratings.' },
  { href: '/admin/vouchers', title: 'Vouchers', body: 'Mint and revoke access vouchers.' },
  { href: '/admin/people', title: 'People', body: 'Look up members, memberships & billing.' },
];

export default async function AdminDashboard() {
  await requireAdmin(); // full gate: session + roster + aal2
  const audit = await getRecentAuditEntries(12);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1">Dashboard</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Admin console</h1>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="block p-5 rounded-2xl bg-white border border-black/10 hover:border-brand/40 transition">
            <h2 className="font-bold text-ink mb-1">{c.title}</h2>
            <p className="text-[13px] text-ink-secondary leading-relaxed">{c.body}</p>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted mb-3">Recent activity</h2>
        <div className="rounded-2xl bg-white border border-black/10 divide-y divide-black/5">
          {audit.length === 0 ? (
            <p className="p-5 text-[13px] text-ink-muted">No admin actions logged yet.</p>
          ) : (
            audit.map((e) => (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink">{e.action}{e.entity ? ` · ${e.entity}` : ''}{e.entity_id ? ` (${e.entity_id.slice(0, 8)}…)` : ''}</span>
                <time className="text-ink-muted tabular-nums">{new Date(e.created_at).toISOString().replace('T', ' ').slice(0, 16)}</time>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
