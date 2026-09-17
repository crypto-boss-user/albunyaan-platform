import { Inter } from 'next/font/google';
import { requireAdminPreMfa } from '../../lib/admin';
import { isDemo } from '../../lib/demo';
import { signOutAction } from '../auth/actions';
import AdminShell from '../../components/admin/AdminShell';
import './admin.css';

export const dynamic = 'force-dynamic';

/** Inter = het gemeten font van de Uscreen-admin (AD0-inventaris §3); alleen binnen `.admin-shell`, de storefront blijft Cairo. */
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' });

/**
 * Admin shell (AD 1.1, Uscreen-vorm: zijmenu 272 px + kopbalk 61 px + grijze werkruimte). The layout enforces only the PRE-MFA
 * gate (session + roster) so non-admins get a 404 before any admin chrome renders AND the /admin/mfa* pages (which an aal1
 * admin must reach to step up) aren't locked out. Every leaf page/action still calls the full requireAdmin() — the layout is
 * UX, not the security boundary (Next layouts don't run for server actions and can be skipped on client navigation).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin, user } = await requireAdminPreMfa();

  const demo = isDemo();

  return (
    <div className={`admin-shell ${inter.variable} min-h-screen`} dir="ltr">
      {/* Onmisbaar in een demo: zonder deze balk kan iemand een demoscherm voor productie aanzien. */}
      {demo && (
        <div
          data-demo-banner
          style={{
            position: 'sticky', top: 0, zIndex: 60, background: '#7d6412', color: '#fff',
            padding: '7px 16px', fontSize: 13, lineHeight: 1.4, textAlign: 'center',
          }}
        >
          <strong>Demo</strong> — verzonnen gegevens, alleen lezen. Geen enkel echt lid, bedrag of
          e-mailadres staat op dit scherm. Opslaan en verwijderen zijn uitgeschakeld.
        </div>
      )}
      <AdminShell
        email={user.email ?? ''}
        role={admin.role}
        signOut={
          <form action={signOutAction}>
            <button type="submit" className="ad-btn ad-btn-ghost !h-8 !px-2 text-[12px]" title="Sign out">
              Sign out
            </button>
          </form>
        }
      >
        {children}
      </AdminShell>
    </div>
  );
}
