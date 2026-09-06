'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { breadcrumb } from '../../app/admin/menu';

/** Kopbalk in Uscreen-vorm (AD 1.1): 61 px, echte "Toggle Sidebar"-knop + broodkruimel "Content › Videos › …". */
export default function AdminTopbar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const crumbs = breadcrumb(pathname);
  return (
    <header className="flex items-center gap-4 bg-white px-4" style={{ height: 61, borderBottom: '1px solid var(--ad-border)' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-label="Toggle Sidebar"
        aria-pressed={collapsed}
        className="ad-btn ad-btn-ghost !h-8 !w-8 !p-0 justify-center"
        style={{ color: 'var(--ad-muted-fg)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18" />
        </svg>
      </button>
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-[14px]">
          {crumbs.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: 'var(--ad-muted-fg)' }}>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              )}
              <span aria-current={i === crumbs.length - 1 ? 'page' : undefined} style={{ color: i === crumbs.length - 1 ? 'var(--ad-fg)' : 'var(--ad-muted-fg)' }}>
                {c}
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <Link href="/" className="ml-auto text-[13px]" style={{ color: 'var(--ad-muted-fg)' }}>
        View website
      </Link>
    </header>
  );
}
