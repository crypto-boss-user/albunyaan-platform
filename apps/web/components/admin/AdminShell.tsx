'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';

/**
 * Client-schil (AD 1.1): houdt de in-/uitgeklapte staat van het zijmenu, zodat de sidebar-knop in de kopbalk echt werkt
 * (Uscreen "Toggle Sidebar"). Server-onderdelen (Sign out-formulier) komen als ReactNode binnen.
 *
 * Mobiel (17-09): TWEE aparte standen in plaats van één, met opzet.
 * Op een breed scherm hoort het menu open te staan, op een telefoon dicht. Met één boolean kan dat
 * niet zonder tijdens het renderen te weten hoe breed het scherm is — en dat weet de server niet,
 * wat een hydration-mismatch geeft. Daarom stuurt `collapsed` het brede scherm en `mobielOpen` de
 * telefoon, elk met hun eigen beginstand, en kiest de CSS per breedte welke van de twee telt.
 * De knop bedient beide; in elke context doet hij daardoor het juiste.
 */
export default function AdminShell({
  email,
  role,
  signOut,
  children,
}: {
  email: string;
  role: string;
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobielOpen, setMobielOpen] = useState(false);
  const pathname = usePathname();

  // Na een klik op een menu-item blijft de lade anders openstaan over de nieuwe pagina heen.
  useEffect(() => setMobielOpen(false), [pathname]);

  return (
    <div data-admin-root data-sidebar={collapsed ? 'collapsed' : 'open'} data-mobiel={mobielOpen ? 'open' : 'dicht'}>
      <AdminSidebar email={email} role={role} signOut={signOut} />
      {/* Alleen zichtbaar op smalle schermen wanneer de lade openstaat; tikken sluit hem. */}
      <button
        type="button"
        data-admin-backdrop
        aria-label="Menu sluiten"
        tabIndex={mobielOpen ? 0 : -1}
        onClick={() => setMobielOpen(false)}
      />
      <div data-admin-body>
        <AdminTopbar
          collapsed={collapsed}
          onToggle={() => {
            setCollapsed((c) => !c);
            setMobielOpen((o) => !o);
          }}
          welkom={email.split('@')[0]}
        />
        <div data-admin-main>{children}</div>
      </div>
    </div>
  );
}
