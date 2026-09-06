import { requireAdmin } from '../../../../../lib/admin';
import NewCouponForm from './NewCouponForm';

export const dynamic = 'force-dynamic';

/** Marketing › Coupons › New coupon (AD 1.5; norm AD0-inventaris §2.3 "Coupon-formulier"). */
export default async function NewCouponPage() {
  await requireAdmin('admin');
  return <NewCouponForm />;
}
