import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** AD 1.5: vouchers zijn Marketing › Coupons geworden (Uscreen-naam); oude links blijven werken. */
export default async function AdminVouchersRedirect() {
  redirect('/admin/marketing/coupons');
}
