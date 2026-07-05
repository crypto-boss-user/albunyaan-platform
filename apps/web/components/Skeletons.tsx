/** Shimmer placeholders shown while server components fetch from Supabase. */

export function SkeletonCard() {
  return (
    <div className="w-[220px] sm:w-[250px] lg:w-[280px] shrink-0">
      <div className="aspect-video rounded-xl skeleton" />
      <div className="h-3.5 mt-2.5 rounded skeleton w-4/5" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <section>
      <div className="h-5 w-56 rounded skeleton mb-4" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </section>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-10">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="aspect-video rounded-xl skeleton" />
          <div className="h-3.5 mt-2.5 rounded skeleton w-4/5" />
        </div>
      ))}
    </div>
  );
}
