import type { AgeBand, AgeRating, ContentOverride, Profile, Video } from './types';

/** Highest age rating a band may watch without an explicit allow. */
const bandCeiling: Record<AgeBand, AgeRating> = {
  '4-6': 'all',
  '7-9': '7+',
  '10-12': '7+',
  '13+': '13+',
};

const ratingOrder: AgeRating[] = ['all', '7+', '13+', '16+'];

export function ratingWithinBand(rating: AgeRating, band: AgeBand): boolean {
  return ratingOrder.indexOf(rating) <= ratingOrder.indexOf(bandCeiling[band]);
}

/**
 * Visibility semantics (see docs/prd/feature-parental-controls.md):
 * 1. Adult profiles see everything published.
 * 2. An explicit BLOCK on the video or its series always wins.
 * 3. An explicit ALLOW on the video or its series overrides the age-band filter.
 * 4. Otherwise the video's age rating must fall within the kid's age band.
 */
export function canWatch(profile: Profile, video: Video, overrides: ContentOverride[]): boolean {
  if (profile.kind === 'adult') return true;
  const relevant = overrides.filter(
    (o) =>
      o.profileId === profile.id &&
      ((o.target.kind === 'video' && o.target.id === video.id) ||
        (o.target.kind === 'series' && video.seriesId !== null && o.target.id === video.seriesId)),
  );
  if (relevant.some((o) => o.action === 'block')) return false;
  if (relevant.some((o) => o.action === 'allow')) return true;
  return profile.ageBand !== null && ratingWithinBand(video.ageRating, profile.ageBand);
}
