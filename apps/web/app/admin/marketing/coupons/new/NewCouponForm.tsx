'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { createVoucherAction, type CreateVoucherState } from '../../../vouchers/actions';

/**
 * "New coupon" in de Uscreen-vorm: Coupon details (Code, Discount, Coupon description) · Redemption limits (Never expires / Expires on ·
 * No limit / Limit to) · Usage rules · Content (product type). Wat de vouchers-tabel niet kent is zichtbaar maar uitgeschakeld met reden
 * (wacht op de betaalbeslissing); "Free access duration (days)" is het voucher-eigen veld.
 */
export default function NewCouponForm() {
  const [state, formAction, pending] = useActionState(createVoucherAction, { error: null, createdCodes: null } as CreateVoucherState);
  const [expires, setExpires] = useState<'never' | 'expires_on'>('never');
  const [limit, setLimit] = useState<'no_limit' | 'limit_to'>('no_limit');

  return (
    <form action={formAction} className="mx-auto max-w-[1120px]" data-new-coupon>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[20px] font-semibold leading-7">New coupon</h1>
        <div className="flex items-center gap-3">
          {state.error && <p className="text-[13px] font-medium" style={{ color: 'var(--ad-destructive)' }} data-form-error>{state.error}</p>}
          {state.createdCodes && <p className="text-[13px] font-medium" style={{ color: 'var(--ad-primary)' }} data-form-saved>Saved: {state.createdCodes.join(', ')} · <Link href="/admin/marketing/coupons" className="underline">Back to coupons</Link></p>}
          <button type="submit" disabled={pending || !!state.createdCodes} className="ad-btn ad-btn-primary">{pending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <div className="grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="flex flex-col gap-6">
          <section className="ad-card p-6" data-card="Coupon details">
            <h2 className="mb-4 text-[16px] font-semibold">Coupon details</h2>
            <label className="ad-label" htmlFor="code">Code</label>
            <input id="code" name="code" placeholder="ENTER COUPON CODE" className="ad-input uppercase" pattern="[A-Za-z0-9][A-Za-z0-9-]{2,30}[A-Za-z0-9]" title="4–32 characters: A–Z, 0–9, -" />
            <p className="ad-help mb-4">This code cannot be changed after saving. Leave empty to generate a code.</p>
            <p className="ad-label">Discount</p>
            <div className="mb-1 flex items-center gap-2">
              <span className="ad-btn ad-btn-outline !h-8" aria-disabled="true" title="Alleen 100 % (vouchers = gratis toegang)">Percentage</span>
              <span className="ad-btn ad-btn-ghost !h-8" aria-disabled="true" title="Vast bedrag — wacht op de betaalbeslissing" style={{ color: 'var(--ad-muted-fg)' }}>Fixed</span>
              <input value="100" readOnly aria-label="Percentage" className="ad-input !w-24" /> <span>%</span>
            </div>
            <p className="ad-help mb-4">Vouchers geven 100 % off (gratis toegang); een ander percentage of vast bedrag wacht op de betaalbeslissing.</p>
            <label className="ad-label" htmlFor="durationDays">Free access duration (days)</label>
            <input id="durationDays" name="durationDays" type="number" min={1} max={3650} defaultValue={365} className="ad-input mb-4 !w-40" />
            <label className="ad-label" htmlFor="sponsorLabel">Coupon description</label>
            <textarea id="sponsorLabel" name="sponsorLabel" rows={3} placeholder="Enter description here" className="ad-textarea" />
            <p className="ad-help">Only visible to admins. Helps you keep track of the purpose of this coupon (e.g. the sponsor).</p>
          </section>
          <section className="ad-card p-6" data-card="Redemption limits">
            <h2 className="mb-1 text-[16px] font-semibold">Redemption limits</h2>
            <p className="ad-help mb-4">Set when this coupon expires and how many times it can be redeemed.</p>
            <div className="mb-4 flex flex-col gap-2" data-expires>
              <label className="flex items-center gap-2"><input type="radio" name="expires" value="never" checked={expires === 'never'} onChange={() => setExpires('never')} />Never expires</label>
              <label className="flex items-center gap-2"><input type="radio" name="expires" value="expires_on" checked={expires === 'expires_on'} onChange={() => setExpires('expires_on')} />Expires on</label>
              {expires === 'expires_on' && <input type="date" name="expiresAt" aria-label="Expires on" className="ad-input !w-48" required />}
            </div>
            <div className="flex flex-col gap-2" data-limit>
              <label className="flex items-center gap-2"><input type="radio" name="limit" value="no_limit" checked={limit === 'no_limit'} onChange={() => setLimit('no_limit')} />No limit</label>
              <label className="flex items-center gap-2"><input type="radio" name="limit" value="limit_to" checked={limit === 'limit_to'} onChange={() => setLimit('limit_to')} />Limit to</label>
              {limit === 'limit_to' && <input type="number" name="maxRedemptions" min={1} max={9999} defaultValue={1} aria-label="Limit to" className="ad-input !w-40" />}
            </div>
            <h3 className="mb-1 mt-6 text-[14px] font-semibold">Usage rules</h3>
            <p className="ad-help mb-2">Configure how this coupon can be used by customers.</p>
            {['Allow multiple uses per user', 'Allow for plan changes', 'Personalize codes when sent in emails'].map((r) => (
              <label key={r} className="flex items-center gap-2" style={{ color: 'var(--ad-muted-fg)' }}><input type="checkbox" disabled title="Wacht op de betaalbeslissing" />{r}</label>
            ))}
            <p className="ad-help mt-1">Usage rules: wacht op de betaalbeslissing (één inwisseling per persoon is de huidige regel van redeem_voucher).</p>
          </section>
        </div>
        <section className="ad-card p-6" data-card="Content">
          <h2 className="mb-1 text-[16px] font-semibold">Content</h2>
          <p className="ad-help mb-3">Select the product types this coupon can be used for</p>
          {[['All products', 'Apply this coupon to all product types.'], ['Subscription', 'Apply this coupon to subscription plans.'], ['Bundle', 'Apply this coupon to bundles.'], ['Content', 'Apply this coupon to individual content purchases.']].map(([t, d]) => (
            <label key={t} className="mb-2 flex items-start gap-2" style={{ color: t === 'Subscription' ? 'var(--ad-fg)' : 'var(--ad-muted-fg)' }}>
              <input type="radio" name="product" value={t} checked={t === 'Subscription'} readOnly disabled={t !== 'Subscription'} className="mt-1" />
              <span>{t}<span className="ad-help block">{d}</span></span>
            </label>
          ))}
          <p className="ad-help">Alleen Subscription (gratis toegang); bundles/content wachten op de betaalbeslissing (bundles buiten scope, B81).</p>
          <label className="ad-label mt-4" htmlFor="count">How many codes (batch, only without a custom code)</label>
          <input id="count" name="count" type="number" min={1} max={500} defaultValue={1} className="ad-input !w-32" />
          <p className="ad-help">Met een eigen code is het altijd 1 coupon (anders een foutmelding).</p>
        </section>
      </div>
    </form>
  );
}
