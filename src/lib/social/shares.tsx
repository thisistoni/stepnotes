/**
 * The signed-in user's shared links ("My shared links"), cached on the device
 * (`waltzy.shares.v1`) so the share sheet shows an existing link at once, also offline.
 *
 *   const { shares, forDance, refresh, publish, unpublish, isOutdated } = useShares();
 *
 * - `shares`: null until known for this account (never fetched), else newest first.
 * - `publish(dance)` creates the dance's link or updates it with the current version.
 * - `isOutdated(dance, share)`: the dance was changed after the link was last updated.
 * Every action rejects with a `CloudError` (show `cloudErrorText(e, t)`).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import type { MyShare } from '../cloud/api';
import { useAuth } from '../cloud/auth';
import { cloud } from '../cloud';
import { usePersistedValue } from '../persist';
import type { Dance } from '../types';

export const SHARES_KEY = 'waltzy.shares.v1';

interface Stored {
  userId: string | null;
  shares: MyShare[] | null;
  /** the dance's `updatedAt` when its link was last published from this device, by share id */
  versions: Record<string, number>;
}

interface Shares {
  shares: MyShare[] | null;
  forDance: (danceId: string) => MyShare | undefined;
  /** Fetch the list again (resolves when done; rejects with a CloudError). */
  refresh: () => Promise<MyShare[]>;
  publish: (dance: Dance) => Promise<MyShare>;
  unpublish: (shareId: string) => Promise<void>;
  isOutdated: (dance: Dance, share: MyShare) => boolean;
}

const Ctx = createContext<Shares | null>(null);
const EMPTY: Stored = { userId: null, shares: null, versions: {} };

function sanitize(raw: unknown, dropped: () => void): Stored {
  const v = raw as Partial<Stored> | null;
  if (!v || typeof v !== 'object') {
    dropped();
    return EMPTY;
  }
  const shares = Array.isArray(v.shares)
    ? v.shares.filter((s): s is MyShare => !!s && typeof s.id === 'string' && typeof s.danceId === 'string')
    : null;
  return {
    userId: typeof v.userId === 'string' ? v.userId : null,
    shares,
    versions: v.versions && typeof v.versions === 'object' ? (v.versions as Record<string, number>) : {},
  };
}

/** What a link carries: the dance without device-only fields (the credit of a saved copy stays private). */
export function sharePayload(d: Dance) {
  const { builtIn: _b, source: _s, ...rest } = d;
  return rest;
}

export function SharesProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const userId = user?.id ?? null;
  const { value, ready, update } = usePersistedValue<Stored>(SHARES_KEY, EMPTY, sanitize);
  const userRef = useRef(userId);
  useEffect(() => {
    userRef.current = userId;
  }, [userId]);

  // another account (or none): forget the previous person's links
  useEffect(() => {
    if (!ready || !authReady || value.userId === userId) return;
    void update(() => [{ userId, shares: null, versions: {} }, undefined]).catch(() => {});
  }, [ready, authReady, userId, value.userId, update]);

  const setList = useCallback(
    (fn: (cur: MyShare[]) => MyShare[], versions?: (v: Record<string, number>) => Record<string, number>) =>
      update((cur) => {
        const uid = userRef.current;
        const base = cur.userId === uid ? cur : { userId: uid, shares: null, versions: {} };
        return [{ userId: uid, shares: fn(base.shares ?? []), versions: versions ? versions(base.versions) : base.versions }, undefined];
      }).catch(() => {}),
    [update],
  );

  const refresh = useCallback(async () => {
    const list = await cloud.listMyShares();
    const ids = new Set(list.map((s) => s.id));
    await setList(
      () => list,
      (v) => Object.fromEntries(Object.entries(v).filter(([k]) => ids.has(k))),
    );
    return list;
  }, [setList]);

  const publish = useCallback(
    async (dance: Dance) => {
      const name = dance.name.trim() || 'Untitled';
      const share = await cloud.publishShare(dance.id, name, sharePayload(dance));
      await setList(
        (cur) => [share, ...cur.filter((s) => s.id !== share.id && s.danceId !== share.danceId)],
        (v) => ({ ...v, [share.id]: dance.updatedAt }),
      );
      return share;
    },
    [setList],
  );

  const unpublish = useCallback(
    async (shareId: string) => {
      await cloud.unpublishShare(shareId);
      await setList(
        (cur) => cur.filter((s) => s.id !== shareId),
        (v) => {
          const { [shareId]: _gone, ...rest } = v;
          return rest;
        },
      );
    },
    [setList],
  );

  const api = useMemo<Shares>(() => {
    const shares = value.userId === userId && userId ? value.shares : null;
    return {
      shares,
      forDance: (danceId) => shares?.find((s) => s.danceId === danceId),
      refresh,
      publish,
      unpublish,
      isOutdated: (dance, share) => {
        const published = value.versions[share.id] ?? Date.parse(share.updatedAt);
        return Number.isFinite(published) && dance.updatedAt > published;
      },
    };
  }, [value, userId, refresh, publish, unpublish]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useShares(): Shares {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useShares must be used inside <SharesProvider>');
  return ctx;
}
