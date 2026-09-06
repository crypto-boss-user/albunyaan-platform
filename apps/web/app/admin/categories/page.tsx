import Link from 'next/link';
import { listCategoriesForAdmin } from '@albunyaan/core/data';
import { requireAdmin } from '../../../lib/admin';
import SortableList from '../../../components/admin/SortableList';
import { reorderCategoriesAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Content › Categories in de Uscreen-vorm (AD 1.3; norm AD0-inventaris §2.1): "Categories in browse", Add category, zoeken,
 * rijen met Reorder-handvat · titel (→ edit) · Videos-telling = items in category_items (video's + collecties). Wijkt af van Uscreen voor
 * Channels Live (Uscreen 29, hier 0: live-kanalen zitten niet in category_items) — gemeld in AD1-teamreview.
 */
export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = '' } = await searchParams;
  const cats = await listCategoriesForAdmin();
  const zichtbaar = q.trim() ? cats.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())) : cats;

  return (
    <div className="mx-auto max-w-[1120px]" data-categories-page>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold leading-7">Categories</h1>
          <p className="ad-help">Categories in browse · {cats.length} categories</p>
        </div>
        <Link href="/admin/categories/new" className="ad-btn ad-btn-primary">Add category</Link>
      </div>
      <div className="ad-card p-4">
        <form action="/admin/categories" className="mb-4 flex items-center gap-2">
          <input type="search" name="q" defaultValue={q} placeholder="Search" aria-label="Search" className="ad-input !w-64" />
          <button type="submit" className="ad-btn ad-btn-outline">Apply</button>
        </form>
        <div className="mb-2 flex px-3 text-[13px]" style={{ color: 'var(--ad-muted-fg)' }}><span className="flex-1">Category</span><span className="w-20 text-right">Videos</span></div>
        {q.trim() ? (
          <ul className="flex flex-col gap-1" data-categories-filtered>
            {zichtbaar.map((c) => (
              <li key={c.id} className="ad-card flex items-center gap-3 px-3 py-2" data-category-row={c.id}>
                <Link href={`/admin/categories/${c.id}`} className="flex-1 font-medium hover:underline">{c.name}</Link>
                <span className="w-20 text-right" style={{ color: 'var(--ad-muted-fg)' }}>{c.item_count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <SortableList
            action={reorderCategoriesAction}
            items={cats.map((c) => ({
              id: c.id,
              node: (
                <div className="flex items-center gap-3" data-category-row={c.id}>
                  <Link href={`/admin/categories/${c.id}`} className="flex-1 font-medium hover:underline">{c.name}</Link>
                  <span className="w-20 text-right" style={{ color: 'var(--ad-muted-fg)' }}>{c.item_count}</span>
                </div>
              ),
            }))}
          />
        )}
        <p className="ad-help mt-4">Learn more about Categories: volgorde hier = site-navigatie (categories.position), inhoud per categorie in het edit-scherm.</p>
      </div>
    </div>
  );
}
