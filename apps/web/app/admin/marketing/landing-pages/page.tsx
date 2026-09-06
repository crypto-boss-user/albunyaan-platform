import { requireAdmin } from '../../../../lib/admin';
import NogNietGebouwd from '../../../../components/admin/NogNietGebouwd';

export const dynamic = 'force-dynamic';

/** AD 1.1 placeholder — gemeten kop uit AD0-inventaris.md; gebouwd in AD stap 5. */
export default async function Page() {
  await requireAdmin();
  return <NogNietGebouwd kop="Landing pages" stap={5} tekst="Lijst van 9 pagina's, instellingen en inhoud uit SR 2b." />;
}
