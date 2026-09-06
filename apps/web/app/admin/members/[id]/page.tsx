import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** AD 1.4: /admin/members/<id> → /admin/people/<id> (People › All, Uscreen-naam); oude links blijven werken. */
export default async function AdminMemberRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/people/${encodeURIComponent(id)}`);
}
