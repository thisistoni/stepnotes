/**
 * Collections (playlists of dances): the data shape and its pure rules, with no React or storage,
 * so the same code validates what is stored, what comes back from the cloud, and can be tested
 * in node. The store around it is `collections.tsx`.
 */

/** A named list of dances, in the order the user sees them. */
export interface Collection {
  id: string;
  /** 1–40 characters, trimmed */
  name: string;
  /** unique; may point to dances that are not on this device (yet): those are simply not shown */
  danceIds: string[];
  createdAt: number;
  updatedAt: number;
}

/** What a collection stores in the cloud backup (`id` and `updatedAt` live on the row itself). */
export interface CollectionData {
  name: string;
  danceIds: string[];
  createdAt: number;
}

export const COLLECTION_NAME_MAX = 40;
/** More than any library can hold (the cloud allows 3000 items); guards against junk data */
const MAX_DANCE_IDS = 5000;
/** the same rule dance ids follow (`safeId` in validate.ts) */
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

/** Trim, collapse inner whitespace and cut to 40 characters (whole characters, emoji included). */
export function cleanCollectionName(name: string): string {
  const flat = name.replace(/\s+/g, ' ').trim();
  return Array.from(flat).slice(0, COLLECTION_NAME_MAX).join('').trim();
}

const isId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);
const time = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

/** Unique, valid ids in their first order; reports whether anything had to be dropped. */
function cleanIds(raw: unknown, dropped: () => void): string[] {
  if (!Array.isArray(raw)) {
    dropped();
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (!isId(v) || seen.has(v)) {
      dropped();
      continue;
    }
    if (out.length >= MAX_DANCE_IDS) {
      dropped();
      break;
    }
    seen.add(v);
    out.push(v);
  }
  return out;
}

/**
 * Turn untrusted data (storage, cloud) into a valid Collection, or null when it cannot be
 * repaired (no usable id or name). Small problems are repaired (`dropped()` is called).
 */
export function parseCollection(raw: unknown, dropped: () => void = () => {}): Collection | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!isId(o.id) || typeof o.name !== 'string') return null;
  const name = cleanCollectionName(o.name);
  if (!name) return null;
  if (name !== o.name) dropped();
  const danceIds = cleanIds(o.danceIds, dropped);
  const updatedAt = time(o.updatedAt);
  const createdAt = time(o.createdAt) ?? updatedAt ?? 0;
  if (updatedAt === null || time(o.createdAt) === null) dropped();
  return { id: o.id, name, danceIds, createdAt, updatedAt: updatedAt ?? createdAt };
}

/** Stored list → valid list (unique ids, unreadable entries dropped). Never throws. */
export function sanitizeCollections(raw: unknown, dropped: () => void): Collection[] {
  if (!Array.isArray(raw)) {
    dropped();
    return [];
  }
  const out: Collection[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    const c = parseCollection(item, dropped);
    if (!c || ids.has(c.id)) {
      dropped();
      continue;
    }
    ids.add(c.id);
    out.push(c);
  }
  return out;
}

export const toCloudData = (c: Collection): CollectionData => ({ name: c.name, danceIds: c.danceIds, createdAt: c.createdAt });

/** A cloud row back into a Collection (null = unreadable: skip it). */
export const fromCloudData = (id: string, updatedAt: number, data: unknown): Collection | null => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const c = parseCollection({ ...(data as object), id, updatedAt });
  return c && { ...c, updatedAt };
};

/**
 * Merge remote collections into the local list (last writer wins per collection, the same rule
 * as the database): a local collection that is newer stays. New ones are placed by creation
 * time (the chip row shows oldest first). Returns the next list (the same array if nothing
 * changed) and the ids it could not read.
 */
export function applyRemoteCollections(
  cur: Collection[],
  upserts: { id: string; updatedAt: number; data: unknown }[],
  deletedIds: string[],
): [Collection[], string[]] {
  const skipped: string[] = [];
  let next = cur;
  const edit = () => (next === cur ? (next = [...cur]) : next);
  for (const u of upserts) {
    const c = fromCloudData(u.id, u.updatedAt, u.data);
    if (!c) {
      skipped.push(u.id);
      continue;
    }
    const i = next.findIndex((x) => x.id === c.id);
    if (i >= 0) {
      if (next[i].updatedAt > c.updatedAt) continue; // edited here meanwhile: keep ours
      edit()[i] = c;
    } else {
      const at = next.findIndex((x) => x.createdAt > c.createdAt);
      edit().splice(at < 0 ? next.length : at, 0, c);
    }
  }
  if (deletedIds.length) {
    const gone = new Set(deletedIds);
    if (next.some((c) => gone.has(c.id))) next = next.filter((c) => !gone.has(c.id));
  }
  return [next, skipped];
}

/** The collection's dances that exist here, in the collection's order. */
export function presentDances<D extends { id: string }>(c: Collection, byId: Map<string, D>): D[] {
  const out: D[] = [];
  for (const id of c.danceIds) {
    const d = byId.get(id);
    if (d) out.push(d);
  }
  return out;
}
