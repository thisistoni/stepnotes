/**
 * What the sync engine remembers on this device, under `waltzy.sync.v1`: whose library it is,
 * the pull cursor, and per kind what was last synced, tombstones and bumps (see merge.ts).
 * Reads and writes run one after another (a promise queue), so events and sync runs never
 * overwrite each other.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LibraryKind } from './api';
import { emptyMemory, type KindMemory } from './merge';

export const SYNC_KEY = 'waltzy.sync.v1';

export interface SyncMemory {
  /** the account this memory belongs to (null = never signed in on this device) */
  userId: string | null;
  /** pull rows with server_updated_at > cursor (already moved back by the overlap) */
  cursor: string | null;
  /** when the last sync finished (ms) */
  lastSyncedAt: number | null;
  kinds: Partial<Record<LibraryKind, KindMemory>>;
}

const EMPTY: SyncMemory = { userId: null, cursor: null, lastSyncedAt: null, kinds: {} };

function sanitize(raw: unknown): SyncMemory {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY, kinds: {} };
  const r = raw as Partial<SyncMemory>;
  const kinds: SyncMemory['kinds'] = {};
  for (const k of ['dance', 'collection'] as LibraryKind[]) {
    const m = r.kinds?.[k];
    if (m && typeof m === 'object') kinds[k] = { ...emptyMemory(), ...m };
  }
  return {
    userId: typeof r.userId === 'string' ? r.userId : null,
    cursor: typeof r.cursor === 'string' ? r.cursor : null,
    lastSyncedAt: typeof r.lastSyncedAt === 'number' ? r.lastSyncedAt : null,
    kinds,
  };
}

let cache: SyncMemory | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<SyncMemory> {
  if (cache) return cache;
  try {
    cache = sanitize(JSON.parse((await AsyncStorage.getItem(SYNC_KEY)) ?? 'null'));
  } catch {
    cache = sanitize(null);
  }
  return cache;
}

/** Apply `fn` to the latest memory and persist the result (serialised). */
export function updateSyncMemory<R = void>(fn: (m: SyncMemory) => [SyncMemory, R]): Promise<R> {
  const run = async () => {
    const [next, result] = fn(await read());
    cache = next;
    await AsyncStorage.setItem(SYNC_KEY, JSON.stringify(next)).catch((e) => console.warn('Could not save the sync state', e));
    return result;
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

/** The latest memory (waits for pending writes, writes nothing). */
export function readSyncMemory(): Promise<SyncMemory> {
  const p = queue.then(read, read);
  queue = p.catch(() => {});
  return p;
}

/** Forget everything (account deleted). */
export const resetSyncMemory = () => updateSyncMemory(() => [{ ...EMPTY, kinds: {} }, undefined]);
