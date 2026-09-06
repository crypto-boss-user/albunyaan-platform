import { requireAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';

/**
 * Content › Authors (AD 1.3; norm AD0-inventaris §2.1): Uscreen toont "No authors yet" (0 authors); de founder wil authors leeg zoals
 * gemeten. De tabellen authors/video_authors (0001) bestaan wél maar zijn leeg; "New author" staat er zoals gemeten maar is
 * uitgeschakeld tot de founder het formulier wil (AD1-teamreview) — eerlijk leeg, geen dode knop.
 */
export default async function AdminAuthorsPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-[1120px]" data-authors-page>
      <h1 className="mb-6 text-[20px] font-semibold leading-7">Authors</h1>
      <div className="ad-card px-6 py-16 text-center">
        <p className="text-[18px] font-semibold">No authors yet</p>
        <p className="ad-help mt-1 mb-4">Create author profiles to associate content with the people who made it.</p>
        <button type="button" className="ad-btn ad-btn-primary" disabled title="New author — leeg zoals gemeten (Uscreen: 0 authors); formulier na founder-ja">New author</button>
        <p className="ad-help mt-2">Leeg zoals gemeten (Uscreen: 0 authors). De tabel authors bestaat (0001) maar is leeg; het formulier volgt na founder-ja (AD1-teamreview).</p>
      </div>
    </div>
  );
}
