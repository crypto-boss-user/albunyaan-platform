import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';

/** Uscreen: /manage/analytics → Overview (menu-inventaris: Analytics-href = /analytics/overview). Gate vóór de redirect (koude review AD 2.1, M-1): anoniem → /login, niet naar het doel. */
export default async function AnalyticsIndex() {
  await requireAdmin();
  redirect('/admin/analytics/overview');
}
