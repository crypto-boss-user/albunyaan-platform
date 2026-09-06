import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategoryForAdmin, searchCollectionsForAdmin, searchVideosForAdmin } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';
import ConfirmDelete from '../../../../components/admin/ConfirmDelete';
import SortableList from '../../../../components/admin/SortableList';
import { STATUS_BADGE, STATUS_LABEL, fmtDate } from '../../../../components/admin/format';
import { addCategoryContentAction, deleteCategoryAction, removeCategoryItemAction, reorderCategoryItemsAction } from '../actions';
import EditCategoryForm from './EditCategoryForm';

export const dynamic = 'force-dynamic';

/**
 * Content › Categories › Edit category in de Uscreen-vorm (AD 1.3; norm AD0-inventaris §2.1): About (title, position),
 * Manage content (Sort content by, Add content, tabel CONTENT · PUBLISHED DATE · STATUS met slepen), Image/SEO (geen kolommen: gemeld), ⋯ Delete.
 */
export default async function AdminCategoryEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ add?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { add = '' } = await searchParams;
  const c = await getCategoryForAdmin(id);
  if (!c) notFound();
  const [videos, collections] = add.trim().length >= 2 ? await Promise.all([searchVideosForAdmin(add, 10), searchCollectionsForAdmin(add, 10)]) : [[], []];
  type S = keyof typeof STATUS_LABEL;
  const inCategory = new Set(c.items.map((it) => it.video_id ?? it.collection_id)); // op id (koude review M-1: dubbele titels)

  return (
    <div className="mx-auto max-w-[1120px]" data-category-edit>
      <EditCategoryForm category={c} />
      <div className="mt-6 grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <section className="ad-card p-6" data-card="Manage content">
          <h2 className="mb-1 text-[16px] font-semibold">Manage content</h2>
          <p className="ad-help mb-4">Website displays category content in the order shown below. New content will be added to the top of the list.</p>
          <div className="mb-2 flex px-3 text-[12px] uppercase" style={{ color: 'var(--ad-muted-fg)' }}><span className="flex-1">Content</span><span className="w-36">Published date</span><span className="w-28">Status</span><span className="w-8"></span></div>
          {c.items.length === 0 ? (
            <p className="py-6 text-center"><span className="block text-[18px] font-semibold">No content found</span><span className="ad-help">Add content to this category to display it here.</span></p>
          ) : (
            <SortableList
              action={reorderCategoryItemsAction}
              hidden={{ id: c.id }}
              items={c.items.map((it) => ({
                id: it.id,
                node: (
                  <div className="flex items-center gap-3" data-category-item={it.id}>
                    <span className="min-w-0 flex-1 truncate"><span className="font-medium">{it.title}</span><span className="ad-help ml-2">{it.kind === 'video' ? 'Video' : 'Collection'}</span></span>
                    <span className="w-36 text-[13px]" style={{ color: 'var(--ad-muted-fg)' }}>{fmtDate(it.published_at)}</span>
                    <span className="w-28">{it.kind === 'video' ? <span className={STATUS_BADGE[it.status as S] ?? 'ad-badge ad-badge-muted'}>{STATUS_LABEL[it.status as S] ?? it.status}</span> : <span className="ad-badge ad-badge-muted">Collection</span>}</span>
                    <button type="submit" form={`rm-${it.id}`} className="ad-btn ad-btn-ghost !h-7 !px-2 w-8 text-[12px]" aria-label={`Remove ${it.title}`} title="Remove from category">🗑</button>
                  </div>
                ),
              }))}
            />
          )}
          {/* verwijder-formulieren BUITEN de sorteerlijst (geen geneste forms) */}
          {c.items.map((it) => (
            <form key={it.id} id={`rm-${it.id}`} action={removeCategoryItemAction}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="item_id" value={it.id} />
            </form>
          ))}
          <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--ad-border)' }} data-add-content>
            <form action={`/admin/categories/${c.id}`} className="flex items-center gap-2">
              <input type="search" name="add" defaultValue={add} placeholder="Add content — search videos and collections…" aria-label="Search content to add" className="ad-input !w-96" />
              <button type="submit" className="ad-btn ad-btn-outline">Search</button>
            </form>
            {add.trim().length >= 2 && (
              <ul className="mt-3 flex flex-col gap-1" data-add-results>
                {videos.length + collections.length === 0 && <li className="ad-help">No content matches.</li>}
                {collections.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 rounded px-2 py-1" style={{ background: 'var(--ad-muted)' }}>
                    <span className="min-w-0 flex-1 truncate">{x.title}</span><span className="ad-badge ad-badge-muted">Collection</span>
                    {inCategory.has(x.id) ? <span className="ad-help">In category</span> : <form action={addCategoryContentAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="collection_id" value={x.id} /><button type="submit" className="ad-btn ad-btn-outline !h-7 text-[12px]">+ Add</button></form>}
                  </li>
                ))}
                {videos.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 rounded px-2 py-1" style={{ background: 'var(--ad-muted)' }}>
                    <span className="min-w-0 flex-1 truncate">{v.title}</span><span className={STATUS_BADGE[v.status as S] ?? 'ad-badge ad-badge-muted'}>{STATUS_LABEL[v.status as S] ?? v.status}</span>
                    {inCategory.has(v.id) ? <span className="ad-help">In category</span> : <form action={addCategoryContentAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="video_id" value={v.id} /><button type="submit" className="ad-btn ad-btn-outline !h-7 text-[12px]">+ Add</button></form>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <div className="flex flex-col gap-6">
          <section className="ad-card p-6" data-card="Image">
            <h2 className="mb-2 text-[16px] font-semibold">Image</h2>
            <p className="ad-help">Upload image (1480×840): geen kolom voor categorie-afbeeldingen in de DB; gemeld in AD1-teamreview.</p>
            <Link href={`/categories/${c.slug}`} className="ad-btn ad-btn-outline mt-3 w-full justify-center">View on website</Link>
          </section>
          <section className="ad-card p-6" data-card="SEO">
            <h2 className="mb-2 text-[16px] font-semibold">SEO</h2>
            <p className="ad-label">URL</p>
            <p className="ad-input flex items-center gap-1" style={{ color: 'var(--ad-muted-fg)' }}><span>/categories/</span><span style={{ color: 'var(--ad-fg)' }}>{c.slug}</span></p>
            <p className="ad-help mt-2">Title / Meta description: geen kolom voor categorieën in de DB.</p>
          </section>
          <section className="ad-card p-6" data-card="Danger">
            <h2 className="mb-2 text-[16px] font-semibold">More actions</h2>
            <ConfirmDelete label="Delete category" text="You are about to permanently delete this category and its associated data. This cannot be restored. Are you sure you want to delete this category?" action={deleteCategoryAction} hidden={{ id: c.id }} />
          </section>
        </div>
      </div>
    </div>
  );
}
