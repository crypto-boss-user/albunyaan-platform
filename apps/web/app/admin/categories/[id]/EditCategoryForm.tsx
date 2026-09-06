'use client';

import { useActionState } from 'react';
import { CATEGORY_CONTENT_SORTS, CATEGORY_CONTENT_SORT_LABELS, type AdminCategoryDetail } from '@albunyaan/core/data';
import { updateCategoryAction, type CategoryFormState } from '../actions';

/** About-kaart van een categorie (Category title, Category position, Sort content by) — Uscreen-velden, AD 1.3. */
export default function EditCategoryForm({ category: c }: { category: AdminCategoryDetail }) {
  const [state, formAction, pending] = useActionState(updateCategoryAction, { error: null, saved: false } as CategoryFormState);
  return (
    <form action={formAction} data-category-form>
      <input type="hidden" name="id" value={c.id} />
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="truncate text-[20px] font-semibold leading-7">{c.name}</h1>
        <div className="flex items-center gap-3">
          {state.error && <p className="text-[13px] font-medium" style={{ color: 'var(--ad-destructive)' }} data-form-error>{state.error}</p>}
          {state.saved && !state.error && <p className="text-[13px] font-medium" style={{ color: 'var(--ad-primary)' }} data-form-saved>Changes saved</p>}
          <button type="submit" disabled={pending} className="ad-btn ad-btn-primary">{pending ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
      <section className="ad-card p-6" data-card="About">
        <h2 className="mb-4 text-[16px] font-semibold">About</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
          <div>
            <label className="ad-label" htmlFor="name">Category title</label>
            <input id="name" name="name" defaultValue={c.name} required className="ad-input" />
          </div>
          <div>
            <label className="ad-label" htmlFor="position">Category position</label>
            <input id="position" name="position" type="number" min={1} step={1} defaultValue={c.position ?? 1} className="ad-input" />
          </div>
          <div>
            <label className="ad-label" htmlFor="content_sort">Sort content by</label>
            <select id="content_sort" name="content_sort" defaultValue={(CATEGORY_CONTENT_SORTS as readonly string[]).includes(c.content_sort ?? '') ? c.content_sort! : 'manual'} className="ad-select">
              {CATEGORY_CONTENT_SORTS.map((s) => <option key={s} value={s}>{CATEGORY_CONTENT_SORT_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
        <p className="ad-help mt-3">Category description: geen kolom in de DB (gemeld in AD1-teamreview). Randomize content: wacht op storefront-ondersteuning.</p>
      </section>
    </form>
  );
}
