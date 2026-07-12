'use client';

import { useActionState } from 'react';

/** 6-digit TOTP entry, shared by MFA enroll + step-up. Autofocus, numeric, one submit. */
export default function CodeForm({
  action,
  submitLabel,
}: {
  action: (prev: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  return (
    <form action={formAction} className="space-y-4">
      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        autoFocus
        placeholder="123456"
        className="w-full text-center tracking-[0.5em] text-2xl font-bold py-3 rounded-xl border border-black/15 focus:border-brand focus:outline-none"
      />
      {state.error && <p className="text-[13px] text-red-600 font-medium">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full px-6 py-3 rounded-full bg-brand hover:bg-brand-light disabled:opacity-60 transition text-white font-semibold text-[14px]"
      >
        {pending ? 'Verifying…' : submitLabel}
      </button>
    </form>
  );
}
