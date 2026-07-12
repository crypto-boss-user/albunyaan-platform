import Link from 'next/link';
import { requireAdminPreMfa } from '../../lib/admin';
import { signOutAction } from '../auth/actions';

export const dynamic = 'force-dynamic';

/**
 * Admin shell. The layout enforces only the PRE-MFA gate (session + roster) so
 * non-admins get a 404 before any admin chrome renders AND the /admin/mfa*
 * pages (which an aal1 admin must reach to step up) aren't locked out. Every
 * leaf page/action still calls the full requireAdmin() — the layout is UX, not
 * the security boundary (Next layouts don't run for server actions and can be
 * skipped on client navigation).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdminPreMfa();

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-black/10 bg-white">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-extrabold tracking-tight text-ink">Albunyaan <span className="text-brand">Admin</span></Link>
            <nav className="hidden sm:flex items-center gap-5 text-[13px] font-semibold text-ink-secondary">
              <Link href="/admin/videos" className="hover:text-brand transition">Videos</Link>
              <Link href="/admin/vouchers" className="hover:text-brand transition">Vouchers</Link>
              <Link href="/admin/members" className="hover:text-brand transition">Members</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-ink-muted">
            <span className="hidden sm:inline uppercase tracking-wide font-semibold">{admin.role}</span>
            <form action={signOutAction}>
              <button className="font-semibold text-ink-secondary hover:text-brand transition">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10">{children}</main>
    </div>
  );
}
