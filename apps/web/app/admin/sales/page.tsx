import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';

/** Uscreen: Sales-menu → /sales/invoices (enige subsectie, AD0-inventaris §2.6). Gate vóór de redirect (koude review AD 2.1, M-1): anoniem → /login, niet naar het doel. */
export default async function SalesIndex() {
  await requireAdmin();
  redirect('/admin/sales/invoices');
}
