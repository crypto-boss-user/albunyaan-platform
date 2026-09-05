import Link from 'next/link';

/** Friendly locked screen — shown instead of any program content. */
export default function LockedScreen({ profileName, title }: { profileName: string; title: string }) {
  return (
    <div className="max-w-xl mx-auto px-5 py-28 text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-brand-soft grid place-items-center text-brand mb-6">
        <svg width="34" height="34" viewBox="0 0 12 12" aria-hidden>
          <path d="M3 5V3.5a3 3 0 016 0V5h.5A1.5 1.5 0 0111 6.5v3A1.5 1.5 0 019.5 11h-7A1.5 1.5 0 011 9.5v-3A1.5 1.5 0 012.5 5H3zm1.5 0h3V3.5a1.5 1.5 0 00-3 0V5z" fill="currentColor" />
        </svg>
      </div>
      <p className="section-label">Parental controls</p>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 mb-3">
        This one isn&rsquo;t for you right now, {profileName}
      </h1>
      <p className="text-[15px] text-ink-secondary leading-relaxed">
        <strong>{title}</strong>
        {' has been set aside by your parent. There’s plenty more to explore — pick something else in sha’ Allah!'}
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link href="/catalog" className="px-6 py-3 rounded-full bg-brand hover:bg-brand-light transition text-white font-semibold text-[14px]">
          Back to the catalog
        </Link>
        <Link href="/profiles" className="px-6 py-3 rounded-full bg-brand-muted text-brand-dark hover:bg-brand-soft transition font-semibold text-[14px]">
          Switch profile
        </Link>
      </div>
    </div>
  );
}
