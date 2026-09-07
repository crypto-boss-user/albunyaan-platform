import NogNietGebouwd from '../../../../components/admin/NogNietGebouwd';
import { requireAdmin } from '../../../../lib/admin';

export const dynamic = 'force-dynamic';

/** Placeholder tot AD 2.5 (sessie D deel 2); gemeten kop "Marketing" (AD0-inventaris §2.4–§2.8). */
export default async function Page() {
  await requireAdmin();
  return <NogNietGebouwd kop="Marketing" stap="2.5" />;
}
