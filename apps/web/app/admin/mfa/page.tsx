import { redirect } from 'next/navigation';
import { requireAdminPreMfa } from '../../../lib/admin';
import { getServerSupabase } from '../../../lib/supabase/server';
import { stepUpAction } from '../actions';
import CodeForm from '../../../components/CodeForm';

export const dynamic = 'force-dynamic';

/**
 * TOTP step-up for an admin who already has a verified factor but whose current
 * session is only aal1. Pre-MFA gate only. On success the session becomes aal2
 * and requireAdmin() lets them through.
 */
export default async function AdminMfaStepUpPage() {
  await requireAdminPreMfa();
  const supabase = await getServerSupabase();

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') redirect('/admin'); // already stepped up

  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (!(factors?.totp ?? []).some((f) => f.status === 'verified')) redirect('/admin/mfa/enroll');

  return (
    <div className="max-w-md mx-auto py-16">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted mb-1">Admin security</p>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-2">Enter your authenticator code</h1>
      <p className="text-[14px] text-ink-secondary leading-relaxed mb-6">
        Open your authenticator app and enter the current 6-digit code to unlock the admin console.
      </p>
      <CodeForm action={stepUpAction} submitLabel="Unlock admin" />
    </div>
  );
}
