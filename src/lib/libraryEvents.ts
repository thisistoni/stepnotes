/**
 * Explicit "the user deleted / restored this item" events. Stores call these from their
 * remove / restore (Undo); the sync engine turns them into tombstones, so a deletion reaches the
 * cloud only because the user asked for it, never because an item went missing.
 *
 *   emitRemoved('dance', id)     // in remove()
 *   emitRestored('dance', id)    // in restore() (Undo)
 */
import type { LibraryKind } from './cloud/api';

export type LibraryEvent = { type: 'removed' | 'restored'; kind: LibraryKind; id: string; at: number };
type Listener = (e: LibraryEvent) => void;

const listeners = new Set<Listener>();

export function onLibraryEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

const emit = (type: LibraryEvent['type'], kind: LibraryKind, id: string) => {
  const e: LibraryEvent = { type, kind, id, at: Date.now() };
  listeners.forEach((l) => l(e));
};

export const emitRemoved = (kind: LibraryKind, id: string) => emit('removed', kind, id);
export const emitRestored = (kind: LibraryKind, id: string) => emit('restored', kind, id);
