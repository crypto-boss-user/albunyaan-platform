import { redirect } from 'next/navigation';
import { requireAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';

/** AD 1.4: /admin/members is opgegaan in People › All (/admin/people, Uscreen-naam); oude links blijven werken. */
export default async function AdminMembersRedirect({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin(); // Codex A-i (T-5, T0): dezelfde poort als elke /admin-pagina — anoniem → /login, geen omweg via de bestemming
  const { q } = await searchParams;
  redirect(typeof q === 'string' && q ? `/admin/people?q=${encodeURIComponent(q)}` : '/admin/people');
}
