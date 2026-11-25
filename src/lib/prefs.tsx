/**
 * User preferences, persisted in AsyncStorage (own key, validated on load, serialised writes).
 *
 *   const { ready, prefs, set } = usePrefs();
 *   prefs.speed        // last used tempo multiplier (0.25–2, default 0.75)
 *   set({ loop: false })   // merge a patch; resolves when persisted
 *   prefs.language     // 'de' | 'en' once the user picked one, null = follow the device (see '@/lib/i18n')
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import { isLanguage, type Language } from './i18n/languages';
import { usePersistedValue } from './persist';
import type { Role } from './types';

export const PREFS_KEY = 'waltzy.prefs.v1';
/** Where the settings were stored while the app was called StepNotes */
const LEGACY_PREFS_KEY = 'stepnotes.prefs.v1';

export interface Prefs {
  onboardingDone: boolean;
  /** Role shown first in the player and editor */
  preferredRole: Role;
  /** Last used tempo multiplier (1 = the dance's own bpm) */
  speed: number;
  loop: boolean;
  /** Vibrate on every step (native only) */
  haptics: boolean;
  speakCounts: boolean;
  /** Show L / R on the footprints */
  showLetters: boolean;
  /** App language the user picked; null = the device language (`DEFAULT_LANGUAGE`) */
  language: Language | null;
}

export const DEFAULT_PREFS: Prefs = {
  onboardingDone: false,
  preferredRole: 'leader',
  speed: 0.75,
  loop: true,
  haptics: true,
  speakCounts: false,
  showLetters: true,
  language: null,
};

export const SPEED_RANGE = [0.25, 2] as const;

const BOOL_KEYS = ['onboardingDone', 'loop', 'haptics', 'speakCounts', 'showLetters'] as const;

/** Validate a stored/patched prefs object; unknown keys and bad values fall back to defaults. */
export function sanitizePrefs(raw: unknown, base: Prefs = DEFAULT_PREFS): Prefs {
  const out: Prefs = { ...base };
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  for (const k of BOOL_KEYS) if (typeof r[k] === 'boolean') out[k] = r[k] as boolean;
  if (r.preferredRole === 'leader' || r.preferredRole === 'follower') out.preferredRole = r.preferredRole;
  if (isLanguage(r.language)) out.language = r.language;
  if (typeof r.speed === 'number' && Number.isFinite(r.speed)) {
    out.speed = Math.min(SPEED_RANGE[1], Math.max(SPEED_RANGE[0], r.speed));
  }
  return out;
}

const sanitizeStored = (raw: unknown) => sanitizePrefs(raw);

interface PrefsStore {
  /** false until stored prefs were read; `prefs` holds the defaults until then */
  ready: boolean;
  prefs: Prefs;
  set: (patch: Partial<Prefs>) => Promise<void>;
}

const Ctx = createContext<PrefsStore | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { value: prefs, ready, update } = usePersistedValue<Prefs>(PREFS_KEY, DEFAULT_PREFS, sanitizeStored, { optimistic: true, legacyKey: LEGACY_PREFS_KEY });

  const set = useCallback(
    (patch: Partial<Prefs>) =>
      update((cur) => {
        const next = sanitizePrefs(patch, cur);
        const changed = (Object.keys(next) as (keyof Prefs)[]).some((k) => next[k] !== cur[k]);
        return [changed ? next : cur, undefined];
      }),
    [update],
  );

  const value = useMemo(() => ({ ready, prefs, set }), [ready, prefs, set]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePrefs must be used inside <PrefsProvider>');
  return ctx;
}
