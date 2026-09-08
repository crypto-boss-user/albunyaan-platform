import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';

/** AD 1.5: vouchers zijn Marketing › Coupons geworden (Uscreen-naam); oude links blijven werken. */
export default async function AdminVouchersRedirect() {
  await requireAdmin(); // Codex A-i (T-5, T0): dezelfde poort als elke /admin-pagina — anoniem → /login, geen omweg via de bestemming
  redirect('/admin/marketing/coupons');
}
