import { redirect } from 'next/navigation';
import { getAuthUser } from '../../lib/session';
import CouponForm from './CouponForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Coupon — Albunyaan TV' };

export default async function CouponPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  return (
    <div className="max-w-md mx-auto px-5 py-24">
      <div className="text-center mb-8">
        <p className="section-label">Gift</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-3">Redeem a coupon</h1>
        <p className="text-[15px] text-ink-secondary leading-relaxed">
          Have a voucher code from a masjid, sponsor, or gift? Enter it below to activate your access.
        </p>
      </div>
      <CouponForm />
    </div>
  );
}
