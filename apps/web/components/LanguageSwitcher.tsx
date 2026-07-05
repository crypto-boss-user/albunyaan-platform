'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLanguageAction } from '../app/actions';

const LANGS: { code: 'en' | 'ar' | 'nl'; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'nl', label: 'Nederlands' },
];

/** Visual EN/AR/NL switcher. AR flips dir=rtl on <html> (RTL-ready shells). */
export default function LanguageSwitcher({ current }: { current: 'en' | 'ar' | 'nl' }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  const active = LANGS.find((l) => l.code === current) ?? LANGS[0];

  function choose(code: 'en' | 'ar' | 'nl') {
    setOpen(false);
    // Flip immediately for snappy feel; the cookie + SSR re-render make it stick.
    document.documentElement.lang = code;
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    const fd = new FormData();
    fd.set('lang', code);
    startTransition(async () => {
      await setLanguageAction(fd);
      router.refresh();
    });
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/10 text-[13px] font-medium text-ink-secondary hover:border-brand hover:text-brand transition"
      >
        <span aria-hidden>🌐</span>
        {active.label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={`transition ${open ? 'rotate-180' : ''}`}>
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute end-0 mt-2 w-40 rounded-xl bg-white shadow-lg border border-black/5 py-1.5 z-50"
        >
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                role="option"
                aria-selected={l.code === current}
                onClick={() => choose(l.code)}
                className={`w-full text-start px-4 py-2 text-[13px] hover:bg-brand-muted transition ${
                  l.code === current ? 'font-bold text-brand' : 'text-ink-secondary'
                }`}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
