import type { AgeRating } from '@albunyaan/core';

const styles: Record<AgeRating, string> = {
  all: 'bg-brand-soft text-brand-dark',
  '7+': 'bg-brand-muted text-brand-dark',
  '13+': 'bg-amber-100 text-amber-900',
  '16+': 'bg-orange-100 text-orange-900',
};

export default function AgeBadge({ rating }: { rating: AgeRating }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[rating]}`}>
      {rating === 'all' ? 'All ages' : rating}
    </span>
  );
}
