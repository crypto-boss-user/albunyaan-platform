import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** AD 1.4: /admin/members is opgegaan in People › All (/admin/people, Uscreen-naam); oude links blijven werken. */
export default async function AdminMembersRedirect({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  redirect(typeof q === 'string' && q ? `/admin/people?q=${encodeURIComponent(q)}` : '/admin/people');
}
