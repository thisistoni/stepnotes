import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import { BUILT_IN_IDS, builtInDances } from './builtins';
import type { RemoteChanges } from './cloud/sync';
import { useT, type Strings } from './i18n';
import { emitRemoved, emitRestored } from './libraryEvents';
import { DEFAULT_START, uid } from './pattern';
import { usePersistedValue } from './persist';
import type { Dance } from './types';
import { parseDance, parseDanceJson } from './validate';

/** Keep this key: existing installs (and the web QA harness) store user dances under it. */
export const STORAGE_KEY = 'waltzy.dances.v1';
/** Where dances were stored while the app was called StepNotes */
const LEGACY_STORAGE_KEY = 'stepnotes.dances.v1';

export interface DanceStore {
  /** false until the user's dances have been read from storage */
  ready: boolean;
  /** user dances (newest first) followed by the built-in starter dances (in the app's language) */
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
  /** Copy any dance (built-in or not) into "My dances". Default name: "<name> (my version)", localised. */
  duplicate: (dance: Dance, name?: string) => Promise<Dance>;
  /** Parse pasted text and add it. Throws `DanceValidationError` with a user-facing message. */
  importJson: (json: string) => Promise<Dance>;
  /**
   * Write changes from the cloud backup (the sync engine calls this). Remote data is validated;
   * an unreadable dance is skipped (its id is returned), a local dance that is newer is kept.
   */
  applyRemote: (changes: RemoteChanges) => Promise<string[]>;
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
  const { value: custom, ready, update } = usePersistedValue<Dance[]>(STORAGE_KEY, EMPTY, sanitizeStored, { legacyKey: LEGACY_STORAGE_KEY });
  const t = useT();
  /** latest dictionary for the actions (stable callbacks, current language) */
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
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
    async (id: string) => {
      const removed = await update<Dance | null>((cur) => {
        const index = cur.findIndex((c) => c.id === id);
        if (index < 0) return [cur, null];
        removedAt.current.set(id, index);
        return [cur.filter((c) => c.id !== id), cur[index]];
      });
      // the user deleted it: the cloud backup deletes it too (unless Undo comes first)
      if (removed) emitRemoved('dance', id);
      return removed;
    },
    [update],
  );

  const restore = useCallback(
    async (dance: Dance) => {
      const restored = await update((cur) => {
        if (cur.some((c) => c.id === dance.id)) return [cur, false];
        const at = Math.min(removedAt.current.get(dance.id) ?? 0, cur.length);
        removedAt.current.delete(dance.id);
        const next = [...cur];
        next.splice(at, 0, dance);
        return [next, true];
      });
      if (restored) emitRestored('dance', dance.id);
    },
    [update],
  );

  const duplicate = useCallback(
    (dance: Dance, name?: string) =>
      update((cur) => {
        const now = Date.now();
        const copy: Dance = {
          ...parseDance(dance), // deep copy + fresh id
          name: name?.trim() || tRef.current.common.myVersion(dance.name.trim() || tRef.current.common.untitled),
          createdAt: now,
          updatedAt: now,
        };
        return [[copy, ...cur], copy];
      }),
    [update],
  );

  const importJson = useCallback(
    async (json: string) => {
      const parsed = parseDanceJson(json, { untitled: tRef.current.common.untitled }); // throws a DanceValidationError
      // credit only comes from a saved link or class, never from pasted text (it could be made up)
      delete parsed.source;
      return update((cur) => {
        const now = Date.now();
        const d: Dance = { ...parsed, createdAt: now, updatedAt: now };
        return [[d, ...cur], d];
      });
    },
    [update],
  );

  const applyRemote = useCallback(
    ({ upserts, deletedIds }: RemoteChanges) =>
      update<string[]>((cur) => {
        const skipped: string[] = [];
        let next = cur;
        const edit = () => (next === cur ? (next = [...cur]) : next);
        for (const u of upserts) {
          let d: Dance;
          try {
            d = parseDance(u.data, { keepId: true, untitled: tRef.current.common.untitled });
          } catch (e) {
            console.warn('Skipping an unreadable dance from the cloud:', e instanceof Error ? e.message : e);
            skipped.push(u.id);
            continue;
          }
          if (d.id !== u.id || BUILT_IN_IDS.has(d.id)) {
            skipped.push(u.id);
            continue;
          }
          d.updatedAt = u.updatedAt;
          const i = next.findIndex((c) => c.id === d.id);
          if (i >= 0) {
            if (next[i].updatedAt > d.updatedAt) continue; // edited here meanwhile: keep ours
            edit()[i] = d;
          } else {
            // newest first, by creation
            const at = next.findIndex((c) => c.createdAt < d.createdAt);
            edit().splice(at < 0 ? next.length : at, 0, d);
          }
        }
        if (deletedIds.length) {
          const gone = new Set(deletedIds);
          if (next.some((c) => gone.has(c.id))) next = next.filter((c) => !gone.has(c.id));
        }
        return [next, skipped];
      }),
    [update],
  );

  const value = useMemo<DanceStore>(() => {
    const dances = [...custom, ...builtInDances(t)];
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
      applyRemote,
    };
  }, [custom, t, ready, save, remove, restore, duplicate, importJson, applyRemote]);

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

/**
 * Strip internal fields before sharing as text: `builtIn`, and `source` (credit is only set by
 * saving from a link or class; pasted text never carries it, see `importJson`).
 */
export function exportJson(d: Dance) {
  const { builtIn: _b, source: _s, ...rest } = d;
  return JSON.stringify({ app: 'waltzy', version: 1, ...rest }, null, 2);
}

/** The text a share sends: one friendly line, then the dance (import ignores the text around it). */
export function shareText(d: Dance, t: Strings) {
  return `${t.share.prefix}\n\n${exportJson(d)}`;
}
