'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ADMIN_MENU, type AdminMenuSection } from '../../app/admin/menu';

/** Lucide-paden zoals de gemeten Uscreen-zijbalk (house, folder-closed, users, repeat, circle-dollar-sign, filter/funnel, bar-chart, settings). */
const ICONS: Record<AdminMenuSection['icoon'], React.ReactNode> = {
  home: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  content: (
    <>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M2 10h20" />
    </>
  ),
  people: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  subscriptions: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
  sales: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
      <path d="M12 18V6" />
    </>
  ),
  marketing: <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />,
  analytics: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {children}
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'; // Home is alleen actief op de Home zelf, niet op elke /admin/*-pagina
  return pathname === href || pathname.startsWith(href + '/');
}

/** Een plat item of een uitklapbare sectie — één render-pad voor de hoofdgroep en de ondergroep (Settings). */
function MenuSection({ s, pathname, open, setOpen }: { s: AdminMenuSection; pathname: string; open: Record<string, boolean>; setOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>> }) {
  const sectionActive = s.items.length ? s.items.some((it) => isActive(pathname, it.href)) : isActive(pathname, s.href);
  const expanded = s.items.length > 0 && (open[s.naam] ?? sectionActive);
  return (
    <li data-menu-section={s.naam}>
      {s.items.length === 0 ? (
        <Link href={s.href} className="ad-menu-btn" data-active={sectionActive} aria-current={sectionActive ? 'page' : undefined}>
          <Icon>{ICONS[s.icoon]}</Icon>
          <span className="truncate">{s.naam}</span>
        </Link>
      ) : (
        <button
          type="button"
          className="ad-menu-btn"
          data-active={sectionActive && !expanded}
          aria-expanded={expanded}
          onClick={() => setOpen((o) => ({ ...o, [s.naam]: !expanded }))}
        >
          <Icon>{ICONS[s.icoon]}</Icon>
          <span className="truncate">{s.naam}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ml-auto transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : undefined }}>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      )}
      {expanded && (
        <ul className="ad-menu-sub mt-1 flex flex-col gap-1">
          {s.items.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className="ad-menu-btn" data-active={isActive(pathname, it.href)} aria-current={isActive(pathname, it.href) ? 'page' : undefined}>
                <span className="truncate">{it.naam}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Zijmenu in Uscreen-vorm (AD 1.1): 272 px, wit, logo-rij, groepen met chevron die uitklappen op de actieve sectie,
 * subitems met een linkerlijn; onderaan het account-blok met een echte Sign out (geen dode knoppen).
 */
export default function AdminSidebar({
  email,
  role,
  signOut,
}: {
  email: string;
  role: string;
  signOut: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => setOpen({}), [pathname]); // na navigatie volgt het menu weer de actieve sectie (koude review AD 1.1, punt 2)

  return (
    <aside
      data-admin-sidebar
      className="fixed inset-y-0 left-0 flex flex-col bg-white"
      style={{ width: 'var(--ad-sidebar-w)', borderRight: '1px solid var(--ad-sidebar-border)' }}
    >
      <div className="p-2">
        <Link href="/admin" className="ad-menu-btn" style={{ height: 48 }}>
          <span className="grid size-8 place-items-center rounded-lg text-white font-bold text-[15px]" style={{ background: 'var(--ad-sidebar-primary)' }}>A</span>
          <span className="font-semibold" style={{ color: 'var(--ad-sidebar-primary)' }}>Albunyaan</span>
        </Link>
      </div>
      <nav aria-label="Admin" className="flex flex-1 flex-col overflow-y-auto px-2">
        <ul className="flex flex-col gap-1">
          {ADMIN_MENU.filter((s) => s.plaats !== 'onderaan').map((s) => (
            <MenuSection key={s.naam} s={s} pathname={pathname} open={open} setOpen={setOpen} />
          ))}
        </ul>
        {/* Ondergroep zoals Uscreen (Settings; Changelog/Refer/Get help = buiten scope B81) */}
        <ul className="mt-auto flex flex-col gap-1 pb-2" data-menu-onderaan>
          {ADMIN_MENU.filter((s) => s.plaats === 'onderaan').map((s) => (
            <MenuSection key={s.naam} s={s} pathname={pathname} open={open} setOpen={setOpen} />
          ))}
        </ul>
      </nav>
      <div className="p-2" style={{ borderTop: '1px solid var(--ad-sidebar-border)' }}>
        <div className="ad-menu-btn" style={{ height: 48 }}>
          <span className="grid size-8 place-items-center rounded-lg text-[12px] font-semibold" style={{ background: 'var(--ad-accent)', color: 'var(--ad-primary)' }}>
            {email.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold" style={{ color: 'var(--ad-sidebar-primary)' }}>{role}</span>
            <span className="block truncate text-[12px] leading-4" style={{ color: 'var(--ad-muted-fg)' }}>{email}</span>
          </span>
          {signOut}
        </div>
      </div>
    </aside>
  );
}
