'use client';

import { useActionState } from 'react';
import { createVoucherAction, type CreateVoucherState } from './actions';

const initial: CreateVoucherState = { error: null, createdCodes: null };

export default function CreateVoucherForm() {
  const [state, formAction, pending] = useActionState(createVoucherAction, initial);

  return (
    <div className="rounded-2xl bg-white border border-black/10 p-6">
      <h2 className="font-bold text-ink mb-4">Mint vouchers</h2>
      <form action={formAction} className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-ink-secondary mb-1">Duration (days)</label>
          <input name="durationDays" type="number" min={1} max={3650} defaultValue={365}
            className="w-full px-3 py-2.5 rounded-xl border border-black/15 text-[14px]" />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-ink-secondary mb-1">How many codes</label>
          <input name="count" type="number" min={1} max={500} defaultValue={1}
            className="w-full px-3 py-2.5 rounded-xl border border-black/15 text-[14px]" />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-ink-secondary mb-1">
            Max redemptions <span className="font-normal text-ink-muted">(per code — 1 unless it's a shared code)</span>
          </label>
          <input name="maxRedemptions" type="number" min={1} max={10000} defaultValue={1}
            className="w-full px-3 py-2.5 rounded-xl border border-black/15 text-[14px]" />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-ink-secondary mb-1">Expires <span className="font-normal text-ink-muted">(optional)</span></label>
          <input name="expiresAt" type="date" className="w-full px-3 py-2.5 rounded-xl border border-black/15 text-[14px]" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[12px] font-semibold text-ink-secondary mb-1">Sponsor label <span className="font-normal text-ink-muted">(optional — e.g. the masjid that funded this batch)</span></label>
          <input name="sponsorLabel" className="w-full px-3 py-2.5 rounded-xl border border-black/15 text-[14px]" />
        </div>

        {state.error && <p className="sm:col-span-2 text-[13px] text-red-600 font-medium">{state.error}</p>}
        {state.createdCodes && (
          <div className="sm:col-span-2 p-4 rounded-xl bg-brand-soft">
            <p className="text-[12px] font-semibold text-brand-dark mb-2">{state.createdCodes.length} code(s) created:</p>
            <div className="flex flex-wrap gap-2">
              {state.createdCodes.map((c) => (
                <code key={c} className="px-2 py-1 rounded-md bg-white text-[13px] font-mono">{c}</code>
              ))}
            </div>
          </div>
        )}

        <div className="sm:col-span-2">
          <button type="submit" disabled={pending}
            className="px-6 py-2.5 rounded-full bg-brand hover:bg-brand-light disabled:opacity-60 transition text-white font-semibold text-[14px]">
            {pending ? 'Minting…' : 'Mint vouchers'}
          </button>
        </div>
      </form>
    </div>
  );
}
