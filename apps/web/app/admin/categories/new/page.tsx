import { requireAdmin } from '../../../../lib/admin';
import NewCategoryForm from './NewCategoryForm';

export const dynamic = 'force-dynamic';

/** Content › Categories › Add category (AD 1.3): eerst een titel, dan aanmaken (B83: Uscreen maakt bij de knop direct "Draft Category" aan; wij niet). */
export default async function NewCategoryPage() {
  await requireAdmin('editor');
  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="mb-6 text-[20px] font-semibold leading-7">Add category</h1>
      <div className="ad-card p-6"><NewCategoryForm /></div>
    </div>
  );
}
