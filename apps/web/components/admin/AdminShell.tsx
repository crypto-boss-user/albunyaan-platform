'use client';

import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';

/**
 * Client-schil (AD 1.1): houdt de in-/uitgeklapte staat van het zijmenu, zodat de sidebar-knop in de kopbalk echt werkt
 * (Uscreen "Toggle Sidebar"). Server-onderdelen (Sign out-formulier) komen als ReactNode binnen.
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
  return (
    <>
      {!collapsed && <AdminSidebar email={email} role={role} signOut={signOut} />}
      <div style={{ marginLeft: collapsed ? 0 : 'var(--ad-sidebar-w)' }}>
        <AdminTopbar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} welkom={email.split('@')[0]} />
        <div data-admin-main className="px-12 py-8">{children}</div>
      </div>
    </>
  );
}
