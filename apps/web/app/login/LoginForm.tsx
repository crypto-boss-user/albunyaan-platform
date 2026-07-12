'use client';

import { useActionState } from 'react';
import { requestMagicLinkAction, type AuthFormState } from '../auth/actions';

const initial: AuthFormState = { status: 'idle', message: null };

/** Email → magic link form. The link's verification runs on /auth/confirm. */
export default function LoginForm({ serverNotice }: { serverNotice: string | null }) {
  const [state, formAction, pending] = useActionState(requestMagicLinkAction, initial);

  if (state.status === 'sent') {
    return (
      <div className="card-elevated rounded-2xl p-8 text-center" role="status">
        <div className="mx-auto w-14 h-14 rounded-full bg-brand-soft grid place-items-center text-brand mb-4">
          <svg width="24" height="24" viewBox="0 0 16 16" aria-hidden>
            <path d="M1 4l7 4.5L15 4v8.5a1 1 0 01-1 1H2a1 1 0 01-1-1V4zm0-1.5A1 1 0 012 2h12a1 1 0 011 1L8 7.5 1 2.5z" fill="currentColor" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold tracking-tight mb-2">Check your email</h2>
        <p className="text-[14px] text-ink-secondary leading-relaxed">
          We sent a login link to <strong>{state.message}</strong>. Open it on any device and press
          <em> Continue</em> — the link works once and expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card-elevated rounded-2xl p-8">
      <label htmlFor="login-email" className="block text-[13px] font-semibold text-ink-secondary mb-2">
        Email address
      </label>
      <input
        id="login-email"
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-brand"
        autoFocus
      />
      {(state.status === 'error' || serverNotice) && (
        <p className="text-[13px] text-red-700 mt-3" role="alert">
          {state.status === 'error' ? state.message : serverNotice}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full px-6 py-3 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[14px] disabled:opacity-40"
      >
        {pending ? 'Sending…' : 'Email me a login link'}
      </button>
      <p className="mt-5 text-[12px] text-ink-muted leading-relaxed">
        No password needed — we email you a one-time link. New here? Membership signup opens soon,
        in sha&rsquo; Allah.
      </p>
    </form>
  );
}
