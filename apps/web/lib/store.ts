'use client';

/**
 * v0 client-side state: active profile + parental overrides, persisted in localStorage.
 * Stands in for Supabase-backed household state (Phase 3). Seeded from the mock catalog.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  overrides as seedOverrides,
  profiles,
  type ContentOverride,
  type Profile,
} from '@albunyaan/core';

const PROFILE_KEY = 'albunyaan.activeProfileId';
const OVERRIDES_KEY = 'albunyaan.overrides';

function readOverrides(): ContentOverride[] {
  if (typeof window === 'undefined') return seedOverrides;
  const raw = window.localStorage.getItem(OVERRIDES_KEY);
  if (!raw) return seedOverrides;
  try {
    return JSON.parse(raw) as ContentOverride[];
  } catch {
    return seedOverrides;
  }
}

export function useActiveProfile(): {
  profile: Profile;
  allProfiles: Profile[];
  switchTo: (id: string) => void;
  hydrated: boolean;
} {
  const [id, setId] = useState<string>(profiles[0].id);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(PROFILE_KEY);
    if (stored && profiles.some((p) => p.id === stored)) setId(stored);
    setHydrated(true);
  }, []);

  const switchTo = useCallback((next: string) => {
    setId(next);
    window.localStorage.setItem(PROFILE_KEY, next);
  }, []);

  const profile = profiles.find((p) => p.id === id) ?? profiles[0];
  return { profile, allProfiles: profiles, switchTo, hydrated };
}

export function useOverrides(): {
  overrides: ContentOverride[];
  setOverride: (o: ContentOverride) => void;
  removeOverride: (o: Pick<ContentOverride, 'profileId' | 'target'>) => void;
  hydrated: boolean;
} {
  const [list, setList] = useState<ContentOverride[]>(seedOverrides);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setList(readOverrides());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: ContentOverride[]) => {
    setList(next);
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(next));
  }, []);

  const setOverride = useCallback(
    (o: ContentOverride) => {
      const next = [
        ...readOverrides().filter(
          (e) =>
            !(
              e.profileId === o.profileId &&
              e.target.kind === o.target.kind &&
              e.target.id === o.target.id
            ),
        ),
        o,
      ];
      persist(next);
    },
    [persist],
  );

  const removeOverride = useCallback(
    (o: Pick<ContentOverride, 'profileId' | 'target'>) => {
      const next = readOverrides().filter(
        (e) =>
          !(
            e.profileId === o.profileId &&
            e.target.kind === o.target.kind &&
            e.target.id === o.target.id
          ),
      );
      persist(next);
    },
    [persist],
  );

  return { overrides: list, setOverride, removeOverride, hydrated };
}
