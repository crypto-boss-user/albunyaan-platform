'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Contact▾-dropdown van de kop (SR 4 stap 3). Openen = CSS (group-hover + group-focus-within): hover zoals de storefront
 * op ≥ 1024 px, Tab/focus voor het toetsenbord. De enige client-JS (review stap 3, Important): focus loslaten bij Escape
 * en bij klik op een link — anders houdt de gefocuste link het paneel na client-side navigatie open (root-layout blijft
 * gemount). Geen state, geen effect.
 */
export default function NavDropdown({
  label,
  id,
  buttonClassName,
  items,
  chevron,
}: {
  label: string;
  id: string;
  buttonClassName: string;
  items: { href: string; label: string }[];
  chevron: ReactNode;
}) {
  const blur = () => (document.activeElement as HTMLElement | null)?.blur();
  return (
    <div
      className="relative group"
      data-dropdown={id}
      onKeyDown={(e) => {
        if (e.key === 'Escape') blur();
      }}
    >
      <button type="button" aria-haspopup="true" className={`${buttonClassName} inline-flex items-center gap-1.5`}>
        {label}
        {chevron}
      </button>
      {/* pt-3 = zwevende brug zodat hover niet wegvalt tussen knop en paneel */}
      <div className="absolute start-0 top-full pt-3 hidden group-hover:block group-focus-within:block z-50">
        <ul className="min-w-44 rounded-xl bg-white shadow-lg border border-black/5 py-1.5">
          {items.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                onClick={blur}
                className="block px-4 py-2 text-[14px] text-ink hover:bg-brand-muted hover:text-brand transition"
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
