import type { PlanInput } from '@albunyaan/core/data';

/** Uscreen "Billing period": Monthly / 3 months / 6 months / Annual → plans.billing_period (gemeten subscriptions-plan-edit.json). */
export const BILLING_OPTIONS: { key: PlanInput['billing_period']; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: '3 months' },
  { key: 'semiannual', label: '6 months' },
  { key: 'yearly', label: 'Annual' },
];
export const BILLING_LABEL: Record<string, string> = Object.fromEntries(BILLING_OPTIONS.map((b) => [b.key, b.label]));
export const REDEN_BETAAL = 'koppeling aan betaalprovider volgt';
