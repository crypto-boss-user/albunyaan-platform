import { redirect } from 'next/navigation';
import { ensureHousehold, getProfiles } from '@albunyaan/core/data';
import { getActiveProfile, getAuthUser, getMember } from '../../lib/session';
import { selectProfileAction } from '../actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Who is watching? — Albunyaan TV' };

/**
 * DB-backed profile picker — members only, scoped to THEIR household
 * (created lazily on first visit). Selection persists via cookie (server action).
 */
export default async function ProfilesPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');
  const member = await getMember();
  if (!member) redirect('/account'); // auth user without a person link — /account explains

  const household = await ensureHousehold(member);
  const [profiles, active] = await Promise.all([getProfiles(household.id), getActiveProfile()]);

  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-20 text-center">
      <p className="section-label">Profiles</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 mb-12">
        Who is watching?
      </h1>
      <div className="flex flex-wrap justify-center gap-8">
        {profiles.map((p) => {
          const isActive = active?.id === p.id;
          return (
            <form key={p.id} action={selectProfileAction}>
              <input type="hidden" name="profileId" value={p.id} />
              <button
                type="submit"
                className={`group flex flex-col items-center gap-3 focus:outline-none ${
                  isActive ? '' : 'opacity-85 hover:opacity-100'
                }`}
                aria-pressed={isActive}
              >
                <span
                  aria-hidden
                  className={`w-28 h-28 rounded-3xl grid place-items-center text-4xl font-extrabold text-white transition group-hover:scale-105 group-focus-visible:scale-105 ${
                    isActive ? 'ring-4 ring-brand ring-offset-4 ring-offset-surface' : ''
                  }`}
                  style={{ backgroundColor: `hsl(${p.avatar_hue} 45% 38%)` }}
                >
                  {p.name[0]}
                </span>
                <span className="font-bold text-[15px]">{p.name}</span>
                <span className="text-[12px] text-ink-muted -mt-2">
                  {p.kind === 'kid' ? `Kids · ${p.age_band}` : 'Parent'}
                  {isActive && ' · active'}
                </span>
              </button>
            </form>
          );
        })}
      </div>
      <p className="mt-14 text-[13px] text-ink-muted max-w-md mx-auto">
        Kid profiles see an age-appropriate catalog. Parents manage blocks and exceptions from the{' '}
        <a href="/parents" className="text-brand font-semibold">
          parent dashboard
        </a>
        .
      </p>
    </div>
  );
}
