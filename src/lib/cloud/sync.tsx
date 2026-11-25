/**
 * Library backup: local-first sync between this device and the account's cloud library.
 *
 * AsyncStorage stays the source of truth for the UI; the cloud is a backup that merges between
 * devices, last writer wins per item (`updatedAt`, client ms). The decision itself is the pure
 * `mergeLibrary` (merge.ts); this file decides WHEN to run it and does the I/O.
 *
 * Register a kind of library item (dances are wired in `DanceSync.tsx`; collections work the same):
 *
 *   function CollectionSync() {
 *     const { collections, ready, applyRemote } = useCollections();
 *     const items = useMemo(() => collections.map((c) => ({ id: c.id, updatedAt: c.updatedAt, data: c })), [collections]);
 *     useSyncSource({ kind: 'collection', items, apply: applyRemote, ready });
 *     return null;
 *   }
 *   // mount <CollectionSync /> next to <DanceSync /> in src/app/_layout.tsx
 *
 * - `items`: every local item of that kind, `{ id, updatedAt, data }` (data = what goes to the cloud).
 * - `apply({ upserts, deletedIds })`: write remote changes into the local store. `upserts[i].data`
 *   is untrusted: validate it, skip what is unreadable and resolve with the skipped ids. Only
 *   replace a local item whose `updatedAt` is older (the user may have edited meanwhile).
 * - Deletions: the store calls `emitRemoved(kind, id)` / `emitRestored(kind, id)` from
 *   '@/lib/libraryEvents' in its remove / undo. Nothing else ever deletes a cloud copy.
 * - `ready`: false until the store has loaded (an empty list before loading is not "no items").
 *
 * When: after sign-in, on start when signed in, when the app comes to the foreground / the
 * browser comes online, 3 s after a local change, and on `syncNow()`. Errors back off
 * (5 s, 15 s, 1 min, 5 min).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { onLibraryEvent } from '../libraryEvents';
import { CloudError, type LibraryKind, type LibraryPush } from './api';
import { useAuth } from './auth';
import { cloud } from './index';
import { emptyMemory, forget, mergeLibrary, type KindMemory, type LocalItem } from './merge';
import { readSyncMemory, updateSyncMemory, type SyncMemory } from './syncMemory';

export type { LocalItem } from './merge';
export type SyncStatus = 'off' | 'idle' | 'syncing' | 'error';

export interface RemoteChanges {
  upserts: LocalItem[];
  deletedIds: string[];
}
/** Resolves with the ids it could not store (unreadable remote data). */
export type ApplyRemote = (changes: RemoteChanges) => Promise<string[] | void>;

export interface SyncState {
  status: SyncStatus;
  /** when the last sync finished (ms), null if never */
  lastSyncedAt: number | null;
  /** the last error while `status` is 'error' (show `cloudErrorText(error, t)`) */
  error: CloudError | null;
  /** Sync right away (resolves when done; never rejects). */
  syncNow: () => Promise<void>;
}

interface Source {
  getItems: () => LocalItem[];
  apply: ApplyRemote;
}

interface Engine extends SyncState {
  register: (kind: LibraryKind, source: Source) => () => void;
  changed: (kind: LibraryKind, signature: string) => void;
}

const Ctx = createContext<Engine | null>(null);

/** Pull again from a few seconds before the newest row we saw (clock skew, slow commits). */
const OVERLAP_MS = 5000;
const DEBOUNCE_MS = 3000;
const BACKOFF_S = [5, 15, 60, 300];

const signatureOf = (items: LocalItem[]) =>
  items
    .map((i) => `${i.id}:${i.updatedAt}`)
    .sort()
    .join('|');

function overlapCursor(serverTs: string): string {
  const ms = Date.parse(serverTs);
  return Number.isFinite(ms) ? new Date(ms - OVERLAP_MS).toISOString() : serverTs;
}

/**
 * Put the engine's result on top of the CURRENT memory: tombstones / bumps that events added or
 * removed while the sync ran stay as they are; only those the merge resolved are dropped.
 */
function rebase(before: KindMemory, result: KindMemory, current: KindMemory | undefined): KindMemory {
  const cur = current ?? emptyMemory();
  const keep = (field: 'tombstones' | 'bumps') => {
    const out = { ...cur[field] };
    for (const [id, v] of Object.entries(before[field])) if (!(id in result[field]) && out[id] === v) delete out[id];
    return out;
  };
  return { synced: result.synced, tombstones: keep('tombstones'), bumps: keep('bumps') };
}

/** One sync run against the cloud. Throws a CloudError. */
async function syncOnce(userId: string, sources: Map<LibraryKind, Source>) {
  let mem: SyncMemory = await updateSyncMemory((m) => {
    if (m.userId === userId) return [m, m];
    // another account (or the first sign-in on this device): start over, but keep this device's
    // deletions: the local library is merged into this account
    const kinds: SyncMemory['kinds'] = {};
    for (const [k, km] of Object.entries(m.kinds) as [LibraryKind, KindMemory][]) kinds[k] = { ...emptyMemory(), tombstones: km.tombstones };
    const next: SyncMemory = { userId, cursor: null, lastSyncedAt: null, kinds };
    return [next, next];
  });

  for (let round = 0; round < 2; round++) {
    const kinds = [...sources.keys()];
    const full = !mem.cursor || kinds.some((k) => !mem.kinds[k]);
    const rows = await cloud.pullLibrary(full ? null : mem.cursor);

    const pushes: LibraryPush[] = [];
    const pending: { kind: LibraryKind; before: KindMemory; afterPush: KindMemory }[] = [];
    let missing = false;
    for (const kind of kinds) {
      const source = sources.get(kind);
      if (!source) continue;
      const before = mem.kinds[kind] ?? emptyMemory();
      const r = mergeLibrary({ local: source.getItems(), remote: rows.filter((row) => row.kind === kind), memory: before, fullPull: full });
      let skipped: string[] = [];
      if (r.upserts.length || r.deletedIds.length) skipped = (await source.apply({ upserts: r.upserts, deletedIds: r.deletedIds })) || [];
      const afterApply = forget(r.afterApply, skipped);
      mem = await updateSyncMemory((m) => {
        const next = { ...m, kinds: { ...m.kinds, [kind]: rebase(before, afterApply, m.kinds[kind]) } };
        return [next, next];
      });
      pushes.push(...r.push.map((p) => ({ kind, ...p })));
      pending.push({ kind, before, afterPush: forget(r.afterPush, skipped) });
      if (r.missing.length) missing = true;
    }

    const last = rows[rows.length - 1];
    const cursor = last ? overlapCursor(last.serverUpdatedAt) : full ? null : mem.cursor;
    await cloud.pushLibrary(pushes);
    mem = await updateSyncMemory((m) => {
      const kindsNext = { ...m.kinds };
      for (const p of pending) kindsNext[p.kind] = rebase(p.before, p.afterPush, m.kinds[p.kind]);
      const next: SyncMemory = { ...m, kinds: kindsNext, cursor, lastSyncedAt: Date.now() };
      return [next, next];
    });
    if (!missing || full) return mem;
    // something we had is gone locally (corrupt or cleared store): pull everything once more
    mem = await updateSyncMemory((m) => {
      const next = { ...m, cursor: null };
      return [next, next];
    });
  }
  return mem;
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const userId = user?.id ?? null;
  const userRef = useRef<string | null>(userId);
  const sources = useRef(new Map<LibraryKind, Source>());
  const signatures = useRef(new Map<LibraryKind, string>());
  // what the last run reported, for which account (a different / no account reads as fresh)
  const [state, setState] = useState<{ userId: string | null; status: SyncStatus; error: CloudError | null; lastSyncedAt: number | null }>({
    userId: null,
    status: 'idle',
    error: null,
    lastSyncedAt: null,
  });
  const current = state.userId === userId && userId !== null;
  const status: SyncStatus = !userId ? 'off' : current ? state.status : 'idle';
  const error = current ? state.error : null;
  const lastSyncedAt = current ? state.lastSyncedAt : null;
  const runRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const run = useCallback((): Promise<void> => {
    if (running.current) {
      again.current = true;
      return running.current;
    }
    const uid = userRef.current;
    if (!uid || sources.current.size === 0) return Promise.resolve();
    clearTimer();
    setState((st) => ({ ...(st.userId === uid ? st : { error: null, lastSyncedAt: null }), userId: uid, status: 'syncing' }));
    const p = (async () => {
      try {
        const mem = await syncOnce(uid, sources.current);
        if (userRef.current !== uid) return;
        for (const [kind, s] of sources.current) signatures.current.set(kind, signatureOf(s.getItems()));
        failures.current = 0;
        setState({ userId: uid, status: 'idle', error: null, lastSyncedAt: mem.lastSyncedAt });
      } catch (e) {
        if (userRef.current !== uid) return;
        const err = e instanceof CloudError ? e : new CloudError('unknown', e instanceof Error ? e.message : String(e));
        console.warn('Sync failed:', err.message);
        setState((st) => ({ ...st, userId: uid, status: 'error', error: err }));
        if (err.reason !== 'notSignedIn') {
          const delay = BACKOFF_S[Math.min(failures.current, BACKOFF_S.length - 1)] * 1000;
          failures.current += 1;
          clearTimer();
          timer.current = setTimeout(() => void runRef.current(), delay);
        }
      } finally {
        running.current = null;
        if (again.current) {
          again.current = false;
          void runRef.current();
        }
      }
    })();
    running.current = p;
    return p;
  }, []);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  /** Sync soon (debounced), unless an error backoff is already waiting. */
  const schedule = useCallback(
    (ms = DEBOUNCE_MS) => {
      if (!userRef.current) return;
      if (timer.current && failures.current > 0) return;
      clearTimer();
      timer.current = setTimeout(() => void run(), ms);
    },
    [run],
  );

  // sign-in, sign-out, app start
  useEffect(() => {
    userRef.current = userId;
    clearTimer();
    failures.current = 0;
    if (!ready || !userId) return;
    readSyncMemory().then((m) => {
      if (m.userId === userId && userRef.current === userId) {
        setState((st) => (st.userId === userId ? st : { userId, status: 'idle', error: null, lastSyncedAt: m.lastSyncedAt }));
      }
    });
    void run();
  }, [ready, userId, run]);

  // foreground / back online
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') schedule(0);
    });
    const online = () => schedule(0);
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('online', online);
    return () => {
      sub.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('online', online);
    };
  }, [schedule]);

  // explicit deletions and undos → tombstones (only once this device has ever been signed in)
  useEffect(
    () =>
      onLibraryEvent((e) => {
        void updateSyncMemory((m) => {
          if (!m.userId) return [m, undefined];
          const km = { ...emptyMemory(), ...m.kinds[e.kind] };
          if (e.type === 'removed') km.tombstones = { ...km.tombstones, [e.id]: e.at };
          else if (e.id in km.tombstones) {
            // Undo before the deletion was synced: forget it
            const { [e.id]: _gone, ...rest } = km.tombstones;
            km.tombstones = rest;
          } else {
            // Undo after the deletion reached the cloud: the restored copy has to be newer
            km.bumps = { ...km.bumps, [e.id]: e.at };
          }
          return [{ ...m, kinds: { ...m.kinds, [e.kind]: km } }, undefined];
        }).then(() => schedule());
      }),
    [schedule],
  );

  useEffect(() => () => clearTimer(), []);

  const register = useCallback(
    (kind: LibraryKind, source: Source) => {
      sources.current.set(kind, source);
      schedule(0);
      return () => {
        if (sources.current.get(kind) === source) sources.current.delete(kind);
      };
    },
    [schedule],
  );

  const changed = useCallback(
    (kind: LibraryKind, signature: string) => {
      const prev = signatures.current.get(kind);
      if (prev === signature) return;
      signatures.current.set(kind, signature);
      // the first signature is just the loaded library (registering already scheduled a sync)
      if (prev !== undefined) schedule();
    },
    [schedule],
  );

  const syncNow = useCallback(async () => {
    failures.current = 0;
    clearTimer();
    await run();
    // a run that was already going: wait for the follow-up as well
    if (running.current) await running.current;
  }, [run]);

  const value = useMemo<Engine>(
    () => ({ status, lastSyncedAt, error, syncNow, register, changed }),
    [status, lastSyncedAt, error, syncNow, register, changed],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useEngine() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}

/** Backup status for the Me screen. */
export function useSync(): SyncState {
  const { status, lastSyncedAt, error, syncNow } = useEngine();
  return { status, lastSyncedAt, error, syncNow };
}

/** Register a kind of library item with the sync engine (see the example at the top of this file). */
export function useSyncSource({ kind, items, apply, ready = true }: { kind: LibraryKind; items: LocalItem[]; apply: ApplyRemote; ready?: boolean }) {
  const { register, changed } = useEngine();
  const latest = useRef({ items, apply });
  useEffect(() => {
    latest.current = { items, apply };
  }, [items, apply]);
  useEffect(() => {
    if (!ready) return;
    return register(kind, { getItems: () => latest.current.items, apply: (c) => latest.current.apply(c) });
  }, [kind, ready, register]);
  const signature = useMemo(() => signatureOf(items), [items]);
  useEffect(() => {
    if (ready) changed(kind, signature);
  }, [kind, ready, signature, changed]);
}
