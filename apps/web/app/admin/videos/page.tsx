import Link from 'next/link';
import { ADMIN_VIDEO_SORTS, listVideosForAdmin, type AdminVideoRow, type AdminVideoSort } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import { BulkButtons, SelectAllCheckbox } from '../../../components/admin/VideoListControls';
import { STATUS_BADGE, STATUS_LABEL, fmtClock, fmtDate } from '../../../components/admin/format';
import { bulkVideoStatusAction, toggleVideoStatusAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Content › Videos in de Uscreen-vorm (AD 1.2; norm AD0-inventaris §2.1): kop "Videos" + Upload videos (uitgeschakeld tot de
 * kijkplatformkeuze), zoekveld, Status-combobox, sortering, tabel [bulk] · thumbnail+duur · titel · Status · Age (behouden, founder (c))
 * · Uploaded on · ⋯, paginering "Showing 1–30 of N videos", Rows per page.
 */
const STATUS_OPTIONS: { key: AdminVideoRow['status'] | 'all'; label: string }[] = [
  { key: 'all', label: 'Status' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Unpublished' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'live', label: 'Live' },
];
const PER_PAGE = [30, 50, 100];

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; page?: string; per?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const q = sp.q ?? '';
  const status = (STATUS_OPTIONS.some((o) => o.key === sp.status) ? sp.status : 'all') as AdminVideoRow['status'] | 'all';
  const sort = (ADMIN_VIDEO_SORTS.some((s) => s.key === sp.sort) ? sp.sort : 'newest') as AdminVideoSort;
  const perPage = PER_PAGE.includes(Number(sp.per)) ? Number(sp.per) : 30;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const { videos, total } = await listVideosForAdmin({ q: q || undefined, status: status === 'all' ? undefined : status, sort, page, perPage });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  const qs = (over: Record<string, string | number>) => {
    const merged: Record<string, string | number> = { q, status, sort, per: perPage, page: 1, ...over };
    const params = new URLSearchParams();
    if (merged.q) params.set('q', String(merged.q));
    if (merged.status && merged.status !== 'all') params.set('status', String(merged.status));
    if (merged.sort && merged.sort !== 'newest') params.set('sort', String(merged.sort));
    if (Number(merged.per) !== 30) params.set('per', String(merged.per));
    if (Number(merged.page) > 1) params.set('page', String(merged.page));
    const s = params.toString();
    return s ? `?${s}` : '';
  };
  const pageLinks = Array.from(new Set([1, 2, page - 1, page, page + 1, totalPages].filter((p) => p >= 1 && p <= totalPages))).sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7">Videos</h1>
        <div className="flex items-center gap-3">
          <span className="ad-help">Upload: na kijkplatformkeuze</span>
          <button type="button" className="ad-btn ad-btn-primary" disabled title="Upload videos — na kijkplatformkeuze">
            Upload videos
          </button>
        </div>
      </div>

      <div className="ad-card">
        <form action="/admin/videos" className="flex flex-wrap items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--ad-border)' }}>
          <input type="search" name="q" defaultValue={q} placeholder="Search..." aria-label="Search" className="ad-input !w-64" />
          <select name="status" defaultValue={status} aria-label="Status" className="ad-select !w-44">
            {STATUS_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <select name="sort" defaultValue={sort} aria-label="Sort" className="ad-select !w-44">
            {ADMIN_VIDEO_SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <input type="hidden" name="per" value={perPage} />
          <button type="submit" className="ad-btn ad-btn-outline">Apply</button>
          <div className="ml-auto">
            <BulkButtons />
          </div>
        </form>
        <form id="bulk" action={bulkVideoStatusAction} />

        <table className="ad-table" data-videos-table>
          <thead>
            <tr>
              <th className="w-8"><SelectAllCheckbox /></th>
              <th colSpan={2}>{total.toLocaleString('en-US')} videos</th>
              <th>Status</th>
              <th>Age</th>
              <th>Uploaded on</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {videos.length === 0 && (
              <tr><td colSpan={7} className="!py-10 text-center" style={{ color: 'var(--ad-muted-fg)' }}>No videos match.</td></tr>
            )}
            {videos.map((v) => (
              <tr key={v.id} data-video-row={v.id}>
                <td><input type="checkbox" name="ids" value={v.id} form="bulk" aria-label={`Select ${v.title}`} /></td>
                <td className="w-24">
                  <Link href={`/admin/videos/${v.id}`} className="relative block h-12 w-20 overflow-hidden rounded" style={{ background: 'var(--ad-secondary)' }}>
                    {v.thumbnail_url && <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                    <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] leading-4 text-white">{fmtClock(v.duration_seconds)}</span>
                  </Link>
                </td>
                <td>
                  <Link href={`/admin/videos/${v.id}`} className="font-medium hover:underline">{v.title}</Link>
                </td>
                <td><span className={STATUS_BADGE[v.status]}>{STATUS_LABEL[v.status]}</span></td>
                <td style={{ color: 'var(--ad-muted-fg)' }}>{v.age_rating}</td>
                <td style={{ color: 'var(--ad-muted-fg)' }}>{fmtDate(v.created_at)}</td>
                <td>
                  <details className="ad-rowmenu">
                    <summary className="ad-btn ad-btn-outline !h-8 !w-8 !p-0 justify-center" aria-label={`More actions for ${v.title}`}>⋯</summary>
                    <div>
                      <Link href={`/admin/videos/${v.id}`}>Edit details</Link>
                      {(v.status === 'published' || v.status === 'draft') && (
                        <form action={toggleVideoStatusAction}>
                          <input type="hidden" name="id" value={v.id} />
                          <input type="hidden" name="nextStatus" value={v.status === 'published' ? 'draft' : 'published'} />
                          <button type="submit">{v.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                        </form>
                      )}
                      {v.status === 'published' && <Link href={`/watch/${v.slug}`}>View on website</Link>}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-[14px]" data-pagination>
          <span style={{ color: 'var(--ad-muted-fg)' }}>
            Showing {from.toLocaleString('en-US')}–{to.toLocaleString('en-US')} of {total.toLocaleString('en-US')} videos
          </span>
          <div className="flex items-center gap-1">
            <Link href={`/admin/videos${qs({ page: Math.max(1, page - 1) })}`} aria-disabled={page <= 1} className={`ad-btn ad-btn-ghost !h-8 ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}>
              ‹ Previous
            </Link>
            {pageLinks.map((p, i) => (
              <span key={p} className="flex items-center gap-1">
                {i > 0 && pageLinks[i - 1] !== p - 1 && <span style={{ color: 'var(--ad-muted-fg)' }}>…</span>}
                <Link href={`/admin/videos${qs({ page: p })}`} aria-current={p === page ? 'page' : undefined} className={`ad-btn !h-8 !min-w-8 !px-2 justify-center ${p === page ? 'ad-btn-outline' : 'ad-btn-ghost'}`}>
                  {p}
                </Link>
              </span>
            ))}
            <Link href={`/admin/videos${qs({ page: Math.min(totalPages, page + 1) })}`} aria-disabled={page >= totalPages} className={`ad-btn ad-btn-ghost !h-8 ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}>
              Next ›
            </Link>
          </div>
          <form action="/admin/videos" className="flex items-center gap-2">
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="sort" value={sort} />
            <label className="ad-help" htmlFor="per">Rows per page</label>
            <select id="per" name="per" defaultValue={perPage} className="ad-select !w-20 !py-1">
              {PER_PAGE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button type="submit" className="ad-btn ad-btn-ghost !h-8">Go</button>
          </form>
        </div>
      </div>
    </div>
  );
}
