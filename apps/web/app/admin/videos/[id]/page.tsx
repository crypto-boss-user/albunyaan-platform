import { notFound } from 'next/navigation';
import { getAllCategories, getVideoCategoryIds, getVideoFilterValueIds, getVideoForAdmin, listFiltersForAdmin } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';
import EditVideoForm from './EditVideoForm';

export const dynamic = 'force-dynamic';

/** Content › Videos › Details in de Uscreen-vorm (AD 1.2; norm AD0-inventaris §2.1). */
export default async function AdminVideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const video = await getVideoForAdmin(id);
  if (!video) notFound();
  const [categories, categoryIds, filters, filterValueIds] = await Promise.all([getAllCategories(), getVideoCategoryIds(id), listFiltersForAdmin(), getVideoFilterValueIds(id)]);

  return <EditVideoForm video={video} categories={categories.map((c) => ({ id: c.id, name: c.name }))} categoryIds={categoryIds} filters={filters} filterValueIds={filterValueIds} />;
}
