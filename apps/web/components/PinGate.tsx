'use client';

import { useActionState } from 'react';
import { unlockParentsAction } from '../app/actions';

/** PIN form — the check itself runs in a server action against the DB hash. */
export default function PinGate() {
  const [state, formAction, pending] = useActionState(unlockParentsAction, { error: null });

  return (
    <div className="max-w-md mx-auto px-5 py-24">
      <p className="section-label">Parent dashboard</p>
      <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-2">Enter your PIN</h1>
      <p className="text-[14px] text-ink-secondary mb-6">
        Controls for every child profile live behind this PIN. (Demo PIN: 1234 — verified
        server-side against the household record.)
      </p>
      <form action={formAction}>
        <input
          type="password"
          name="pin"
          inputMode="numeric"
          maxLength={4}
          pattern="\d{4}"
          required
          aria-label="Parent PIN"
          className="w-40 text-center text-3xl tracking-[0.5em] border-2 border-brand-muted focus:border-brand rounded-xl px-3 py-3 outline-none"
          autoFocus
        />
        {state.error && (
          <p className="text-[13px] text-red-700 mt-3" role="alert">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="block mt-6 px-6 py-3 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[14px] disabled:opacity-40"
        >
          {pending ? 'Checking…' : 'Unlock dashboard'}
        </button>
      </form>
    </div>
  );
}
