'use client';

import { useActionState } from 'react';
import { setPinAction } from '../app/actions';

/**
 * First-run PIN setup — shown when the member's household has no PIN yet
 * (pin_hash NULL after lazy household creation). Sets + unlocks in one step.
 */
export default function SetPinGate() {
  const [state, formAction, pending] = useActionState(setPinAction, { error: null });

  return (
    <div className="max-w-md mx-auto px-5 py-24">
      <p className="section-label">Parent dashboard</p>
      <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-2">Choose a parent PIN</h1>
      <p className="text-[14px] text-ink-secondary mb-6">
        Your household doesn&rsquo;t have a PIN yet. Pick a 4-digit code — you&rsquo;ll need it every
        time you open these controls.
      </p>
      <form action={formAction} className="space-y-5">
        <div>
          <label htmlFor="set-pin" className="block text-[13px] font-semibold text-ink-secondary mb-2">
            New PIN
          </label>
          <input
            id="set-pin"
            type="password"
            name="pin"
            inputMode="numeric"
            maxLength={4}
            pattern="\d{4}"
            required
            className="w-40 text-center text-3xl tracking-[0.5em] border-2 border-brand-muted focus:border-brand rounded-xl px-3 py-3 outline-none"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="confirm-pin" className="block text-[13px] font-semibold text-ink-secondary mb-2">
            Repeat PIN
          </label>
          <input
            id="confirm-pin"
            type="password"
            name="confirm"
            inputMode="numeric"
            maxLength={4}
            pattern="\d{4}"
            required
            aria-label="Repeat parent PIN"
            className="w-40 text-center text-3xl tracking-[0.5em] border-2 border-brand-muted focus:border-brand rounded-xl px-3 py-3 outline-none"
          />
        </div>
        {state.error && (
          <p className="text-[13px] text-red-700" role="alert">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[14px] disabled:opacity-40"
        >
          {pending ? 'Saving…' : 'Set PIN & open dashboard'}
        </button>
      </form>
    </div>
  );
}
