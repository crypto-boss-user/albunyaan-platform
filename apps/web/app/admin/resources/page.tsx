import Link from 'next/link';
import { listResourcesForAdmin } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';

/**
 * Content › Resources in de Uscreen-vorm (AD 1.3; norm AD0-inventaris §2.1): "N resources", zoekveld, rijen naam · type · grootte,
 * per 12; alleen lezen uit videos.resources (import uit Uscreen; Uscreen telt 107). "Upload resources": na kijkplatformkeuze (uitgeschakeld).
 */
export default async function AdminResourcesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const { q = '', page: p = '1' } = await searchParams;
  const alle = await listResourcesForAdmin();
  const gefilterd = q.trim() ? alle.filter((r) => `${r.title} ${r.video_title}`.toLowerCase().includes(q.trim().toLowerCase())) : alle;
  const perPage = 12;
  const page = Math.max(1, Number(p) || 1);
  const totalPages = Math.max(1, Math.ceil(gefilterd.length / perPage));
  const rows = gefilterd.slice((page - 1) * perPage, page * perPage);
  const qs = (n: number) => { const u = new URLSearchParams(); if (q) u.set('q', q); if (n > 1) u.set('page', String(n)); const s = u.toString(); return s ? `?${s}` : ''; };

  return (
    <div className="mx-auto max-w-[1120px]" data-resources-page>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7">Resources</h1>
        <div className="flex items-center gap-3">
          <span className="ad-help">Upload: na kijkplatformkeuze</span>
          <button type="button" className="ad-btn ad-btn-primary" disabled title="Upload resources — na kijkplatformkeuze">Upload resources</button>
        </div>
      </div>
      <div className="ad-card">
        <form action="/admin/resources" className="flex items-center gap-2 p-4" style={{ borderBottom: '1px solid var(--ad-border)' }}>
          <input type="search" name="q" defaultValue={q} placeholder="Search..." aria-label="Search" className="ad-input !w-64" />
          <button type="submit" className="ad-btn ad-btn-outline">Apply</button>
        </form>
        <table className="ad-table" data-resources-table>
          <thead><tr><th>{gefilterd.length.toLocaleString('en-US')} resources</th><th>Type · size</th><th>Attached to</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={3} className="!py-10 text-center" style={{ color: 'var(--ad-muted-fg)' }}>No resources match.</td></tr>}
            {rows.map((r, i) => (
              <tr key={`${r.video_id}-${i}`}>
                <td>{r.url ? <a href={r.url} className="font-medium hover:underline" target="_blank" rel="noreferrer">{r.title}</a> : <span className="font-medium">{r.title}</span>}{!r.url && <span className="ad-help ml-2">(alleen lokaal veiliggesteld)</span>}</td>
                <td style={{ color: 'var(--ad-muted-fg)' }}>{(r.extension ?? '').toUpperCase()}{r.size ? ` · ${r.size}` : ''}</td>
                <td><Link href={`/admin/videos/${r.video_id}`} className="hover:underline">{r.video_title}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between p-4 text-[14px]" data-pagination>
          <span style={{ color: 'var(--ad-muted-fg)' }}>Showing {gefilterd.length === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(gefilterd.length, page * perPage)} of {gefilterd.length} resources</span>
          <div className="flex items-center gap-1">
            <Link href={`/admin/resources${qs(Math.max(1, page - 1))}`} className={`ad-btn ad-btn-ghost !h-8 ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}>‹ Previous</Link>
            <span className="ad-help">Page {page} of {totalPages}</span>
            <Link href={`/admin/resources${qs(Math.min(totalPages, page + 1))}`} className={`ad-btn ad-btn-ghost !h-8 ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}>Next ›</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
