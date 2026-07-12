'use client';

import { useActionState } from 'react';
import { changeEmailAction, type AuthFormState } from '../auth/actions';

const initial: AuthFormState = { status: 'idle', message: null };

export default function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction, pending] = useActionState(changeEmailAction, initial);

  return (
    <form action={formAction} className="mt-4">
      <label htmlFor="new-email" className="block text-[13px] font-semibold text-ink-secondary mb-2">
        New email address
      </label>
      <div className="flex gap-2.5">
        <input
          id="new-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder={`not ${currentEmail}`}
          className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-[14px] outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 rounded-full bg-brand hover:bg-brand-light transition text-white text-[13px] font-semibold disabled:opacity-40"
        >
          {pending ? 'Sending…' : 'Change email'}
        </button>
      </div>
      {state.message && (
        <p
          className={`text-[13px] mt-3 ${state.status === 'error' ? 'text-red-700' : 'text-brand-dark'}`}
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      )}
      <p className="text-[12px] text-ink-muted mt-3 leading-relaxed">
        For safety you confirm the change from BOTH addresses — each gets an email with a Continue
        button.
      </p>
    </form>
  );
}
