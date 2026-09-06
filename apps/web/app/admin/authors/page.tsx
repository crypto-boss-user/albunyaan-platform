import { requireAdmin } from '../../../lib/admin';
import NogNietGebouwd from '../../../components/admin/NogNietGebouwd';

export const dynamic = 'force-dynamic';

/** AD 1.1 placeholder — gemeten kop uit AD0-inventaris.md; gebouwd in AD stap 3. */
export default async function Page() {
  await requireAdmin();
  return <NogNietGebouwd kop="Authors" stap={3} tekst="Uscreen: No authors yet (0)." />;
}
