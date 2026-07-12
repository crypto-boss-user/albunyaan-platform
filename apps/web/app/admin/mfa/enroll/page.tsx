import { redirect } from 'next/navigation';
import { requireAdminPreMfa } from '../../../../lib/admin';
import { getServerSupabase } from '../../../../lib/supabase/server';
import { verifyEnrollAction } from '../../actions';
import CodeForm from '../../../../components/CodeForm';

export const dynamic = 'force-dynamic';

/**
 * First-time TOTP enrollment for an admin with no verified factor yet.
 * Pre-MFA gate only (this page is how you GET aal2). Renders the QR + secret
 * from a freshly-enrolled factor; the code is verified by verifyEnrollAction,
 * which elevates the session to aal2 and redirects to /admin.
 */
export default async function AdminMfaEnrollPage() {
  await requireAdminPreMfa();
  const supabase = await getServerSupabase();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  // Already have a verified factor → this admin just needs to step up, not enroll.
  // (data.totp is the verified-only array; unverified factors live in data.all.)
  if ((factors?.totp ?? []).length > 0) redirect('/admin/mfa');

  // Clear any stale unverified factors so refreshes don't pile them up, then
  // enroll one fresh factor to display. (enroll() creates an UNVERIFIED factor;
  // it does not change the session's assurance level, so rendering it is safe.)
  for (const stale of (factors?.all ?? []).filter((f) => f.factor_type === 'totp' && f.status === 'unverified')) {
    await supabase.auth.mfa.unenroll({ factorId: stale.id });
  }
  const { data: enrolled, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `admin-${Date.now()}`,
  });
  if (error || !enrolled) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <p className="text-[14px] text-red-600">Could not start authenticator setup. Refresh to try again.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-10">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1">Admin security</p>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-2">Set up two-factor authentication</h1>
      <p className="text-[14px] text-ink-secondary leading-relaxed mb-6">
        The admin console requires an authenticator app. Scan this QR code with Google Authenticator,
        1Password, or similar, then enter the 6-digit code to finish.
      </p>

      <div className="rounded-2xl bg-white border border-black/10 p-6 mb-6 text-center">
        {/* qr_code is an inline SVG data: URI — allowed by the CSP img-src data: rule. */}
        <img src={enrolled.totp.qr_code} alt="Authenticator QR code" className="mx-auto w-48 h-48" />
        <p className="mt-4 text-[12px] text-ink-muted">Can’t scan? Enter this secret manually:</p>
        <code className="block mt-1 text-[13px] font-mono tracking-wide text-ink break-all">{enrolled.totp.secret}</code>
      </div>

      <CodeForm action={verifyEnrollAction} submitLabel="Verify & enter admin" />
    </div>
  );
}
