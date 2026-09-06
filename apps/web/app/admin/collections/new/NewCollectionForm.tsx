'use client';

import { useActionState } from 'react';
import { createCollectionAction, type CollectionFormState } from '../actions';

export default function NewCollectionForm() {
  const [state, formAction, pending] = useActionState(createCollectionAction, { error: null, saved: false } as CollectionFormState);
  return (
    <form action={formAction} data-new-collection>
      <label className="ad-label" htmlFor="title">Title</label>
      <input id="title" name="title" required className="ad-input mb-4" placeholder="Collection title" />
      {state.error && <p className="mb-3 text-[13px]" style={{ color: 'var(--ad-destructive)' }} data-form-error>{state.error}</p>}
      <button type="submit" disabled={pending} className="ad-btn ad-btn-primary">{pending ? 'Creating…' : 'Create collection'}</button>
    </form>
  );
}
