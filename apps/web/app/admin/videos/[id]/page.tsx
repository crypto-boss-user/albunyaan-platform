import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getVideoForAdmin } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';
import EditVideoForm from './EditVideoForm';

export const dynamic = 'force-dynamic';

export default async function AdminVideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const video = await getVideoForAdmin(id);
  if (!video) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/admin/videos" className="text-[13px] font-semibold text-ink-muted hover:text-brand transition">← Videos</Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink mt-2">{video.title}</h1>
        <p className="text-[12px] text-ink-muted mt-1 font-mono">{video.slug}</p>
      </div>

      <div className="rounded-2xl bg-white border border-black/10 p-6">
        <EditVideoForm video={video} />
      </div>
    </div>
  );
}
