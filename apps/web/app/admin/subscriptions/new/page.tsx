import { requireAdmin } from '../../../../lib/admin';
import PlanForm from '../PlanForm';

export const dynamic = 'force-dynamic';

/** New plan (Uscreen /subscription_plans/new, subscriptions-plan-new.json): zelfde velden als Edit, "No content added yet". */
export default async function NewPlanPage() {
  await requireAdmin('admin');
  return <PlanForm plan={null} magBewerken />;
}
