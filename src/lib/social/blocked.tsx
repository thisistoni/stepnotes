/**
 * People blocked on this device (`waltzy.blocked.v1`: `{ id, name, at }[]`). A blocked person's
 * shared links and classes show "You blocked <name>" with Unblock instead of their content, and
 * their classes are left out of "My classes". Nothing goes to the cloud (no account needed).
 *
 *   const { blocked, isBlocked, block, unblock } = useBlocked();
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import type { Author } from '../cloud/api';
import { usePersistedValue } from '../persist';

export const BLOCKED_KEY = 'waltzy.blocked.v1';

export interface BlockedPerson {
  id: string;
  name: string;
  /** when it was blocked (ms) */
  at: number;
}

interface Blocked {
  ready: boolean;
  /** newest first */
  blocked: BlockedPerson[];
  isBlocked: (userId: string | null | undefined) => boolean;
  block: (person: Author) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
}

const Ctx = createContext<Blocked | null>(null);
const EMPTY: BlockedPerson[] = [];

function sanitize(raw: unknown, dropped: () => void): BlockedPerson[] {
  if (!Array.isArray(raw)) {
    dropped();
    return [];
  }
  const out: BlockedPerson[] = [];
  for (const r of raw) {
    const v = r as Partial<BlockedPerson> | null;
    if (v && typeof v.id === 'string' && v.id && !out.some((o) => o.id === v.id)) {
      out.push({ id: v.id, name: typeof v.name === 'string' ? v.name.slice(0, 40) : '', at: typeof v.at === 'number' ? v.at : 0 });
    } else dropped();
  }
  return out;
}

export function BlockedProvider({ children }: { children: ReactNode }) {
  const { value, ready, update } = usePersistedValue<BlockedPerson[]>(BLOCKED_KEY, EMPTY, sanitize);
  const block = useCallback(
    (p: Author) =>
      update((cur) => [[{ id: p.id, name: p.name.trim(), at: Date.now() }, ...cur.filter((c) => c.id !== p.id)], undefined]),
    [update],
  );
  const unblock = useCallback((id: string) => update((cur) => [cur.some((c) => c.id === id) ? cur.filter((c) => c.id !== id) : cur, undefined]), [update]);
  const api = useMemo<Blocked>(() => {
    const ids = new Set(value.map((b) => b.id));
    return { ready, blocked: value, isBlocked: (id) => !!id && ids.has(id), block, unblock };
  }, [value, ready, block, unblock]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useBlocked(): Blocked {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBlocked must be used inside <BlockedProvider>');
  return ctx;
}
