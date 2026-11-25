/**
 * "My classes": classes I teach and classes I joined, cached on the device so the Classes tab
 * works offline.
 *
 * - `waltzy.classes.v1`: `{ joined, pending, summaries, userId, syncedAt }`. `joined` are the codes
 *   joined on this device (as a guest or signed in), `pending` the ones joined as a guest and not
 *   yet joined in an account (they are joined right after the next sign-in), `summaries` the last
 *   list from `cloud.listClasses(joined)` (for `userId`, who was signed in then).
 * - `waltzy.classdetails.v1`: the last loaded page of up to 20 classes, for the class page offline.
 *
 *   const { classes, refresh, join, leave, isJoined, remember, forget, cachedDetail, cacheDetail } = useClasses();
 *
 * Classes of blocked teachers are left out of `classes`. Actions reject with a `CloudError`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CloudError, type ClassDetail, type ClassSummary } from '../cloud/api';
import { useAuth } from '../cloud/auth';
import { cloud } from '../cloud';
import { usePersistedValue } from '../persist';
import { useBlocked } from './blocked';
import { normalizeCode } from './links';

export const CLASSES_KEY = 'waltzy.classes.v1';
export const CLASS_DETAILS_KEY = 'waltzy.classdetails.v1';
const MAX_DETAILS = 20;

interface Stored {
  joined: string[];
  pending: string[];
  summaries: ClassSummary[];
  /** who was signed in when `summaries` was fetched (null = nobody) */
  userId: string | null;
  syncedAt: number | null;
}
type Details = Record<string, { detail: ClassDetail; at: number }>;

export type ClassesStatus = 'idle' | 'loading' | 'error';

interface Classes {
  ready: boolean;
  /** my classes, newest activity first, without blocked teachers */
  classes: ClassSummary[];
  status: ClassesStatus;
  error: CloudError | null;
  syncedAt: number | null;
  refresh: () => Promise<void>;
  isJoined: (code: string) => boolean;
  /** Join on this device; signed in also in the account. Rejects with `notFound` for an unknown code. */
  join: (code: string, known?: ClassSummary | ClassDetail) => Promise<void>;
  leave: (cls: Pick<ClassSummary, 'id' | 'code' | 'member'>) => Promise<void>;
  /** Put a class into the cached list (after creating or editing it). */
  remember: (summary: ClassSummary) => Promise<void>;
  /** Drop a class from the device (after deleting it). */
  forget: (code: string) => Promise<void>;
  /** the last loaded page of a class and when it was loaded (ms) */
  cachedDetail: (code: string) => { detail: ClassDetail; at: number } | undefined;
  cacheDetail: (detail: ClassDetail) => void;
}

const Ctx = createContext<Classes | null>(null);
const EMPTY: Stored = { joined: [], pending: [], summaries: [], userId: null, syncedAt: null };
const NO_DETAILS: Details = {};

const strings = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && !!x))] : []);

function sanitize(raw: unknown, dropped: () => void): Stored {
  const v = raw as Partial<Stored> | null;
  if (!v || typeof v !== 'object') {
    dropped();
    return EMPTY;
  }
  return {
    joined: strings(v.joined),
    pending: strings(v.pending),
    summaries: Array.isArray(v.summaries) ? v.summaries.filter((s): s is ClassSummary => !!s && typeof s.code === 'string' && typeof s.id === 'string') : [],
    userId: typeof v.userId === 'string' ? v.userId : null,
    syncedAt: typeof v.syncedAt === 'number' ? v.syncedAt : null,
  };
}
const sanitizeDetails = (raw: unknown): Details => (raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Details) : {});

export const summaryOf = (d: ClassDetail | ClassSummary): ClassSummary =>
  'posts' in d ? { ...stripPosts(d), postCount: d.posts.length } : d;
function stripPosts(d: ClassDetail): Omit<ClassDetail, 'posts'> {
  const { posts: _p, ...rest } = d;
  return rest;
}

const byActivity = (a: ClassSummary, b: ClassSummary) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);

export function ClassesProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const userId = user?.id ?? null;
  const { isBlocked } = useBlocked();
  const { value, ready, update } = usePersistedValue<Stored>(CLASSES_KEY, EMPTY, sanitize);
  const details = usePersistedValue<Details>(CLASS_DETAILS_KEY, NO_DETAILS, sanitizeDetails, { optimistic: true });
  const [status, setStatus] = useState<ClassesStatus>('idle');
  const [error, setError] = useState<CloudError | null>(null);
  const valueRef = useRef(value);
  const userRef = useRef(userId);
  useEffect(() => {
    valueRef.current = value;
    userRef.current = userId;
  });

  const refresh = useCallback(async () => {
    // nobody signed in and no class joined on this device: there is nothing to ask the cloud
    if (!userRef.current && !valueRef.current.joined.length) {
      if (valueRef.current.summaries.length) await update((cur) => [{ ...cur, summaries: [], userId: null }, undefined]).catch(() => {});
      setError(null);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    try {
      const uid = userRef.current;
      const asked = valueRef.current.joined;
      const list = await cloud.listClasses(asked);
      const found = new Set(list.map((c) => c.code));
      // a code we asked for that is not found any more: the class was deleted
      const gone = (c: string) => asked.includes(c) && !found.has(c);
      await update((cur) => [
        {
          ...cur,
          joined: cur.joined.filter((c) => !gone(c)),
          pending: cur.pending.filter((c) => !gone(c)),
          summaries: list,
          userId: uid,
          syncedAt: Date.now(),
        },
        undefined,
      ]);
      setError(null);
      setStatus('idle');
    } catch (e) {
      setError(e instanceof CloudError ? e : new CloudError('unknown'));
      setStatus('error');
    }
  }, [update]);

  // After sign-in: classes joined as a guest on this device are joined in the account too.
  // Then (and on any change of who is signed in) fetch the list again.
  useEffect(() => {
    if (!ready || !authReady) return;
    let alive = true;
    void (async () => {
      if (userId && valueRef.current.pending.length) {
        const done: string[] = [];
        for (const code of valueRef.current.pending) {
          try {
            await cloud.joinClass(code);
            done.push(code);
          } catch (e) {
            if (e instanceof CloudError && e.reason === 'notFound') done.push(code);
            else break; // offline: try again at the next sign-in / start
          }
        }
        if (done.length) await update((cur) => [{ ...cur, pending: cur.pending.filter((c) => !done.includes(c)) }, undefined]).catch(() => {});
      }
      if (alive) await refresh();
    })();
    return () => {
      alive = false;
    };
  }, [ready, authReady, userId, refresh, update]);

  const remember = useCallback(
    (summary: ClassSummary) =>
      update((cur) => [{ ...cur, summaries: [summary, ...cur.summaries.filter((s) => s.code !== summary.code)].sort(byActivity) }, undefined]),
    [update],
  );

  const join = useCallback(
    async (raw: string, known?: ClassSummary | ClassDetail) => {
      const code = normalizeCode(raw);
      if (userRef.current) {
        if (!(await cloud.joinClass(code))) throw new CloudError('notFound');
      }
      const signedIn = !!userRef.current;
      await update((cur) => {
        const summaries = known
          ? [{ ...summaryOf(known), member: signedIn || known.member }, ...cur.summaries.filter((s) => s.code !== code)].sort(byActivity)
          : cur.summaries;
        return [
          {
            ...cur,
            joined: cur.joined.includes(code) ? cur.joined : [code, ...cur.joined],
            pending: signedIn || cur.pending.includes(code) ? cur.pending : [code, ...cur.pending],
            summaries,
          },
          undefined,
        ];
      });
    },
    [update],
  );

  const forget = useCallback(
    async (code: string) => {
      await update((cur) => [
        {
          ...cur,
          joined: cur.joined.filter((c) => c !== code),
          pending: cur.pending.filter((c) => c !== code),
          summaries: cur.summaries.filter((s) => s.code !== code),
        },
        undefined,
      ]);
      void details.update((cur) => {
        if (!cur[code]) return [cur, undefined];
        const { [code]: _gone, ...rest } = cur;
        return [rest, undefined];
      });
    },
    [update, details],
  );

  const leave = useCallback(
    async (cls: Pick<ClassSummary, 'id' | 'code' | 'member'>) => {
      if (userRef.current && cls.member) await cloud.leaveClass(cls.id);
      await forget(cls.code);
    },
    [forget],
  );

  const detailsUpdate = details.update;
  const cacheDetail = useCallback(
    (detail: ClassDetail) => {
      void detailsUpdate((cur) => {
        const next: Details = { ...cur, [detail.code]: { detail, at: Date.now() } };
        const keys = Object.keys(next).sort((a, b) => next[b].at - next[a].at);
        for (const k of keys.slice(MAX_DETAILS)) delete next[k];
        return [next, undefined];
      });
    },
    [detailsUpdate],
  );

  const api = useMemo<Classes>(() => {
    // summaries fetched for someone else (signed out since): only what this device joined
    const sameUser = value.userId === userId;
    const list = value.summaries
      .filter((c) => sameUser || value.joined.includes(c.code))
      .map((c) => (sameUser ? c : { ...c, mine: false, member: false }))
      .filter((c) => !isBlocked(c.owner.id));
    return {
      ready,
      classes: list,
      status,
      error,
      syncedAt: value.syncedAt,
      refresh,
      isJoined: (code) => value.joined.includes(code) || value.summaries.some((s) => s.code === code && s.member && sameUser),
      join,
      leave,
      remember,
      forget,
      cachedDetail: (code) => details.value[code],
      cacheDetail,
    };
  }, [value, userId, isBlocked, ready, status, error, refresh, join, leave, remember, forget, details.value, cacheDetail]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useClasses(): Classes {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useClasses must be used inside <ClassesProvider>');
  return ctx;
}
