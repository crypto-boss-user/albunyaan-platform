'use client';

import { useActionState, useState } from 'react';
import type { AdminPlanRow } from '@albunyaan/core/data';
import { createPlanAction, updatePlanAction, type PlanFormState } from './actions';
import { BILLING_OPTIONS, REDEN_BETAAL } from './plan-form';

const KP = 'na de kijkplatformkeuze';

/**
 * Edit/New plan in de Uscreen-vorm (AD 2.3; norm subscriptions-plan-edit.json / -new.json): kop "Edit plan"/"New plan" + Preview + Save;
 * Plan name · Description · Image · Billing period · Price EUR (+ Change price / AUD CAD GBP USD / Manage currencies) · Free trial · Pausing ·
 * Reduce cancellation churn · Visibility · Content. Betaalvelden en content-koppeling uitgeschakeld met reden (founder 2026-09-07).
 */
export default function PlanForm({ plan, magBewerken, created }: { plan: AdminPlanRow | null; magBewerken: boolean; created?: boolean }) {
  const action = plan ? updatePlanAction : createPlanAction;
  const [state, formAction, pending] = useActionState(action, { error: null, saved: false } as PlanFormState);
  const [trial, setTrial] = useState((plan?.trial_days ?? 0) > 0);
  const [dirty, setDirty] = useState(!plan);
  return (
    <form action={formAction} onChange={() => setDirty(true)} className="mx-auto max-w-[1120px]" data-plan-form={plan ? 'edit' : 'new'}>
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7">{plan ? 'Edit plan' : 'New plan'}</h1>
        <div className="flex items-center gap-3">
          <span className="ad-help">{magBewerken ? REDEN_BETAAL : 'bewerken vereist de admin-rol'}</span>
          <button type="button" className="ad-btn ad-btn-outline" disabled title={`Preview — ${KP}`}>Preview</button>
          <button type="submit" className="ad-btn ad-btn-primary" disabled={pending || !dirty || !magBewerken} title={magBewerken ? undefined : 'Save — bewerken vereist de admin-rol'} data-save>{pending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {state.error && <p className="mb-4 text-[13px]" style={{ color: 'var(--ad-destructive)' }} data-form-error>{state.error}</p>}
      {state.saved && !state.error && <p className="mb-4 text-[13px]" style={{ color: 'var(--ad-primary)' }} data-form-saved>Plan saved</p>}
      {created && !state.saved && <p className="mb-4 text-[13px]" style={{ color: 'var(--ad-primary)' }} data-plan-created>Plan created</p>}

      <div className="grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="flex flex-col gap-6">
          <section className="ad-card p-6">
            <label className="ad-label" htmlFor="plan-title">Plan name</label>
            <input id="plan-title" name="title" required maxLength={200} defaultValue={plan?.title ?? ''} className="ad-input mb-4" />
            <label className="ad-label" htmlFor="plan-description">Description</label>
            <textarea id="plan-description" name="description" rows={5} defaultValue={plan?.description ?? ''} className="ad-textarea mb-1" placeholder="Tell your audience what they get with this plan" />
            <p className="ad-help mb-4">Uscreen: rich text (Heading 1–4, Body, Small, Quote, Align, Direction) — hier platte tekst.</p>
            <label className="ad-label" htmlFor="plan-image">Image</label>
            <input id="plan-image" type="file" disabled title={`Image — ${KP}`} className="ad-input mb-1" />
            <p className="ad-help">Recommended size: 995×560px — uitgeschakeld {KP}.</p>
          </section>

          <section className="ad-card p-6">
            <label className="ad-label" htmlFor="plan-billing">Billing period</label>
            <select id="plan-billing" name="billing_period" defaultValue={plan?.billing_period ?? 'monthly'} className="ad-select mb-4">
              {BILLING_OPTIONS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
              {plan?.billing_period === 'onetime' && <option value="onetime">One-time (bestaand; niet in Uscreen-formulier)</option>}
            </select>
            <label className="ad-label" htmlFor="plan-price">Price</label>
            <div className="mb-2 flex items-center gap-3">
              <span className="ad-badge ad-badge-muted">EUR</span>
              <input id="plan-price" name="price" type="text" inputMode="decimal" required defaultValue={plan ? (plan.amount_cents / 100).toFixed(2) : '0.00'} className="ad-input !w-40" />
              <button type="button" className="ad-btn ad-btn-outline" disabled title={`Change price — ${REDEN_BETAAL}`}>Change price</button>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-3" data-valuta>
              {['AUD', 'CAD', 'GBP', 'USD'].map((v) => (
                <label key={v} className="flex items-center gap-1 text-[13px]">{v} <input type="number" defaultValue="0.00" className="ad-input !w-24" disabled title={`${v} — ${REDEN_BETAAL}`} /></label>
              ))}
              <button type="button" className="ad-btn ad-btn-ghost" disabled title={`Manage currencies — ${REDEN_BETAAL}`}>Manage currencies</button>
            </div>
          </section>

          <section className="ad-card p-6">
            <div className="mb-4 flex items-start gap-3">
              <input id="plan-free-trial" name="free_trial" type="checkbox" role="switch" aria-checked={trial} checked={trial} onChange={(e) => setTrial(e.target.checked)} className="mt-1 size-4" />
              <div className="flex-1">
                <label className="ad-label !mb-0" htmlFor="plan-free-trial">Free trial</label>
                <p className="ad-help">Customers can try your content before committing.</p>
                {trial && (
                  <div className="mt-2 flex items-center gap-2">
                    <input name="trial_period" type="number" min={0} max={365} defaultValue={plan?.trial_days ?? 7} className="ad-input !w-24" aria-label="Trial period (days)" />
                    <span className="ad-help">days</span>
                  </div>
                )}
              </div>
            </div>
            <div className="mb-4 flex items-start gap-3">
              <input type="checkbox" role="switch" disabled title={`Pausing — ${REDEN_BETAAL}`} className="mt-1 size-4" aria-label="Pausing" />
              <div><span className="ad-label !mb-0">Pausing</span><p className="ad-help">Subscribers can pause for up to 3 months instead of canceling. Disabling this later won&rsquo;t affect those who are paused. — {REDEN_BETAAL}</p></div>
            </div>
            <div className="flex items-start gap-3">
              <input type="checkbox" role="switch" disabled title={`Reduce cancellation churn — ${REDEN_BETAAL}`} className="mt-1 size-4" aria-label="Reduce cancellation churn" />
              <div>
                <span className="ad-label !mb-0">Reduce cancellation churn</span>
                <p className="ad-help">When members cancel, nurture them back to active membership with a temporarily reduced price. Set a percentage discount to win them back. — {REDEN_BETAAL}</p>
                <div className="mt-2 flex gap-3">
                  <label className="text-[13px]">Discount percentage (%) <input type="number" disabled className="ad-input !w-24" title={REDEN_BETAAL} /></label>
                  <label className="text-[13px]">Deal duration (billing periods) <input type="number" disabled className="ad-input !w-24" title={REDEN_BETAAL} /></label>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="ad-card p-6" data-visibility>
            <h2 className="mb-3 text-[16px] font-semibold">Visibility</h2>
            <label className="mb-2 flex items-start gap-2"><input type="radio" name="visibility" value="public" defaultChecked={(plan?.visibility ?? 'public') === 'public'} className="mt-1" /> <span><span className="font-medium">Public</span><span className="ad-help block">Visible to those who visit your store</span></span></label>
            <label className="flex items-start gap-2"><input type="radio" name="visibility" value="private" defaultChecked={plan?.visibility === 'private'} className="mt-1" /> <span><span className="font-medium">Private</span><span className="ad-help block">Hidden from your website. Available via apps or direct link</span></span></label>
          </section>
          <section className="ad-card p-6" data-content>
            <h2 className="mb-3 text-[16px] font-semibold">Content</h2>
            <div className="mb-3 flex gap-2">
              <button type="button" className="ad-btn ad-btn-outline" disabled title={`Manage content — ${REDEN_BETAAL}`}>Manage content</button>
              <button type="button" className="ad-btn ad-btn-ghost" disabled title={`Remove all — ${REDEN_BETAAL}`}>Remove all</button>
            </div>
            <p className="ad-help">No content added yet — entitlements per plan volgen de betaalbeslissing (Uscreen: 6009 videos, 682 collections, 28 live events).</p>
          </section>
        </div>
      </div>
    </form>
  );
}
