import { listVouchers } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import CreateVoucherForm from './CreateVoucherForm';
import { disableVoucherAction } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_DOT: Record<string, string> = { active: 'bg-brand', disabled: 'bg-ink-muted', expired: 'bg-amber-500' };

export default async function AdminVouchersPage() {
  await requireAdmin();
  const vouchers = await listVouchers();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1">Billing</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Vouchers</h1>
      </div>

      <CreateVoucherForm />

      <div className="rounded-2xl bg-white border border-black/10 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-black/10 text-left text-ink-muted">
              <th className="px-4 py-2.5 font-semibold">Code</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">Duration</th>
              <th className="px-4 py-2.5 font-semibold">Redemptions</th>
              <th className="px-4 py-2.5 font-semibold">Sponsor</th>
              <th className="px-4 py-2.5 font-semibold">Expires</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {vouchers.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-muted">No vouchers minted yet.</td></tr>
            )}
            {vouchers.map((v) => (
              <tr key={v.id} className="hover:bg-surface/60">
                <td className="px-4 py-2.5 font-mono font-medium text-ink">{v.code}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[v.status]}`} />
                    {v.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ink-secondary">{v.duration_days}d</td>
                <td className="px-4 py-2.5 text-ink-secondary tabular-nums">{v.redemption_count} / {v.max_redemptions}</td>
                <td className="px-4 py-2.5 text-ink-secondary">{v.sponsor_label ?? '—'}</td>
                <td className="px-4 py-2.5 text-ink-secondary">{v.expires_at ? new Date(v.expires_at).toISOString().slice(0, 10) : '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  {v.status === 'active' && (
                    <form action={disableVoucherAction}>
                      <input type="hidden" name="id" value={v.id} />
                      <button className="px-3 py-1 rounded-full border border-black/10 text-[12px] font-semibold text-ink-secondary hover:border-red-400 hover:text-red-600 transition">
                        Disable
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
