'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  DEMO_PARENT_PIN,
  canWatch,
  profiles,
  series,
  videos,
  watchHistory,
} from '@albunyaan/core';
import AgeBadge from '../../components/AgeBadge';
import { useOverrides } from '../../lib/store';

export default function ParentsPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const { overrides, removeOverride, hydrated } = useOverrides();

  const kids = profiles.filter((p) => p.kind === 'kid');

  if (!unlocked) {
    return (
      <div className="pt-[72px] max-w-md mx-auto px-5 py-24">
        <p className="section-label">Parent dashboard</p>
        <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-2">Enter your PIN</h1>
        <p className="text-[14px] text-ink-secondary mb-6">
          Controls for every child profile live behind this PIN. (Demo PIN: 1234)
        </p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''));
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && pin.length === 4) {
              if (pin === DEMO_PARENT_PIN) setUnlocked(true);
              else {
                setError(true);
                setPin('');
              }
            }
          }}
          aria-label="Parent PIN"
          className="w-40 text-center text-3xl tracking-[0.5em] border-2 border-brand-muted focus:border-brand rounded-xl px-3 py-3 outline-none"
          autoFocus
        />
        {error && <p className="text-[13px] text-red-700 mt-3">Wrong PIN, try again.</p>}
        <button
          onClick={() => (pin === DEMO_PARENT_PIN ? setUnlocked(true) : (setError(true), setPin('')))}
          disabled={pin.length !== 4}
          className="block mt-6 px-6 py-3 rounded-full bg-brand text-white font-semibold text-[14px] disabled:opacity-40"
        >
          Unlock dashboard
        </button>
      </div>
    );
  }

  if (!hydrated) return <div className="pt-[72px] max-w-4xl mx-auto px-5 py-24 text-ink-muted">Loading…</div>;

  return (
    <div className="pt-[72px] max-w-5xl mx-auto px-5 sm:px-8 py-16">
      <p className="section-label">Parent dashboard</p>
      <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-10">Your children</h1>

      <div className="space-y-10">
        {kids.map((kid) => {
          const kidOverrides = overrides.filter((o) => o.profileId === kid.id);
          const history = watchHistory.filter((h) => h.profileId === kid.id);
          const visibleCount = videos.filter((v) => canWatch(kid, v, overrides)).length;

          return (
            <section key={kid.id} className="card-elevated rounded-2xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <span
                  aria-hidden
                  className="w-12 h-12 rounded-full grid place-items-center text-xl font-extrabold text-white"
                  style={{ backgroundColor: `hsl(${kid.avatarHue} 45% 35%)` }}
                >
                  {kid.name[0]}
                </span>
                <div>
                  <h2 className="font-bold text-lg">{kid.name}</h2>
                  <p className="text-[13px] text-ink-muted">
                    Age band {kid.ageBand} · sees {visibleCount} of {videos.length} videos
                    {kid.dailyLimitMinutes ? ` · ${kid.dailyLimitMinutes} min/day limit` : ' · no time limit'}
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-8">
                {/* Overrides */}
                <div>
                  <p className="section-label mb-3">Blocks &amp; exceptions</p>
                  {kidOverrides.length === 0 && (
                    <p className="text-[13px] text-ink-muted">
                      None yet — block any video with one tap from its watch page.
                    </p>
                  )}
                  <ul className="space-y-2">
                    {kidOverrides.map((o) => {
                      const title =
                        o.target.kind === 'video'
                          ? videos.find((v) => v.id === o.target.id)?.title
                          : `${series.find((s) => s.id === o.target.id)?.title} (whole series)`;
                      return (
                        <li
                          key={`${o.target.kind}-${o.target.id}`}
                          className="flex items-center justify-between gap-3 text-[13px] bg-surface-warm rounded-xl px-4 py-2.5"
                        >
                          <span>
                            <strong className={o.action === 'block' ? 'text-red-800' : 'text-brand-dark'}>
                              {o.action === 'block' ? 'Blocked' : 'Allowed'}
                            </strong>{' '}
                            — {title ?? 'Unknown title'}
                          </span>
                          <button
                            onClick={() => removeOverride({ profileId: o.profileId, target: o.target })}
                            className="text-[12px] font-semibold text-ink-muted hover:text-ink"
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Watch history */}
                <div>
                  <p className="section-label mb-3">Recent watch history</p>
                  {history.length === 0 && <p className="text-[13px] text-ink-muted">Nothing watched yet.</p>}
                  <ul className="space-y-2">
                    {history.map((h) => {
                      const v = videos.find((x) => x.id === h.videoId);
                      if (!v) return null;
                      return (
                        <li key={`${h.videoId}-${h.watchedAt}`} className="flex items-center justify-between gap-3 text-[13px] bg-surface-warm rounded-xl px-4 py-2.5">
                          <span className="flex items-center gap-2">
                            <AgeBadge rating={v.ageRating} />
                            {v.title}
                          </span>
                          <span className="text-ink-muted whitespace-nowrap">
                            {Math.round(h.progressSeconds / 60)} min
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-[13px] text-ink-muted">
        This is the v0 demo (local data only). The real version syncs to every device and applies
        to offline downloads too. Blocking works from any video page —{' '}
        <Link href="/catalog" className="text-brand font-semibold">try it in the catalog</Link>.
      </p>
    </div>
  );
}
