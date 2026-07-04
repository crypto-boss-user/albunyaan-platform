'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { canWatch, categories, videos } from '@albunyaan/core';
import VideoCard from '../../components/VideoCard';
import { useActiveProfile, useOverrides } from '../../lib/store';

function Catalog() {
  const params = useSearchParams();
  const [cat, setCat] = useState<string | null>(params.get('cat'));
  const { profile, hydrated: pHydrated } = useActiveProfile();
  const { overrides, hydrated: oHydrated } = useOverrides();

  if (!pHydrated || !oHydrated) return <p className="text-ink-muted">Loading…</p>;

  const inCategory = cat
    ? videos.filter((v) => v.categoryIds.some((id) => categories.find((c) => c.id === id)?.slug === cat))
    : videos;
  const visible = inCategory.filter((v) => canWatch(profile, v, overrides));
  const hiddenCount = inCategory.length - visible.length;

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Filter by category">
        <button
          onClick={() => setCat(null)}
          className={`px-4 py-2 rounded-full text-[13px] font-semibold transition ${cat === null ? 'bg-brand text-white' : 'bg-brand-muted text-brand-dark hover:bg-brand-soft'}`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.slug)}
            className={`px-4 py-2 rounded-full text-[13px] font-semibold transition ${cat === c.slug ? 'bg-brand text-white' : 'bg-brand-muted text-brand-dark hover:bg-brand-soft'}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {profile.kind === 'kid' && (
        <p className="mb-6 text-[13px] text-ink-secondary bg-brand-soft inline-block px-4 py-2 rounded-full">
          Showing {profile.name}&rsquo;s catalog (age {profile.ageBand})
          {hiddenCount > 0 && ` — ${hiddenCount} item${hiddenCount > 1 ? 's' : ''} filtered by parental settings`}
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
      {visible.length === 0 && (
        <p className="text-ink-muted">Nothing here for this profile — check parental settings.</p>
      )}
    </>
  );
}

export default function CatalogPage() {
  return (
    <div className="pt-[72px] max-w-6xl mx-auto px-5 sm:px-8 py-16">
      <p className="section-label">Library</p>
      <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-8">Catalog</h1>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Catalog />
      </Suspense>
    </div>
  );
}
