import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../../lib/admin';

export const dynamic = 'force-dynamic';

/** AD 1.4: /admin/members/<id> → /admin/people/<id> (People › All, Uscreen-naam); oude links blijven werken. */
export default async function AdminMemberRedirect({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(); // Codex A-i (T-5, T0): dezelfde poort als elke /admin-pagina — anoniem → /login, geen omweg via de bestemming
  const { id } = await params;
  redirect(`/admin/people/${encodeURIComponent(id)}`);
}
