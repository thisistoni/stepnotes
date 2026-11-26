/**
 * "My classes": classes I teach and classes I joined, cached on the device so the Classes tab
 * works offline.
 *
 * Joining needs an account: the teacher sees who is in the class, and a class with approval only
 * opens once the teacher accepted the request (`membership: 'pending'` until then).
 *
 * - `waltzy.classes.v1`: `{ joined, pending, summaries, userId, syncedAt }`. `summaries` is the
 *   last list from `cloud.listClasses(joined)` (for `userId`, who was signed in then). `joined` and
 *   `pending` come from earlier versions, where a class could be joined without an account:
 *   `joined` are the codes kept on this device, `pending` the ones still to join in an account
 *   (done right after the next sign-in). New joins live in the account only.
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
  /** a class kept on this device by an earlier version (joined without an account) */
  isJoined: (code: string) => boolean;
  /**
   * Join in the account, or ask to (`'pending'`: the teacher has to accept). Rejects with
   * `notSignedIn` without an account and `notFound` for an unknown code.
   */
  join: (code: string, known?: ClassSummary | ClassDetail) => Promise<'member' | 'pending'>;
  /** Leave the class, or take back the request. */
  leave: (cls: Pick<ClassSummary, 'id' | 'code' | 'membership'>) => Promise<void>;
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

/** Entries cached by an earlier version lack the membership fields. */
function fill<T extends ClassSummary | ClassDetail>(c: T): T {
  const old = c as Partial<ClassSummary> & Partial<ClassDetail>;
  return {
    ...c,
    membership: old.membership ?? (c.member ? 'member' : 'none'),
    approval: old.approval ?? false,
    memberCount: old.memberCount ?? 0,
    requestCount: old.requestCount ?? 0,
    ...('posts' in c ? { locked: old.locked ?? false } : null),
  };
}

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
    summaries: Array.isArray(v.summaries) ? v.summaries.filter((s): s is ClassSummary => !!s && typeof s.code === 'string' && typeof s.id === 'string').map(fill) : [],
    userId: typeof v.userId === 'string' ? v.userId : null,
    syncedAt: typeof v.syncedAt === 'number' ? v.syncedAt : null,
  };
}
function sanitizeDetails(raw: unknown): Details {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Details = {};
  for (const [code, entry] of Object.entries(raw as Details)) {
    if (entry?.detail && Array.isArray(entry.detail.posts)) out[code] = { detail: fill(entry.detail), at: entry.at };
  }
  return out;
}

export const summaryOf = (d: ClassDetail | ClassSummary): ClassSummary =>
  'posts' in d ? { ...stripPosts(d), postCount: d.posts.length } : d;
function stripPosts(d: ClassDetail): Omit<ClassDetail, 'posts' | 'locked'> {
  const { posts: _p, locked: _l, ...rest } = d;
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
            // a class with approval: this asks the teacher (it then shows as "waiting")
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
      if (!userRef.current) throw new CloudError('notSignedIn');
      const status = await cloud.joinClass(code);
      if (!status) throw new CloudError('notFound');
      // show it under "My classes" right away (the next refresh brings the real entry)
      if (known) await remember({ ...summaryOf(known), member: status === 'member', membership: status }).catch(() => {});
      return status;
    },
    [remember],
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
    async (cls: Pick<ClassSummary, 'id' | 'code' | 'membership'>) => {
      if (userRef.current && cls.membership !== 'none') await cloud.leaveClass(cls.id);
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
      .map((c): ClassSummary => (sameUser ? c : { ...c, mine: false, member: false, membership: 'none', memberCount: 0, requestCount: 0 }))
      .filter((c) => !isBlocked(c.owner.id));
    return {
      ready,
      classes: list,
      status,
      error,
      syncedAt: value.syncedAt,
      refresh,
      isJoined: (code) => value.joined.includes(code),
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
