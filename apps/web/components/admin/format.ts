/** Weergavehulpjes in de Uscreen-vorm (AD 1.2): datum "September 2, 2026", duur "22:17" / "01:24:15", statusnaam. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function fmtClock(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** DB-status → exacte Uscreen-naam (founder 2026-09-06 (c)); `live` bestaat in Uscreen niet als videostatus en blijft eigen. */
export const STATUS_LABEL: Record<'draft' | 'published' | 'scheduled' | 'live', string> = {
  draft: 'Unpublished',
  published: 'Published',
  scheduled: 'Scheduled',
  live: 'Live',
};
export const STATUS_BADGE: Record<'draft' | 'published' | 'scheduled' | 'live', string> = {
  draft: 'ad-badge ad-badge-unpublished',
  published: 'ad-badge ad-badge-published',
  scheduled: 'ad-badge ad-badge-scheduled',
  live: 'ad-badge ad-badge-muted',
};
