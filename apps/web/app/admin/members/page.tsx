import Link from 'next/link';
import { searchMembers } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminMembersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = '' } = await searchParams;
  const results = q.trim().length >= 2 ? await searchMembers(q) : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1">Support</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Members</h1>
      </div>

      <form action="/admin/members" className="flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by email or name…"
          className="w-80 px-4 py-2.5 rounded-full border border-black/15 text-[14px] focus:border-brand focus:outline-none"
        />
        <button type="submit" className="px-5 py-2.5 rounded-full bg-ink text-white text-[13px] font-semibold">Search</button>
      </form>

      {q.trim().length >= 1 && q.trim().length < 2 && (
        <p className="text-[13px] text-ink-muted">Type at least 2 characters.</p>
      )}

      {results.length > 0 && (
        <div className="rounded-2xl bg-white border border-black/10 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-black/10 text-left text-ink-muted">
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Cohort</th>
                <th className="px-4 py-2.5 font-semibold">Stripe</th>
                <th className="px-4 py-2.5 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {results.map((m) => (
                <tr key={m.id} className="hover:bg-surface/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/members/${m.id}`} className="font-medium text-ink hover:text-brand transition">{m.email}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary">{m.full_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-ink-secondary">{m.legacy_cohort ?? '—'}</td>
                  <td className="px-4 py-2.5">{m.stripe_customer_id ? '✓' : <span className="text-ink-muted">—</span>}</td>
                  <td className="px-4 py-2.5 text-ink-secondary">{new Date(m.created_at).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {q.trim().length >= 2 && results.length === 0 && (
        <p className="text-[13px] text-ink-muted">No members match “{q}”.</p>
      )}
    </div>
  );
}
