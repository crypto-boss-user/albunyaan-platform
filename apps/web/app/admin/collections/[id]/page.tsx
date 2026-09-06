import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllCategories, getCollectionForAdmin, searchVideosForAdmin } from '@albunyaan/core/data';
import { requireAdmin } from '../../../../lib/admin';
import ConfirmDelete from '../../../../components/admin/ConfirmDelete';
import SortableList from '../../../../components/admin/SortableList';
import { STATUS_BADGE, STATUS_LABEL, fmtClock } from '../../../../components/admin/format';
import { addCollectionItemAction, deleteCollectionAction, removeCollectionItemAction, reorderCollectionAction } from '../actions';
import EditCollectionForm from './EditCollectionForm';

export const dynamic = 'force-dynamic';

/**
 * Content › Collections › Details in de Uscreen-vorm (AD 1.3; norm AD0-inventaris §2.1): About · Organize · Thumbnails · Playlist
 * (slepen, Add video, verwijderen) · SEO; rechts Visibility (afgeleid) · Access/Pricing/Preview (wachten op beslissingen) · ⋯ Delete.
 */
export default async function AdminCollectionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ add?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { add = '' } = await searchParams;
  const c = await getCollectionForAdmin(id);
  if (!c) notFound();
  const [categories, gevonden] = await Promise.all([getAllCategories(), add.trim().length >= 2 ? searchVideosForAdmin(add) : Promise.resolve([])]);
  const inPlaylist = new Set(c.items.map((i) => i.video_id));
  const published = c.items.some((i) => i.status === 'published' || i.status === 'live');
  type S = keyof typeof STATUS_LABEL;

  return (
    <div className="mx-auto max-w-[1120px]" data-collection-detail>
      <EditCollectionForm collection={c} categories={categories.map((x) => ({ id: x.id, name: x.name }))} />

      <div className="mt-6 grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <section className="ad-card p-6" data-card="Playlist and drip settings">
          <h2 className="mb-1 text-[16px] font-semibold">Playlist and drip settings</h2>
          <p className="ad-help mb-4">Drag to reorder (or use ▲▼), then Save order. Drip and dividers: na kijkplatformkeuze.</p>
          {c.items.length === 0 ? <p className="ad-help">No items yet. Add videos to build this collection.</p> : (
            <SortableList
              action={reorderCollectionAction}
              hidden={{ id: c.id }}
              items={c.items.map((it) => ({
                id: it.video_id,
                node: (
                  <div className="flex items-center gap-3">
                    <span className="relative block h-9 w-16 shrink-0 overflow-hidden rounded" style={{ background: 'var(--ad-secondary)' }}>
                      {it.thumbnail_url && <img src={it.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
                      <span className="absolute bottom-0 right-0 rounded bg-black/70 px-1 text-[10px] leading-4 text-white">{fmtClock(it.duration_seconds)}</span>
                    </span>
                    <Link href={`/admin/videos/${it.video_id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{it.title}</Link>
                    <span className={STATUS_BADGE[it.status as S] ?? 'ad-badge ad-badge-muted'}>{STATUS_LABEL[it.status as S] ?? it.status}</span>
                    <button type="submit" form={`rm-${it.video_id}`} className="ad-btn ad-btn-ghost !h-7 !px-2 text-[12px]" aria-label={`Remove ${it.title}`} title="Remove from collection">🗑</button>
                  </div>
                ),
              }))}
            />
          )}
          {/* verwijder-formulieren BUITEN de sorteerlijst (geen geneste forms); de 🗑-knop verwijst via form="rm-<id>" */}
          {c.items.map((it) => (
            <form key={it.video_id} id={`rm-${it.video_id}`} action={removeCollectionItemAction}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="video_id" value={it.video_id} />
            </form>
          ))}
          <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--ad-border)' }} data-add-video>
            <form action={`/admin/collections/${c.id}`} className="flex items-center gap-2">
              <input type="search" name="add" defaultValue={add} placeholder="Add video — search by title…" aria-label="Search videos to add" className="ad-input !w-80" />
              <button type="submit" className="ad-btn ad-btn-outline">Search</button>
            </form>
            {add.trim().length >= 2 && (
              <ul className="mt-3 flex flex-col gap-1" data-add-results>
                {gevonden.length === 0 && <li className="ad-help">No videos match.</li>}
                {gevonden.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 rounded px-2 py-1" style={{ background: 'var(--ad-muted)' }}>
                    <span className="min-w-0 flex-1 truncate">{v.title}</span>
                    <span className={STATUS_BADGE[v.status as S] ?? 'ad-badge ad-badge-muted'}>{STATUS_LABEL[v.status as S] ?? v.status}</span>
                    {inPlaylist.has(v.id) ? <span className="ad-help">In playlist</span> : (
                      <form action={addCollectionItemAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="video_id" value={v.id} />
                        <button type="submit" className="ad-btn ad-btn-outline !h-7 text-[12px]">+ Add video</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section className="ad-card p-6" data-card="Visibility">
            <h2 className="mb-2 text-[16px] font-semibold">Visibility</h2>
            <span className={published ? 'ad-badge ad-badge-published' : 'ad-badge ad-badge-unpublished'}>{published ? 'Published' : 'Unpublished'}</span>
            <p className="ad-help mt-2">Afgeleid: een collectie is zichtbaar zodra ≥ 1 aflevering Published is (geen eigen statuskolom).</p>
          </section>
          <section className="ad-card p-6" data-card="Access">
            <h2 className="mb-2 text-[16px] font-semibold">Access · Subscription & Pricing · Preview</h2>
            <p className="ad-help">Per aflevering ingesteld (Access) · plannen en preview wachten op de betaal- en kijkplatformbeslissing.</p>
          </section>
          <section className="ad-card p-6" data-card="Danger">
            <h2 className="mb-2 text-[16px] font-semibold">More actions</h2>
            <Link href={`/programs/${c.slug}`} className="ad-btn ad-btn-outline mb-3 w-full justify-center">View on website</Link>
            <ConfirmDelete label="Delete collection" text="You are about to delete this collection. The videos inside it will not be deleted. Are you sure?" action={deleteCollectionAction} hidden={{ id: c.id }} />
          </section>
        </div>
      </div>
    </div>
  );
}
