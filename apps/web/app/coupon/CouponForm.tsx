'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { redeemCouponAction, type CouponFormState } from './actions';

const initial: CouponFormState = { status: 'idle', message: null };

export default function CouponForm() {
  const [state, formAction, pending] = useActionState(redeemCouponAction, initial);

  if (state.status === 'redeemed') {
    return (
      <div className="card-elevated rounded-2xl p-8 text-center" role="status">
        <div className="mx-auto w-14 h-14 rounded-full bg-brand-soft grid place-items-center text-brand mb-4">
          <svg width="24" height="24" viewBox="0 0 16 16" aria-hidden>
            <path d="M13.5 3.5L6 11 2.5 7.5l1-1L6 9l6.5-6.5z" fill="currentColor" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold tracking-tight mb-2">Code redeemed</h2>
        <p className="text-[14px] text-ink-secondary leading-relaxed mb-6">
          Your access has been activated. JazakAllahu khairan.
        </p>
        <Link
          href="/account"
          className="inline-flex px-6 py-3 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[14px]"
        >
          Go to your account
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="card-elevated rounded-2xl p-8 space-y-4">
      <div>
        <label htmlFor="coupon-code" className="block text-[13px] font-semibold text-ink-secondary mb-2">
          Voucher code
        </label>
        <input
          id="coupon-code"
          name="code"
          required
          placeholder="ABCDE-FGHJK"
          autoComplete="off"
          autoCapitalize="characters"
          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[15px] font-mono tracking-wide outline-none focus:border-brand"
        />
      </div>

      {state.status === 'error' && (
        <p className="text-[13px] text-red-700" role="alert">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full px-6 py-3 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[14px] disabled:opacity-40"
      >
        {pending ? 'Redeeming…' : 'Redeem code'}
      </button>
    </form>
  );
}
