import { redirect } from 'next/navigation';
import {
  canProfileWatch,
  ensureHousehold,
  getCatalogRows,
  getOverridesForHousehold,
  getProfiles,
  listCollectionsLite,
  type CatalogRowData,
  type VideoRow,
  type ContentOverrideRow,
  type ProfileRow,
} from '@albunyaan/core/data';
import { getAuthUser, getMember, isParentUnlocked } from '../../lib/session';
import { addOverrideAction, lockParentsAction, removeOverrideAction } from '../actions';
import PinGate from '../../components/PinGate';
import SetPinGate from '../../components/SetPinGate';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Parent dashboard — Albunyaan TV' };

interface FlatVideo {
  id: string;
  title: string;
  collectionId: string | null;
  collectionTitle: string | null;
  row: VideoRow;
}

function flatten(rows: CatalogRowData[]): FlatVideo[] {
  const out: FlatVideo[] = [];
  for (const r of rows) {
    if (r.kind === 'category') continue; // category rows carry series, not videos
    for (const v of r.videos) {
      out.push({
        id: v.id,
        title: v.title,
        collectionId: r.kind === 'series' ? r.collection.id : null,
        collectionTitle: r.kind === 'series' ? r.collection.title : null,
        row: v,
      });
    }
  }
  return out;
}

function KidSection({
  kid,
  overrides,
  videos,
  collections,
}: {
  kid: ProfileRow;
  overrides: ContentOverrideRow[];
  videos: FlatVideo[];
  collections: { id: string; title: string }[];
}) {
  const kidOverrides = overrides.filter((o) => o.profile_id === kid.id);
  const titleFor = (o: ContentOverrideRow) =>
    o.target_kind === 'video'
      ? videos.find((v) => v.id === o.target_id)?.title ?? 'Unknown video'
      : `${collections.find((c) => c.id === o.target_id)?.title ?? 'Unknown series'} (whole series)`;
  const visibleCount = videos.filter((v) => canProfileWatch(kid, v.row, v.collectionId, overrides)).length;

  const bySeries = new Map<string, FlatVideo[]>();
  for (const v of videos) {
    const key = v.collectionTitle ?? 'Live channels & singles';
    bySeries.set(key, [...(bySeries.get(key) ?? []), v]);
  }

  return (
    <section className="card-elevated rounded-2xl p-8">
      <div className="flex items-center gap-4 mb-6">
        <span
          aria-hidden
          className="w-12 h-12 rounded-full grid place-items-center text-xl font-extrabold text-white"
          style={{ backgroundColor: `hsl(${kid.avatar_hue} 45% 35%)` }}
        >
          {kid.name[0]}
        </span>
        <div>
          <h2 className="font-bold text-lg">{kid.name}</h2>
          <p className="text-[13px] text-ink-muted">
            Age band {kid.age_band} · sees {visibleCount} of {videos.length} titles
            {kid.daily_limit_minutes ? ` · ${kid.daily_limit_minutes} min/day limit` : ' · no time limit'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Existing blocks & exceptions */}
        <div>
          <p className="section-label mb-3">Blocks &amp; exceptions</p>
          {kidOverrides.length === 0 && (
            <p className="text-[13px] text-ink-muted">None yet — add one on the right.</p>
          )}
          <ul className="space-y-2">
            {kidOverrides.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 text-[13px] bg-surface-warm rounded-xl px-4 py-2.5"
              >
                <span>
                  <strong className={o.action === 'block' ? 'text-red-800' : 'text-brand-dark'}>
                    {o.action === 'block' ? 'Blocked' : 'Allowed'}
                  </strong>{' '}
                  — {titleFor(o)}
                </span>
                <form action={removeOverrideAction}>
                  <input type="hidden" name="overrideId" value={o.id} />
                  <button type="submit" className="text-[12px] font-semibold text-ink-muted hover:text-ink">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>

        {/* Add a block / exception */}
        <div>
          <p className="section-label mb-3">Add a rule</p>
          <form action={addOverrideAction} className="space-y-3">
            <input type="hidden" name="profileId" value={kid.id} />
            <select
              name="target"
              required
              defaultValue=""
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand"
              aria-label={`Choose a title or series for ${kid.name}`}
            >
              <option value="" disabled>
                Choose a video or a whole series…
              </option>
              <optgroup label="Whole series">
                {collections.map((c) => (
                  <option key={c.id} value={`collection|${c.id}`}>
                    {c.title} (whole series)
                  </option>
                ))}
              </optgroup>
              {[...bySeries.entries()].map(([label, vids]) => (
                <optgroup key={label} label={label}>
                  {vids.map((v) => (
                    <option key={v.id} value={`video|${v.id}`}>
                      {v.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="flex gap-2.5">
              <button
                type="submit"
                name="action"
                value="block"
                className="px-5 py-2.5 rounded-full bg-red-700 hover:bg-red-800 transition text-white text-[13px] font-semibold"
              >
                Block
              </button>
              <button
                type="submit"
                name="action"
                value="allow"
                className="px-5 py-2.5 rounded-full bg-brand hover:bg-brand-light transition text-white text-[13px] font-semibold"
              >
                Allow (exception)
              </button>
            </div>
            <p className="text-[12px] text-ink-muted leading-relaxed">
              A block always wins. An allow lets {kid.name} watch something above the {kid.age_band} age
              band. Rules apply instantly on every page.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

export default async function ParentsPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');
  const member = await getMember();
  if (!member) redirect('/account'); // auth user without a person link — /account explains

  const household = await ensureHousehold(member);
  if (!household.pin_hash) return <SetPinGate />; // fresh household: set a PIN before anything
  if (!(await isParentUnlocked(household.id))) return <PinGate />;

  const [profiles, overrides, rows, collections] = await Promise.all([
    getProfiles(household.id),
    getOverridesForHousehold(household.id),
    getCatalogRows(),
    listCollectionsLite(),
  ]);
  const kids = profiles.filter((p) => p.kind === 'kid');
  const videos = flatten(rows);

  return (
    <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16">
      <div className="flex items-center justify-between gap-4 mb-10">
        <div>
          <p className="section-label">Parent dashboard</p>
          <h1 className="text-3xl font-extrabold tracking-tight mt-2">Your children</h1>
        </div>
        <form action={lockParentsAction}>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-full border border-black/10 text-[13px] font-semibold text-ink-secondary hover:border-brand hover:text-brand transition"
          >
            Lock dashboard
          </button>
        </form>
      </div>

      <div className="space-y-10">
        {kids.length === 0 && (
          <p className="text-[14px] text-ink-secondary card-elevated rounded-2xl p-8">
            No kid profiles yet — they arrive with profile management, in sha&rsquo; Allah. Rules you
            set here always apply per kid profile.
          </p>
        )}
        {kids.map((kid) => (
          <KidSection key={kid.id} kid={kid} overrides={overrides} videos={videos} collections={collections} />
        ))}
      </div>

      <p className="mt-10 text-[13px] text-ink-muted">
        Rules are stored in the household database (Supabase) and enforced server-side on every
        program page — switching devices or reloading changes nothing.
      </p>
    </div>
  );
}
