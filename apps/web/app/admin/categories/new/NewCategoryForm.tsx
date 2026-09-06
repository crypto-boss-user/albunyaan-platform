'use client';

import { useActionState } from 'react';
import { createCategoryAction, type CategoryFormState } from '../actions';

export default function NewCategoryForm() {
  const [state, formAction, pending] = useActionState(createCategoryAction, { error: null, saved: false } as CategoryFormState);
  return (
    <form action={formAction} data-new-category>
      <label className="ad-label" htmlFor="name">Category title</label>
      <input id="name" name="name" required className="ad-input mb-4" />
      {state.error && <p className="mb-3 text-[13px]" style={{ color: 'var(--ad-destructive)' }} data-form-error>{state.error}</p>}
      <button type="submit" disabled={pending} className="ad-btn ad-btn-primary">{pending ? 'Creating…' : 'Create category'}</button>
    </form>
  );
}
