import { notFound } from 'next/navigation';
import { getPlanForAdmin } from '@albunyaan/core/data';
import { UUID_RE } from '../../../../../lib/admin-form';
import { hasRole, requireAdmin } from '../../../../../lib/admin';
import PlanForm from '../../PlanForm';

export const dynamic = 'force-dynamic';

/** Edit plan (Uscreen /subscription_plans/<id>/edit, subscriptions-plan-edit.json). */
export default async function EditPlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { admin } = await requireAdmin(); // lezen voor elke rol; Save uit als de action (admin) zou weigeren (koude review AD 2.3 I-1)
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const plan = await getPlanForAdmin(id);
  if (!plan) notFound();
  const { created } = await searchParams;
  return <PlanForm plan={plan} magBewerken={hasRole(admin.role, 'admin')} created={created === '1'} />;
}
