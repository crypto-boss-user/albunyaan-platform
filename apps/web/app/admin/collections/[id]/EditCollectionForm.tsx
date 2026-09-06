'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { AdminCollectionDetail } from '@albunyaan/core/data';
import { updateCollectionAction, type CollectionFormState } from '../actions';

/** About · Organize · Thumbnails · SEO van een collectie (Uscreen-velden, AD 1.3). De playlist staat apart (server-rendered). */
export default function EditCollectionForm({ collection: c, categories }: { collection: AdminCollectionDetail; categories: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(updateCollectionAction, { error: null, saved: false } as CollectionFormState);
  return (
    <form action={formAction} data-collection-form>
      <input type="hidden" name="id" value={c.id} />
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-semibold leading-7">{c.title}</h1>
          <p className="ad-help font-mono">{c.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          {state.error && <p className="text-[13px] font-medium" style={{ color: 'var(--ad-destructive)' }} data-form-error>{state.error}</p>}
          {state.saved && !state.error && <p className="text-[13px] font-medium" style={{ color: 'var(--ad-primary)' }} data-form-saved>Changes saved</p>}
          <button type="submit" disabled={pending} className="ad-btn ad-btn-primary">{pending ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
      <div className="grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="flex flex-col gap-6">
          <section className="ad-card p-6" data-card="About">
            <h2 className="mb-4 text-[16px] font-semibold">About</h2>
            <label className="ad-label" htmlFor="title">Title</label>
            <input id="title" name="title" defaultValue={c.title} required className="ad-input mb-4" />
            <label className="ad-label" htmlFor="description">Description <span className="ad-help">(HTML)</span></label>
            <textarea id="description" name="description" defaultValue={c.description} rows={5} className="ad-textarea font-mono text-[13px]" />
          </section>
          <section className="ad-card p-6" data-card="Organize">
            <h2 className="mb-4 text-[16px] font-semibold">Organize</h2>
            <p className="ad-label">Categories</p>
            <div className="mb-3 flex flex-wrap gap-2" data-categories>
              {categories.map((cat) => (
                <label key={cat.id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px]" style={{ background: 'var(--ad-secondary)' }}>
                  <input type="checkbox" name="category_ids" value={cat.id} defaultChecked={c.categoryIds.includes(cat.id)} />
                  {cat.name}
                </label>
              ))}
            </div>
            <Link href="/admin/categories" className="text-[13px]" style={{ color: 'var(--ad-primary)' }}>Manage categories</Link>
            <p className="ad-help mt-3">Authors: none (Uscreen: 0). Custom filters per collection: niet in de DB (alleen per video).</p>
          </section>
        </div>
        <div className="flex flex-col gap-6">
          <section className="ad-card p-6" data-card="Thumbnails">
            <h2 className="mb-4 text-[16px] font-semibold">Thumbnails</h2>
            <div className="mb-3 aspect-video w-full overflow-hidden rounded" style={{ background: 'var(--ad-secondary)' }}>
              {c.cover_url && <img src={c.cover_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <label className="ad-label" htmlFor="cover_url">Horizontal thumbnail (1480×840px) — cover URL</label>
            <input id="cover_url" name="cover_url" defaultValue={c.cover_url ?? ''} placeholder="https://…" className="ad-input" />
            <p className="ad-help mt-1">Cover uit het archief (posters-bucket); upload na kijkplatformkeuze.</p>
          </section>
          <section className="ad-card p-6" data-card="SEO">
            <h2 className="mb-4 text-[16px] font-semibold">SEO</h2>
            <p className="ad-label">Website URL</p>
            <p className="ad-input flex items-center gap-1" style={{ color: 'var(--ad-muted-fg)' }}><span>/programs/</span><span style={{ color: 'var(--ad-fg)' }}>{c.slug}</span></p>
            <p className="ad-help mt-2">Page title / meta description: geen kolom voor collecties in de DB.</p>
          </section>
        </div>
      </div>
    </form>
  );
}
