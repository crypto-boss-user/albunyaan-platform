import Link from 'next/link';
import { VOUCHER_NO_LIMIT, listVouchers } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';
import ConfirmDelete from '../../../../components/admin/ConfirmDelete';
import { fmtDate } from '../../../../components/admin/format';
import { disableVoucherAction } from '../../vouchers/actions';

export const dynamic = 'force-dynamic';

/**
 * Marketing › Coupons in de Uscreen-vorm (AD 1.5; norm AD0-inventaris §2.3) op de bestaande vouchers-tabel: kop + New coupon,
 * zoekveld "Search by coupon code", filters (discount type / products: één waarde in deze DB → uitgeschakeld met reden; expirations werkt),
 * tabel Coupon · Discount · Redeemed · Status · Expires, ⋯ → Deactivate. Een voucher = 100 % off (gratis toegang) voor N dagen.
 */
const EXP = ['all', 'never', 'expires', 'expired'] as const;

export default async function AdminCouponsPage({ searchParams }: { searchParams: Promise<{ q?: string; exp?: string }> }) {
  const { admin } = await requireAdmin();
  const magMinten = admin.role === 'admin' || admin.role === 'owner'; // minten/deactiveren = admin-rol (actions); anders geen dode knop
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toUpperCase();
  const exp = (EXP as readonly string[]).includes(sp.exp ?? '') ? (sp.exp as (typeof EXP)[number]) : 'all';
  const alle = await listVouchers(1000);
  const nu = Date.now();
  const rows = alle.filter((v) => (!q || v.code.includes(q)) && (exp === 'all' || (exp === 'never' ? !v.expires_at : exp === 'expires' ? !!v.expires_at && new Date(v.expires_at).getTime() >= nu : !!v.expires_at && new Date(v.expires_at).getTime() < nu)));
  const statusLabel = (v: (typeof alle)[number]) => (v.status === 'active' && v.expires_at && new Date(v.expires_at).getTime() < nu ? 'Expired' : v.status === 'active' ? 'Active' : v.status === 'disabled' ? 'Deactivated' : 'Expired');

  return (
    <div className="mx-auto max-w-[1120px]" data-coupons-page>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold leading-7">Coupons</h1>
          <p className="ad-help">Stats: wacht op de betaalbeslissing (geen betalingen op dit platform).</p>
        </div>
        {magMinten ? <Link href="/admin/marketing/coupons/new" className="ad-btn ad-btn-primary">New coupon</Link> : <button type="button" className="ad-btn ad-btn-primary" disabled title="New coupon — alleen admin/owner">New coupon</button>}
      </div>
      <div className="ad-card">
        <form action="/admin/marketing/coupons" className="flex flex-wrap items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--ad-border)' }}>
          <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Search by coupon code" aria-label="Search by coupon code" className="ad-input !w-64" />
          <select aria-label="All discount types" className="ad-select !w-44" disabled title="Alleen 100 % off (vouchers = gratis toegang); percentage/vast bedrag wacht op de betaalbeslissing"><option>All discount types</option></select>
          <select aria-label="All products" className="ad-select !w-40" disabled title="Alleen Subscription; bundles/content wachten op de betaalbeslissing"><option>All products</option></select>
          <select name="exp" defaultValue={exp} aria-label="All expirations" className="ad-select !w-44">
            <option value="all">All expirations</option>
            <option value="never">Never expires</option>
            <option value="expires">Expires on</option>
            <option value="expired">Expired</option>
          </select>
          <button type="submit" className="ad-btn ad-btn-outline">Apply</button>
        </form>
        <table className="ad-table" data-coupons-table>
          <thead><tr><th>Coupon</th><th>Discount</th><th>Redeemed</th><th>Status</th><th>Expires</th><th className="w-10"></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="!py-10 text-center" style={{ color: 'var(--ad-muted-fg)' }}>{alle.length === 0 ? 'No coupons yet.' : 'No coupons match.'}</td></tr>}
            {rows.map((v) => (
              <tr key={v.id} data-coupon-row={v.code}>
                <td><span className="font-mono font-medium">{v.code}</span>{v.sponsor_label && <span className="ad-help ml-2">{v.sponsor_label}</span>}</td>
                <td>100% Off · Subscription · {v.duration_days} days{v.max_redemptions === 1 ? ' · Once' : ''}</td>
                <td className="tabular-nums">{v.redemption_count}{v.max_redemptions < VOUCHER_NO_LIMIT ? `/${v.max_redemptions}` : ''}</td>
                <td><span className={statusLabel(v) === 'Active' ? 'ad-badge ad-badge-published' : 'ad-badge ad-badge-muted'}>{statusLabel(v)}</span></td>
                <td style={{ color: 'var(--ad-muted-fg)' }}>{v.expires_at ? fmtDate(v.expires_at) : 'Never'}</td>
                <td>
                  {v.status === 'active' && magMinten && (
                    <ConfirmDelete label="Deactivate" text={`Deactivate coupon ${v.code}? Future redemptions are blocked; past redemptions stand.`} action={disableVoucherAction} hidden={{ id: v.id }} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ad-help p-4">{alle.length.toLocaleString('en-US')} coupons</p>
      </div>
    </div>
  );
}
