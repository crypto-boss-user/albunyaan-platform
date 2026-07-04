'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEMO_PARENT_PIN } from '@albunyaan/core';
import { useActiveProfile } from '../../lib/store';

export default function ProfilesPage() {
  const { profile, allProfiles, switchTo, hydrated } = useActiveProfile();
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const router = useRouter();

  if (!hydrated) return <div className="pt-[72px] max-w-4xl mx-auto px-5 py-24 text-ink-muted">Loading…</div>;

  // Kid-proof exit: switching FROM a kid profile TO an adult profile requires the parent PIN.
  const requestSwitch = (targetId: string) => {
    const target = allProfiles.find((p) => p.id === targetId)!;
    if (profile.kind === 'kid' && target.kind === 'adult') {
      setPinFor(targetId);
      setPin('');
      setError(false);
      return;
    }
    switchTo(targetId);
    router.push('/catalog');
  };

  const submitPin = () => {
    if (pin === DEMO_PARENT_PIN) {
      switchTo(pinFor!);
      setPinFor(null);
      router.push('/catalog');
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="pt-[72px] max-w-4xl mx-auto px-5 sm:px-8 py-16">
      <p className="section-label">Household</p>
      <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-10">Who&rsquo;s watching?</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
        {allProfiles.map((p) => (
          <button
            key={p.id}
            onClick={() => requestSwitch(p.id)}
            aria-pressed={p.id === profile.id}
            className={`card-elevated rounded-2xl p-6 text-center transition ${p.id === profile.id ? 'outline-2 outline-brand' : ''}`}
          >
            <span
              aria-hidden
              className="mx-auto mb-4 w-16 h-16 rounded-full grid place-items-center text-2xl font-extrabold text-white"
              style={{ backgroundColor: `hsl(${p.avatarHue} 45% 35%)` }}
            >
              {p.name[0]}
            </span>
            <p className="font-bold">{p.name}</p>
            <p className="text-[12px] text-ink-muted mt-1">
              {p.kind === 'kid' ? `Kids · ${p.ageBand}` : 'Adult'}
              {p.dailyLimitMinutes ? ` · ${p.dailyLimitMinutes} min/day` : ''}
            </p>
          </button>
        ))}
      </div>

      {pinFor && (
        <div className="mt-10 card-elevated rounded-2xl p-8 max-w-sm">
          <p className="font-bold mb-1">Parent PIN required</p>
          <p className="text-[13px] text-ink-secondary mb-4">
            Leaving a kids profile needs the parent PIN. (Demo PIN: 1234)
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && pin.length === 4 && submitPin()}
            aria-label="Parent PIN"
            className="w-32 text-center text-2xl tracking-[0.5em] border-2 border-brand-muted focus:border-brand rounded-xl px-3 py-2 outline-none"
            autoFocus
          />
          {error && <p className="text-[13px] text-red-700 mt-2">Wrong PIN, try again.</p>}
          <div className="mt-4 flex gap-3">
            <button
              onClick={submitPin}
              disabled={pin.length !== 4}
              className="px-5 py-2.5 rounded-full bg-brand text-white text-[13px] font-semibold disabled:opacity-40"
            >
              Unlock
            </button>
            <button onClick={() => setPinFor(null)} className="px-5 py-2.5 rounded-full bg-surface-warm text-[13px] font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
