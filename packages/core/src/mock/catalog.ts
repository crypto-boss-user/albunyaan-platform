/**
 * v0 mock catalog — stands in for the real ~6,700-item Uscreen export (Phase 1/6).
 * Thumbnails are placeholder gradient hues (no imagery → trivially manhaj-safe).
 */
import type { Category, ContentOverride, Profile, Series, Video, WatchEvent } from '../types';

export const categories: Category[] = [
  { id: 'cat-kids', name: 'Kids & Family', slug: 'kids-family' },
  { id: 'cat-arabic', name: 'Learn Arabic', slug: 'learn-arabic' },
  { id: 'cat-quran', name: "Qur'an & Tajweed", slug: 'quran-tajweed' },
  { id: 'cat-aqeedah', name: 'Aqeedah', slug: 'aqeedah' },
  { id: 'cat-seerah', name: 'Seerah & History', slug: 'seerah-history' },
  { id: 'cat-lectures', name: 'Scholar Lectures', slug: 'scholar-lectures' },
];

export const series: Series[] = [
  {
    id: 'ser-makarim',
    title: 'Makarim — Arabic for Kids',
    slug: 'makarim-arabic-for-kids',
    shortDescription: 'Beloved animated Arabic-immersion series for young children.',
    thumbnailHue: 95,
    ageRating: 'all',
    categoryIds: ['cat-kids', 'cat-arabic'],
  },
  {
    id: 'ser-tajweed',
    title: 'Tajweed Foundations',
    slug: 'tajweed-foundations',
    shortDescription: 'Step-by-step tajweed rules with clear recitation examples.',
    thumbnailHue: 150,
    ageRating: '7+',
    categoryIds: ['cat-quran'],
  },
  {
    id: 'ser-usool',
    title: 'Usool ath-Thalaatha Explained',
    slug: 'usool-ath-thalaatha',
    shortDescription: 'The three fundamental principles, explained lesson by lesson.',
    thumbnailHue: 210,
    ageRating: '13+',
    categoryIds: ['cat-aqeedah', 'cat-lectures'],
  },
];

const makarimEpisodes: Video[] = Array.from({ length: 6 }, (_, i) => ({
  id: `vid-makarim-${i + 1}`,
  externalId: null,
  title: `Makarim — Episode ${i + 1}`,
  slug: `makarim-episode-${i + 1}`,
  shortDescription: `Arabic words and manners for little ones — episode ${i + 1}.`,
  thumbnailHue: 90 + i * 6,
  durationSeconds: 720 + i * 30,
  ageRating: 'all',
  status: 'published',
  access: 'subscription',
  categoryIds: ['cat-kids', 'cat-arabic'],
  seriesId: 'ser-makarim',
  episodeNumber: i + 1,
}));

const tajweedEpisodes: Video[] = Array.from({ length: 4 }, (_, i) => ({
  id: `vid-tajweed-${i + 1}`,
  externalId: null,
  title: `Tajweed Foundations — Lesson ${i + 1}`,
  slug: `tajweed-foundations-lesson-${i + 1}`,
  shortDescription: `Tajweed rule set ${i + 1} with guided practice.`,
  thumbnailHue: 148 + i * 5,
  durationSeconds: 1500 + i * 120,
  ageRating: '7+',
  status: 'published',
  access: 'subscription',
  categoryIds: ['cat-quran'],
  seriesId: 'ser-tajweed',
  episodeNumber: i + 1,
}));

const usoolEpisodes: Video[] = Array.from({ length: 4 }, (_, i) => ({
  id: `vid-usool-${i + 1}`,
  externalId: null,
  title: `Usool ath-Thalaatha — Lesson ${i + 1}`,
  slug: `usool-ath-thalaatha-lesson-${i + 1}`,
  shortDescription: `Principle-by-principle explanation, lesson ${i + 1}.`,
  thumbnailHue: 208 + i * 4,
  durationSeconds: 2400 + i * 180,
  ageRating: '13+',
  status: 'published',
  access: 'subscription',
  categoryIds: ['cat-aqeedah', 'cat-lectures'],
  seriesId: 'ser-usool',
  episodeNumber: i + 1,
}));

const standalone: Video[] = [
  {
    id: 'vid-wudu',
    externalId: null,
    title: 'How to Make Wudu — for Kids',
    slug: 'how-to-make-wudu-for-kids',
    shortDescription: 'A gentle step-by-step wudu guide for young children.',
    thumbnailHue: 70,
    durationSeconds: 480,
    ageRating: 'all',
    status: 'published',
    access: 'free',
    categoryIds: ['cat-kids'],
    seriesId: null,
    episodeNumber: null,
  },
  {
    id: 'vid-names',
    externalId: null,
    title: 'The Beautiful Names of Allah — Part 1',
    slug: 'beautiful-names-of-allah-part-1',
    shortDescription: 'Reflections on the names of Allah with authentic sources.',
    thumbnailHue: 170,
    durationSeconds: 2100,
    ageRating: '7+',
    status: 'published',
    access: 'subscription',
    categoryIds: ['cat-lectures'],
    seriesId: null,
    episodeNumber: null,
  },
  {
    id: 'vid-seerah-badr',
    externalId: null,
    title: 'Seerah: The Battle of Badr',
    slug: 'seerah-battle-of-badr',
    shortDescription: 'The events of Badr from authentic narrations.',
    thumbnailHue: 30,
    durationSeconds: 3300,
    ageRating: '13+',
    status: 'published',
    access: 'subscription',
    categoryIds: ['cat-seerah', 'cat-lectures'],
    seriesId: null,
    episodeNumber: null,
  },
  {
    id: 'vid-riba',
    externalId: null,
    title: 'The Fiqh of Riba — Detailed Lecture',
    slug: 'fiqh-of-riba-detailed',
    shortDescription: 'An in-depth treatment of riba for adult students of knowledge.',
    thumbnailHue: 260,
    durationSeconds: 4200,
    ageRating: '16+',
    status: 'published',
    access: 'subscription',
    categoryIds: ['cat-lectures'],
    seriesId: null,
    episodeNumber: null,
  },
];

export const videos: Video[] = [...makarimEpisodes, ...tajweedEpisodes, ...usoolEpisodes, ...standalone];

export const profiles: Profile[] = [
  { id: 'prof-parent', householdId: 'hh-1', kind: 'adult', name: 'Abu Yusuf', ageBand: null, avatarHue: 140, dailyLimitMinutes: null },
  { id: 'prof-yusuf', householdId: 'hh-1', kind: 'kid', name: 'Yusuf', ageBand: '7-9', avatarHue: 95, dailyLimitMinutes: 60 },
  { id: 'prof-maryam', householdId: 'hh-1', kind: 'kid', name: 'Maryam', ageBand: '4-6', avatarHue: 45, dailyLimitMinutes: 45 },
];

/** Demo overrides: Yusuf's parent blocked one within-band video and allowed one above-band series. */
export const overrides: ContentOverride[] = [
  { profileId: 'prof-yusuf', target: { kind: 'video', id: 'vid-names' }, action: 'block' },
  { profileId: 'prof-yusuf', target: { kind: 'series', id: 'ser-usool' }, action: 'allow' },
];

export const watchHistory: WatchEvent[] = [
  { profileId: 'prof-yusuf', videoId: 'vid-makarim-3', watchedAt: '2026-07-03T15:20:00Z', progressSeconds: 640 },
  { profileId: 'prof-yusuf', videoId: 'vid-tajweed-1', watchedAt: '2026-07-03T16:05:00Z', progressSeconds: 300 },
  { profileId: 'prof-maryam', videoId: 'vid-makarim-1', watchedAt: '2026-07-03T14:00:00Z', progressSeconds: 720 },
  { profileId: 'prof-maryam', videoId: 'vid-wudu', watchedAt: '2026-07-03T14:15:00Z', progressSeconds: 480 },
];

export const DEMO_PARENT_PIN = '1234';
