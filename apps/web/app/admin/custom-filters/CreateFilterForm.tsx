'use client';

import { useActionState } from 'react';
import { createFilterAction, type FilterFormState } from './actions';

export default function CreateFilterForm() {
  const [state, formAction, pending] = useActionState(createFilterAction, { error: null, saved: false } as FilterFormState);
  return (
    <form action={formAction} data-create-filter>
      <label className="ad-label" htmlFor="filter-name">Filter name *</label>
      <input id="filter-name" name="name" required className="ad-input mb-3" placeholder="Eg. Level" />
      <label className="ad-label" htmlFor="filter-options">Filter options (one per line)</label>
      <textarea id="filter-options" name="options" rows={4} className="ad-textarea mb-3" placeholder={'Eg. Easy\nEg. Medium'} />
      {state.error && <p className="mb-3 text-[13px]" style={{ color: 'var(--ad-destructive)' }} data-form-error>{state.error}</p>}
      {state.saved && !state.error && <p className="mb-3 text-[13px]" style={{ color: 'var(--ad-primary)' }} data-form-saved>Filter created</p>}
      <button type="submit" disabled={pending} className="ad-btn ad-btn-primary">{pending ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
