import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

import { BUILT_IN_DANCES } from './builtins';
import { DEFAULT_START, uid } from './pattern';
import { usePersistedValue } from './persist';
import type { Dance } from './types';
import { parseDance, parseDanceJson } from './validate';

/** Keep this key: existing installs (and the web QA harness) store user dances under it. */
export const STORAGE_KEY = 'stepnotes.dances.v1';

const BUILT_IN_IDS = new Set(BUILT_IN_DANCES.map((d) => d.id));

export interface DanceStore {
  /** false until the user's dances have been read from storage */
  ready: boolean;
  /** user dances (newest first) followed by the built-in starter dances */
  dances: Dance[];
  custom: Dance[];
  get: (id: string) => Dance | undefined;
  isBuiltIn: (id: string) => boolean;
  /**
   * Insert or replace a user dance. The dance is validated/normalised first; if its id belongs
   * to a built-in dance it gets a new id. Resolves with the dance as stored (use its `id`).
   */
  save: (dance: Dance) => Promise<Dance>;
  /** Delete a user dance. Resolves with the removed dance (for Undo), or null if it was not found. */
  remove: (id: string) => Promise<Dance | null>;
  /** Re-insert a dance removed with `remove`, at its old position in the list. */
  restore: (dance: Dance) => Promise<void>;
  /** Copy any dance (built-in or not) into "My dances". Default name: "<name> (my version)". */
  duplicate: (dance: Dance, name?: string) => Promise<Dance>;
  /** Parse pasted text and add it. Throws `DanceValidationError` with a user-facing message. */
  importJson: (json: string) => Promise<Dance>;
}

const Ctx = createContext<DanceStore | null>(null);

/** Sanitise what was stored: drop records that cannot be repaired instead of crashing. */
function sanitizeStored(raw: unknown, dropped: () => void): Dance[] {
  if (!Array.isArray(raw)) {
    console.warn('Stored dances are not a list; ignoring them.');
    dropped();
    return [];
  }
  const out: Dance[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    try {
      const d = parseDance(item, { keepId: true });
      if (ids.has(d.id) || BUILT_IN_IDS.has(d.id)) d.id = uid('dance');
      ids.add(d.id);
      out.push(d);
    } catch (e) {
      console.warn('Dropping an unreadable stored dance:', e instanceof Error ? e.message : e);
      dropped();
    }
  }
  return out;
}

const EMPTY: Dance[] = [];

export function DanceProvider({ children }: { children: ReactNode }) {
  const { value: custom, ready, update } = usePersistedValue<Dance[]>(STORAGE_KEY, EMPTY, sanitizeStored);
  /** old positions of deleted dances, for restore() */
  const removedAt = useRef(new Map<string, number>());

  const save = useCallback(
    (dance: Dance) =>
      update((cur) => {
        const d: Dance = { ...parseDance(dance, { keepId: true }), createdAt: dance.createdAt || Date.now(), updatedAt: Date.now() };
        if (BUILT_IN_IDS.has(d.id) || BUILT_IN_IDS.has(dance.id)) d.id = uid('dance');
        const exists = cur.some((c) => c.id === d.id);
        return [exists ? cur.map((c) => (c.id === d.id ? d : c)) : [d, ...cur], d];
      }),
    [update],
  );

  const remove = useCallback(
    (id: string) =>
      update<Dance | null>((cur) => {
        const index = cur.findIndex((c) => c.id === id);
        if (index < 0) return [cur, null];
        removedAt.current.set(id, index);
        return [cur.filter((c) => c.id !== id), cur[index]];
      }),
    [update],
  );

  const restore = useCallback(
    (dance: Dance) =>
      update((cur) => {
        if (cur.some((c) => c.id === dance.id)) return [cur, undefined];
        const at = Math.min(removedAt.current.get(dance.id) ?? 0, cur.length);
        removedAt.current.delete(dance.id);
        const next = [...cur];
        next.splice(at, 0, dance);
        return [next, undefined];
      }),
    [update],
  );

  const duplicate = useCallback(
    (dance: Dance, name?: string) =>
      update((cur) => {
        const now = Date.now();
        const copy: Dance = {
          ...parseDance(dance), // deep copy + fresh id
          name: name?.trim() || `${dance.name} (my version)`,
          createdAt: now,
          updatedAt: now,
        };
        return [[copy, ...cur], copy];
      }),
    [update],
  );

  const importJson = useCallback(
    async (json: string) => {
      const parsed = parseDanceJson(json); // throws a friendly DanceValidationError
      return update((cur) => {
        const now = Date.now();
        const d: Dance = { ...parsed, createdAt: now, updatedAt: now };
        return [[d, ...cur], d];
      });
    },
    [update],
  );

  const value = useMemo<DanceStore>(() => {
    const dances = [...custom, ...BUILT_IN_DANCES];
    const byId = new Map(dances.map((d) => [d.id, d]));
    return {
      ready,
      dances,
      custom,
      get: (id) => byId.get(id),
      isBuiltIn: (id) => BUILT_IN_IDS.has(id),
      save,
      remove,
      restore,
      duplicate,
      importJson,
    };
  }, [custom, ready, save, remove, restore, duplicate, importJson]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDances() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDances must be used inside <DanceProvider>');
  return ctx;
}

export function newDance(): Dance {
  return {
    id: uid('dance'),
    name: '',
    style: '',
    description: '',
    bpm: 120,
    beatsPerBar: 4,
    roles: { leader: { start: DEFAULT_START, steps: [] } },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Strip internal fields before sharing. */
export function exportJson(d: Dance) {
  const { builtIn: _b, ...rest } = d;
  return JSON.stringify({ app: 'stepnotes', version: 1, ...rest }, null, 2);
}
