import { notFound } from 'next/navigation';
import { getAllCategories, getVideoCategoryIds, getVideoFilterValueIds, getVideoForAdmin, listFiltersForAdmin } from '@albunyaan/core/data';
import { hasRole, requireAdmin } from '../../../../lib/admin';
import EditVideoForm from './EditVideoForm';

export const dynamic = 'force-dynamic';

/** Content › Videos › Details in de Uscreen-vorm (AD 1.2; norm AD0-inventaris §2.1). */
export default async function AdminVideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { admin } = await requireAdmin();
  // updateVideoAction eist 'editor' (../actions.ts:37) — Save alleen actief als de action hem uitvoert,
  // anders eindigt een ingevuld formulier in notFound() en is het werk weg (Codex-review 2026-09-07 A-1).
  const magBewerken = hasRole(admin.role, 'editor');
  const { id } = await params;
  const video = await getVideoForAdmin(id);
  if (!video) notFound();
  const [categories, categoryIds, filters, filterValueIds] = await Promise.all([getAllCategories(), getVideoCategoryIds(id), listFiltersForAdmin(), getVideoFilterValueIds(id)]);

  return <EditVideoForm video={video} categories={categories.map((c) => ({ id: c.id, name: c.name }))} categoryIds={categoryIds} filters={filters} filterValueIds={filterValueIds} magBewerken={magBewerken} />;
}
