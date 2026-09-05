'use client';

import Link from 'next/link';
import { useRef } from 'react';

/**
 * Mobiele navigatie (< 1024 px) — SR 4 stap 4 (B13; storefront: hamburger `#habmurger_button` met alle menulinks +
 * Log in/Sign up, SR 2a home__390). details/summary = geen state; de enige client-JS sluit het paneel bij een link-klik
 * (anders blijft `open` staan na client-side navigatie — zie NavDropdown.tsx). Volgorde en aantal (11 links) = storefront:
 * Home · Videos · Contact (groep) · Contact · About us · Dawah · Q&A · Coupon · Download apps · Log in · Sign up.
 * AANNAMES (aanpasbaar): de groepsregel "Contact" linkt naar /contact (op de storefront is het een toggle zonder doel);
 * tekst 15 px (ongemeten); paneelhoogte = 100dvh − kop (±120 px); klik buiten het paneel sluit niet (alleen link-klik, Escape,
 * navigatie via het menu); ingelogde leden zien "Account" i.p.v. Log in/Sign up (Sign out in het mobiele menu = open vraag,
 * vereist een form-slot).
 */
export default function MobileNav({
  items,
  authLinks,
}: {
  items: ({ href: string; label: string } | { label: string; children: { href: string; label: string }[] })[];
  authLinks: { href: string; label: string }[];
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  const escape = () => {
    close();
    ref.current?.querySelector('summary')?.focus(); // focus terug op de knop (review stap 4)
  };
  const linkCls = 'block px-5 py-3 text-[15px] font-medium text-ink hover:bg-brand-muted hover:text-brand transition';
  return (
    <details ref={ref} className="lg:hidden" onKeyDown={(e) => e.key === 'Escape' && escape()}>
      <summary
        aria-label="Menu"
        className="list-none cursor-pointer inline-flex items-center justify-center w-11 h-11 rounded-full border border-black/10 text-ink [&::-webkit-details-marker]:hidden"
      >
        <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden>
          <path d="M1 1h18M1 7h18M1 13h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </summary>
      <nav
        aria-label="Mobile"
        className="absolute inset-x-0 top-full bg-white border-b border-black/5 shadow-lg z-50 max-h-[calc(100dvh-120px)] overflow-y-auto"
      >
        <ul className="py-2">
          {items.map((item) =>
            'children' in item ? (
              <li key={item.label}>
                <Link href={item.children[0].href} onClick={close} className={linkCls}>
                  {item.label}
                </Link>
                <ul className="ps-5 border-s-2 border-brand-muted ms-5 mb-1">
                  {item.children.map((c) => (
                    <li key={c.href}>
                      <Link href={c.href} onClick={close} className={linkCls}>
                        {c.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li key={item.href}>
                <Link href={item.href} onClick={close} className={linkCls}>
                  {item.label}
                </Link>
              </li>
            ),
          )}
          {authLinks.map((a) => (
            <li key={a.label} className="border-t border-black/5">
              <Link href={a.href} onClick={close} className={linkCls}>
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
