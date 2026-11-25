/**
 * Collections: named lists of dances ("Tuesday class", "Wedding dance"), like playlists. They live
 * on the device under `waltzy.collections.v1` and are backed up through the library sync as kind
 * 'collection' (see `cloud/CollectionSync.tsx`). No account needed.
 *
 *   const { collections, create, rename, remove, restore, addDances, removeDance } = useCollections();
 *
 * - A dance may be in several collections; starter dances can be in collections too.
 * - Ids of dances that are not on this device are kept (the dance may arrive from another device,
 *   or come back with Undo) and simply not shown: use `presentDances`.
 * - Every change bumps `updatedAt` (last writer wins between devices, per collection).
 * - Actions reject with a `PersistError` when the device could not save (show `errorText`).
 */
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

import type { RemoteChanges } from './cloud/sync';
import { applyRemoteCollections, cleanCollectionName, sanitizeCollections, type Collection } from './collectionModel';
import { emitRemoved, emitRestored } from './libraryEvents';
import { uid } from './pattern';
import { usePersistedValue } from './persist';

export { COLLECTION_NAME_MAX, cleanCollectionName, presentDances, type Collection } from './collectionModel';

export const COLLECTIONS_KEY = 'waltzy.collections.v1';

export interface CollectionsStore {
  /** false until the collections have been read from storage */
  ready: boolean;
  /** oldest first (the order of the chip row) */
  collections: Collection[];
  get: (id: string) => Collection | undefined;
  /** New collection at the end. The name is cleaned (trimmed, ≤ 40 chars); an empty name is refused. */
  create: (name: string, danceIds?: string[]) => Promise<Collection>;
  rename: (id: string, name: string) => Promise<void>;
  /** Delete a collection (never its dances). Resolves with it for Undo, or null if it was not found. */
  remove: (id: string) => Promise<Collection | null>;
  /** Put back a collection removed with `remove`, at its old place. */
  restore: (collection: Collection) => Promise<void>;
  /** Add dances that are not in it yet: at the end, or at `at` (Undo of `removeDance`). */
  addDances: (id: string, danceIds: string[], at?: number) => Promise<void>;
  /** Take a dance out (the dance itself stays). Resolves with its old position, for Undo. */
  removeDance: (id: string, danceId: string) => Promise<number>;
  /** Write changes from the cloud backup; resolves with the ids it could not read. */
  applyRemote: (changes: RemoteChanges) => Promise<string[]>;
}

const Ctx = createContext<CollectionsStore | null>(null);

/** A new `updatedAt`: strictly newer than before, even within the same millisecond (sync compares it). */
const bump = (c: Collection) => Math.max(Date.now(), c.updatedAt + 1);
const EMPTY: Collection[] = [];

export class EmptyNameError extends Error {
  constructor() {
    super('A collection needs a name');
  }
}

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const { value: collections, ready, update } = usePersistedValue<Collection[]>(COLLECTIONS_KEY, EMPTY, sanitizeCollections);
  /** old positions of deleted collections, for restore() */
  const removedAt = useRef(new Map<string, number>());

  /** Change one collection; a no-op change keeps the stored list (and `updatedAt`) as it is. */
  const change = useCallback(
    (id: string, fn: (c: Collection) => Collection | null) =>
      update((cur) => {
        const i = cur.findIndex((c) => c.id === id);
        if (i < 0) return [cur, undefined];
        const changed = fn(cur[i]);
        if (!changed) return [cur, undefined];
        const next = [...cur];
        next[i] = { ...changed, updatedAt: bump(cur[i]) };
        return [next, undefined];
      }),
    [update],
  );

  const create = useCallback(
    (name: string, danceIds: string[] = []) => {
      const clean = cleanCollectionName(name);
      if (!clean) return Promise.reject(new EmptyNameError());
      return update((cur) => {
        const now = Date.now();
        const c: Collection = { id: uid('col'), name: clean, danceIds: [...new Set(danceIds)], createdAt: now, updatedAt: now };
        return [[...cur, c], c];
      });
    },
    [update],
  );

  const rename = useCallback(
    (id: string, name: string) => {
      const clean = cleanCollectionName(name);
      if (!clean) return Promise.reject(new EmptyNameError());
      return change(id, (c) => (c.name === clean ? null : { ...c, name: clean }));
    },
    [change],
  );

  const addDances = useCallback(
    (id: string, danceIds: string[], at?: number) =>
      change(id, (c) => {
        const have = new Set(c.danceIds);
        const add = [...new Set(danceIds)].filter((d) => !have.has(d));
        if (!add.length) return null;
        const next = [...c.danceIds];
        next.splice(at === undefined || at < 0 ? next.length : Math.min(at, next.length), 0, ...add);
        return { ...c, danceIds: next };
      }),
    [change],
  );

  /** Resolves with the dance's old position (for Undo), or -1 if it was not in the collection. */
  const removeDance = useCallback(
    (id: string, danceId: string) =>
      update<number>((cur) => {
        const i = cur.findIndex((c) => c.id === id);
        const at = i < 0 ? -1 : cur[i].danceIds.indexOf(danceId);
        if (at < 0) return [cur, -1];
        const next = [...cur];
        next[i] = { ...cur[i], danceIds: cur[i].danceIds.filter((d) => d !== danceId), updatedAt: bump(cur[i]) };
        return [next, at];
      }),
    [update],
  );

  const remove = useCallback(
    async (id: string) => {
      const removed = await update<Collection | null>((cur) => {
        const index = cur.findIndex((c) => c.id === id);
        if (index < 0) return [cur, null];
        removedAt.current.set(id, index);
        return [cur.filter((c) => c.id !== id), cur[index]];
      });
      // the user deleted it: the backup deletes it too (unless Undo comes first)
      if (removed) emitRemoved('collection', id);
      return removed;
    },
    [update],
  );

  const restore = useCallback(
    async (collection: Collection) => {
      const restored = await update((cur) => {
        if (cur.some((c) => c.id === collection.id)) return [cur, false];
        const at = Math.min(removedAt.current.get(collection.id) ?? cur.length, cur.length);
        removedAt.current.delete(collection.id);
        const next = [...cur];
        next.splice(at, 0, collection);
        return [next, true];
      });
      if (restored) emitRestored('collection', collection.id);
    },
    [update],
  );

  const applyRemote = useCallback(
    ({ upserts, deletedIds }: RemoteChanges) => update<string[]>((cur) => applyRemoteCollections(cur, upserts, deletedIds)),
    [update],
  );

  const value = useMemo<CollectionsStore>(() => {
    const byId = new Map(collections.map((c) => [c.id, c]));
    return {
      ready,
      collections,
      get: (id) => byId.get(id),
      create,
      rename,
      remove,
      restore,
      addDances,
      removeDance,
      applyRemote,
    };
  }, [collections, ready, create, rename, remove, restore, addDances, removeDance, applyRemote]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCollections() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCollections must be used inside <CollectionsProvider>');
  return ctx;
}
