'use client';

import { useActionState } from 'react';
import { sendContactMessageAction, type ContactFormState } from './actions';

const initial: ContactFormState = { status: 'idle', message: null };

export default function ContactForm() {
  const [state, formAction, pending] = useActionState(sendContactMessageAction, initial);

  if (state.status === 'sent') {
    return (
      <div className="card-elevated rounded-2xl p-8 text-center" role="status">
        <div className="mx-auto w-14 h-14 rounded-full bg-brand-soft grid place-items-center text-brand mb-4">
          <svg width="24" height="24" viewBox="0 0 16 16" aria-hidden>
            <path d="M1 4l7 4.5L15 4v8.5a1 1 0 01-1 1H2a1 1 0 01-1-1V4zm0-1.5A1 1 0 012 2h12a1 1 0 011 1L8 7.5 1 2.5z" fill="currentColor" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold tracking-tight mb-2">Message sent</h2>
        <p className="text-[14px] text-ink-secondary leading-relaxed">
          Jazak Allah khair — we&rsquo;ll get back to you by email as soon as we can.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="card-elevated rounded-2xl p-8 space-y-4">
      {/* Honeypot — hidden from real visitors, invisible to screen readers, invisible to CSS-blind bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] w-px h-px opacity-0"
      />

      <div>
        <label htmlFor="contact-name" className="block text-[13px] font-semibold text-ink-secondary mb-2">Name</label>
        <input
          id="contact-name"
          name="name"
          required
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-brand"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-[13px] font-semibold text-ink-secondary mb-2">Email address</label>
        <input
          id="contact-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-brand"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-[13px] font-semibold text-ink-secondary mb-2">Message</label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          placeholder="Questions, content suggestions, or technical issues — let us know."
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] outline-none focus:border-brand resize-none"
        />
      </div>

      {state.status === 'error' && (
        <p className="text-[13px] text-red-700" role="alert">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full px-6 py-3 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[14px] disabled:opacity-40"
      >
        {pending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
