import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Log in — Albunyaan TV' };

const NOTICES: Record<string, string> = {
  'confirm-failed': 'That login link is invalid or has expired — request a fresh one below.',
  'invalid-link': 'That link was incomplete — request a fresh one below.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="max-w-md mx-auto px-5 py-20">
      <p className="section-label">Members</p>
      <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-2">Log in</h1>
      <p className="text-[14px] text-ink-secondary mb-8">
        For existing Albunyaan TV members. Public signup opens with the membership relaunch.
      </p>
      <LoginForm serverNotice={error ? NOTICES[error] ?? null : null} />
    </div>
  );
}
