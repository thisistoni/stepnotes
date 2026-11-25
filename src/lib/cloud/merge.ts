/**
 * The sync decision, as a pure function (no React, no storage, no network): given what this
 * device has, what the cloud sent and what we remember, decide what to write locally and what to
 * push. Last writer wins per item on `updatedAt` (client ms), the same rule the database applies.
 *
 * Deletions are never inferred from an item missing locally: only a tombstone (recorded when the
 * user deleted the item on this device) deletes the cloud copy. An item we know was in the cloud
 * but is missing locally without a tombstone is reported in `missing` (the caller re-pulls
 * everything so it comes back).
 *
 * Pure on purpose, so it can be tested in node: new device, the same item edited on two devices,
 * delete vs. edit, delete + Undo before / after sync, first sign-in with local items, replayed rows,
 * an older remote row, a wiped local store, unreadable remote items.
 */
import type { LibraryItem } from './api';

/** One item as the local store has it. */
export interface LocalItem {
  id: string;
  updatedAt: number;
  data: unknown;
}

/** What the engine remembers per kind (persisted). All values are `updatedAt` ms. */
export interface KindMemory {
  /** id → updatedAt of the version both sides agree on (only for items that exist) */
  synced: Record<string, number>;
  /** id → when it was deleted on this device; pushed as a deletion, cancelled by Undo */
  tombstones: Record<string, number>;
  /**
   * id → a newer `updatedAt` to send for an item that was restored (Undo) after its deletion had
   * already reached the cloud: the restored copy must beat the deletion. Kept until the cloud
   * sends the row back.
   */
  bumps: Record<string, number>;
}

export const emptyMemory = (): KindMemory => ({ synced: {}, tombstones: {}, bumps: {} });

export interface PushItem {
  id: string;
  updatedAt: number;
  data: unknown | null;
  deleted: boolean;
}

export interface MergeResult {
  /** remote items to write into the local store (still untrusted data: validate before storing) */
  upserts: LocalItem[];
  /** local items the cloud deleted */
  deletedIds: string[];
  /** local changes the cloud does not have yet */
  push: PushItem[];
  /** memory once `upserts` / `deletedIds` are applied */
  afterApply: KindMemory;
  /** memory once `push` succeeded as well */
  afterPush: KindMemory;
  /** items we expected locally but cannot find (no tombstone): pull everything again */
  missing: string[];
}

export interface MergeInput {
  local: LocalItem[];
  /** rows of this kind from `pullLibrary` (may contain repeats from the cursor overlap) */
  remote: Pick<LibraryItem, 'id' | 'updatedAt' | 'data' | 'deleted'>[];
  memory: KindMemory;
  /** the pull started from the beginning (no cursor): absent remote rows really are absent */
  fullPull: boolean;
}

export function mergeLibrary({ local, remote, memory, fullPull }: MergeInput): MergeResult {
  const localById = new Map(local.map((l) => [l.id, l]));
  // newest row per id (the overlap can repeat a row)
  const remoteById = new Map<string, MergeInput['remote'][number]>();
  for (const r of remote) {
    const prev = remoteById.get(r.id);
    if (!prev || r.updatedAt > prev.updatedAt) remoteById.set(r.id, r);
  }
  const synced = { ...memory.synced };
  const tombstones = { ...memory.tombstones };
  const bumps = { ...memory.bumps };
  const out: Omit<MergeResult, 'afterApply' | 'afterPush'> = { upserts: [], deletedIds: [], push: [], missing: [] };

  const ids = new Set([...localById.keys(), ...remoteById.keys(), ...Object.keys(tombstones), ...Object.keys(bumps), ...Object.keys(synced)]);
  for (const id of ids) {
    const L = localById.get(id);
    const R = remoteById.get(id);
    const S = synced[id];
    const T = tombstones[id];

    // this device's version of the item
    let mine: PushItem | null = L ? { id, updatedAt: Math.max(L.updatedAt, bumps[id] ?? 0), data: L.data, deleted: false } : null;
    if (T !== undefined) {
      if (!mine || T >= mine.updatedAt) mine = { id, updatedAt: T, data: null, deleted: true };
      else delete tombstones[id]; // stale: the item was edited or restored after it
    }
    if (!L) delete bumps[id];

    if (R) {
      if (!mine || R.updatedAt > mine.updatedAt) {
        // the cloud is newer
        if (R.deleted) {
          if (L) out.deletedIds.push(id);
          delete synced[id];
        } else {
          out.upserts.push({ id, updatedAt: R.updatedAt, data: R.data });
          synced[id] = R.updatedAt;
        }
        delete tombstones[id];
        delete bumps[id];
      } else if (R.updatedAt === mine.updatedAt) {
        // in sync (often our own push coming back)
        if (mine.deleted) {
          delete synced[id];
          delete tombstones[id];
        } else {
          // a restored item's bump came back: store the cloud's updatedAt locally too
          if (L && L.updatedAt !== R.updatedAt && !R.deleted) out.upserts.push({ id, updatedAt: R.updatedAt, data: L.data });
          synced[id] = R.updatedAt;
          delete bumps[id];
        }
      } else {
        out.push.push(mine);
      }
      continue;
    }

    // the cloud sent nothing for this id
    if (!mine) {
      if (S !== undefined) {
        if (fullPull) delete synced[id]; // not in the cloud either: forget it
        else out.missing.push(id);
      }
      continue;
    }
    if (S === undefined || mine.updatedAt > S) out.push.push(mine);
    else if (mine.updatedAt < S) out.missing.push(id); // the cloud has a newer copy we never got
  }

  const afterApply: KindMemory = { synced, tombstones, bumps };
  const afterPush: KindMemory = { synced: { ...synced }, tombstones: { ...tombstones }, bumps: { ...bumps } };
  for (const p of out.push) {
    if (p.deleted) {
      delete afterPush.synced[p.id];
      delete afterPush.tombstones[p.id];
    } else {
      afterPush.synced[p.id] = p.updatedAt;
    }
  }
  return { ...out, afterApply, afterPush };
}

/** Drop ids the local store refused (unreadable remote items) from what we think is synced. */
export function forget(memory: KindMemory, ids: string[]): KindMemory {
  if (!ids.length) return memory;
  const synced = { ...memory.synced };
  for (const id of ids) delete synced[id];
  return { ...memory, synced };
}
