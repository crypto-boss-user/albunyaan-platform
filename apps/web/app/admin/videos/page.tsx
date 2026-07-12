import Link from 'next/link';
import { listVideosForAdmin, type AdminVideoRow } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import { fmtDuration } from '../../../components/ThumbCard';
import { toggleVideoStatusAction } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_TABS: Array<{ key: AdminVideoRow['status'] | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Draft' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'live', label: 'Live channels' },
];

const STATUS_DOT: Record<AdminVideoRow['status'], string> = {
  published: 'bg-brand',
  live: 'bg-red-600',
  draft: 'bg-ink-muted',
  scheduled: 'bg-amber-500',
};

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q ?? '';
  const status = (sp.status ?? 'all') as AdminVideoRow['status'] | 'all';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const { videos, total, perPage } = await listVideosForAdmin({
    q: q || undefined,
    status: status === 'all' ? undefined : status,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const qs = (over: Record<string, string | number>) => {
    const merged = { q, status, page: 1, ...over };
    const params = new URLSearchParams();
    if (merged.q) params.set('q', String(merged.q));
    if (merged.status && merged.status !== 'all') params.set('status', String(merged.status));
    if (merged.page && Number(merged.page) > 1) params.set('page', String(merged.page));
    const s = params.toString();
    return s ? `?${s}` : '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1">Catalog</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Videos</h1>
        </div>
        <p className="text-[13px] text-ink-muted">{total.toLocaleString()} total</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <form action="/admin/videos" className="flex items-center gap-2">
          <input type="hidden" name="status" value={status} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by title…"
            className="w-64 px-4 py-2 rounded-full border border-black/15 text-[13px] focus:border-brand focus:outline-none"
          />
          <button type="submit" className="px-4 py-2 rounded-full bg-ink text-white text-[13px] font-semibold">Search</button>
        </form>

        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/videos${qs({ status: t.key })}`}
              className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition ${
                status === t.key ? 'bg-brand text-white' : 'bg-white border border-black/10 text-ink-secondary hover:border-brand/40'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-black/10 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-black/10 text-left text-ink-muted">
              <th className="px-4 py-2.5 font-semibold">Title</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">Access</th>
              <th className="px-4 py-2.5 font-semibold">Age</th>
              <th className="px-4 py-2.5 font-semibold">Duration</th>
              <th className="px-4 py-2.5 font-semibold">Bunny</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {videos.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-muted">No videos match.</td></tr>
            )}
            {videos.map((v) => (
              <tr key={v.id} className="hover:bg-surface/60">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/videos/${v.id}`} className="font-medium text-ink hover:text-brand transition line-clamp-1">
                    {v.title}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[v.status]}`} />
                    {v.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ink-secondary">{v.access}</td>
                <td className="px-4 py-2.5 text-ink-secondary">{v.age_rating}</td>
                <td className="px-4 py-2.5 text-ink-secondary tabular-nums">{v.duration_seconds ? fmtDuration(v.duration_seconds) : '—'}</td>
                <td className="px-4 py-2.5">{v.bunny_video_id ? '✓' : <span className="text-ink-muted">—</span>}</td>
                <td className="px-4 py-2.5 text-right">
                  {(v.status === 'published' || v.status === 'draft') && (
                    <form action={toggleVideoStatusAction}>
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="nextStatus" value={v.status === 'published' ? 'draft' : 'published'} />
                      <button className="px-3 py-1 rounded-full border border-black/10 text-[12px] font-semibold text-ink-secondary hover:border-brand/40 hover:text-brand transition">
                        {v.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-[13px]">
          <Link
            href={`/admin/videos${qs({ page: Math.max(1, page - 1) })}`}
            aria-disabled={page <= 1}
            className={`px-3 py-1.5 rounded-full border border-black/10 ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:border-brand/40'}`}
          >
            ← Prev
          </Link>
          <span className="text-ink-muted">Page {page} of {totalPages}</span>
          <Link
            href={`/admin/videos${qs({ page: Math.min(totalPages, page + 1) })}`}
            aria-disabled={page >= totalPages}
            className={`px-3 py-1.5 rounded-full border border-black/10 ${page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:border-brand/40'}`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
