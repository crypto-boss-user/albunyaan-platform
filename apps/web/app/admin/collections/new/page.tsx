import { requireAdmin } from '../../../../lib/admin';
import NewCollectionForm from './NewCollectionForm';

export const dynamic = 'force-dynamic';

/** Content › Collections › New (AD 1.3): eerst een titel, dan aanmaken — Uscreen maakt bij de knop direct een draft aan (B83); wij niet. */
export default async function NewCollectionPage() {
  await requireAdmin('editor');
  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="mb-6 text-[20px] font-semibold leading-7">Add new collection</h1>
      <div className="ad-card p-6"><NewCollectionForm /></div>
    </div>
  );
}
