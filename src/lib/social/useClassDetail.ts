import { useCallback, useEffect, useRef, useState } from 'react';

import { cloudErrorReason, type ClassDetail } from '../cloud/api';
import { cloud } from '../cloud';
import { summaryOf, useClasses } from './classes';

export type ClassLoad =
  | { status: 'loading' }
  /** `offlineAt`: the cloud could not be reached; this is the copy cached at that time (ms) */
  | { status: 'ready'; detail: ClassDetail; offlineAt?: number }
  | { status: 'notFound' }
  | { status: 'failed'; error: unknown };

/**
 * A class page's data: `cloud.getClass(code)`, cached on the device for offline use; when the
 * cloud cannot be reached the cached copy is shown (with `offlineAt`). `reload()` fetches again
 * without going back to the skeleton.
 */
export function useClassDetail(code: string) {
  const { cachedDetail, cacheDetail, remember, isJoined } = useClasses();
  const [state, setState] = useState<ClassLoad>({ status: 'loading' });
  const deps = useRef({ cachedDetail, cacheDetail, remember, isJoined });
  useEffect(() => {
    deps.current = { cachedDetail, cacheDetail, remember, isJoined };
  });
  const seq = useRef(0);

  const load = useCallback(
    async (silent: boolean) => {
      const n = ++seq.current;
      if (!silent) setState({ status: 'loading' });
      try {
        const detail = await cloud.getClass(code);
        if (n !== seq.current) return;
        if (!detail) return setState({ status: 'notFound' });
        setState({ status: 'ready', detail });
        const d = deps.current;
        d.cacheDetail(detail);
        // keep "My classes" up to date with what we just saw
        if (detail.mine || detail.member || d.isJoined(detail.code)) void d.remember(summaryOf(detail)).catch(() => {});
      } catch (error) {
        if (n !== seq.current) return;
        if (cloudErrorReason(error) === 'notFound') return setState({ status: 'notFound' });
        const cached = deps.current.cachedDetail(code);
        setState((cur) =>
          cur.status === 'ready' && silent
            ? { ...cur, offlineAt: cur.offlineAt ?? cached?.at ?? Date.now() }
            : cached
              ? { status: 'ready', detail: cached.detail, offlineAt: cached.at }
              : { status: 'failed', error },
        );
      }
    },
    [code],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const reload = useCallback(() => load(true), [load]);
  const retry = useCallback(() => load(false), [load]);
  return { state, reload, retry };
}
