import Link from 'next/link';
import { listCollectionsForAdmin } from '@albunyaan/core/data';
import { hasRole, requireAdmin } from '../../../lib/admin';
import ConfirmDelete from '../../../components/admin/ConfirmDelete';
import { fmtDate } from '../../../components/admin/format';
import { deleteCollectionAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Content › Collections in de Uscreen-vorm (AD 1.3; norm AD0-inventaris §2.1): kop + "Add new collection", zoekveld, statusfilter,
 * tabel thumbnail · titel · Status · Created · ⋯, 12 per pagina. Status is afgeleid (collections hebben geen statuskolom):
 * Published = ≥ 1 published/live aflevering (storefront-regel) — gemeld in AD1-teamreview; het filter werkt over alle collecties.
 */
export default async function AdminCollectionsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const { admin } = await requireAdmin();
  // deleteCollectionAction eist 'admin' (actions.ts:42) — de knop alleen tonen als de action hem ook
  // uitvoert, anders krijgt support/editor een volledige bevestigingsflow voor een verboden actie
  // (Codex-review 2026-09-07 A-1; zelfde patroon als subscriptions/page.tsx:18).
  const magVerwijderen = hasRole(admin.role, 'admin');
  const sp = await searchParams;
  const q = sp.q ?? '';
  const status = sp.status === 'published' || sp.status === 'draft' ? sp.status : 'all';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const { rows, total, perPage } = await listCollectionsForAdmin({ q: q || undefined, status: status === 'all' ? undefined : status, page, perPage: 12 });
  const zichtbaar = rows;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const qs = (p: number) => { const u = new URLSearchParams(); if (q) u.set('q', q); if (status !== 'all') u.set('status', status); if (p > 1) u.set('page', String(p)); const s = u.toString(); return s ? `?${s}` : ''; };
  const pageLinks = Array.from(new Set([1, 2, page - 1, page, page + 1, totalPages].filter((p) => p >= 1 && p <= totalPages))).sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7">Collections</h1>
        <Link href="/admin/collections/new" className="ad-btn ad-btn-primary">Add new collection</Link>
      </div>
      <div className="ad-card">
        <form action="/admin/collections" className="flex flex-wrap items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--ad-border)' }}>
          <input type="search" name="q" defaultValue={q} placeholder="Search..." aria-label="Search" className="ad-input !w-64" />
          <select name="status" defaultValue={status} aria-label="Status" className="ad-select !w-44">
            <option value="all">Status</option>
            <option value="published">Published</option>
            <option value="draft">Unpublished</option>
          </select>
          <button type="submit" className="ad-btn ad-btn-outline">Apply</button>
        </form>
        <table className="ad-table" data-collections-table>
          <thead>
            <tr>
              <th colSpan={2}>{total.toLocaleString('en-US')} collections</th>
              <th>Status</th>
              <th>Created</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {zichtbaar.length === 0 && <tr><td colSpan={5} className="!py-10 text-center" style={{ color: 'var(--ad-muted-fg)' }}>No collections match.</td></tr>}
            {zichtbaar.map((c) => (
              <tr key={c.id} data-collection-row={c.id}>
                <td className="w-24">
                  <Link href={`/admin/collections/${c.id}`} className="block h-12 w-20 overflow-hidden rounded" style={{ background: 'var(--ad-secondary)' }}>
                    {c.cover_url && <img src={c.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  </Link>
                </td>
                <td><Link href={`/admin/collections/${c.id}`} className="font-medium hover:underline">{c.title}</Link><span className="ad-help ml-2">{c.item_count} videos</span></td>
                <td><span className={c.published ? 'ad-badge ad-badge-published' : 'ad-badge ad-badge-unpublished'}>{c.published ? 'Published' : 'Unpublished'}</span></td>
                <td style={{ color: 'var(--ad-muted-fg)' }}>{fmtDate(c.created_at)}</td>
                <td>
                  <details className="ad-rowmenu">
                    <summary className="ad-btn ad-btn-outline !h-8 !w-8 !p-0 justify-center" aria-label={`More actions for ${c.title}`}>⋯</summary>
                    <div>
                      <Link href={`/admin/collections/${c.id}`}>Edit details</Link>
                      <Link href={`/programs/${c.slug}`}>View on website</Link>
                      <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--ad-border)' }}>
                        {magVerwijderen
                          ? <ConfirmDelete label="Delete collection" text="You are about to delete this collection. The videos inside it will not be deleted. Are you sure?" action={deleteCollectionAction} hidden={{ id: c.id }} />
                          : <span className="ad-help block px-3 py-1.5" title="Delete collection — verwijderen vereist de admin-rol">Delete collection — vereist de admin-rol</span>}
                      </div>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between gap-3 p-4 text-[14px]" data-pagination>
          <span style={{ color: 'var(--ad-muted-fg)' }}>Showing {total === 0 ? 0 : (page - 1) * perPage + 1}–{Math.min(total, page * perPage)} of {total.toLocaleString('en-US')} collections</span>
          <div className="flex items-center gap-1">
            <Link href={`/admin/collections${qs(Math.max(1, page - 1))}`} className={`ad-btn ad-btn-ghost !h-8 ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}>‹ Previous</Link>
            {pageLinks.map((p, i) => (
              <span key={p} className="flex items-center gap-1">
                {i > 0 && pageLinks[i - 1] !== p - 1 && <span style={{ color: 'var(--ad-muted-fg)' }}>…</span>}
                <Link href={`/admin/collections${qs(p)}`} aria-current={p === page ? 'page' : undefined} className={`ad-btn !h-8 !min-w-8 !px-2 justify-center ${p === page ? 'ad-btn-outline' : 'ad-btn-ghost'}`}>{p}</Link>
              </span>
            ))}
            <Link href={`/admin/collections${qs(Math.min(totalPages, page + 1))}`} className={`ad-btn ad-btn-ghost !h-8 ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}>Next ›</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
