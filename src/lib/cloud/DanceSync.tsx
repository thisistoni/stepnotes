import { useMemo } from 'react';

import { useDances } from '../store';
import { useSyncSource } from './sync';

/**
 * Backs up the user's own dances (never the built-in starters: they are not in `custom`).
 * Mounted once inside <SyncProvider> and <DanceProvider>; renders nothing.
 */
export function DanceSync() {
  const { custom, ready, applyRemote } = useDances();
  const items = useMemo(
    () =>
      custom.map((d) => {
        const { builtIn: _b, ...data } = d;
        return { id: d.id, updatedAt: d.updatedAt, data };
      }),
    [custom],
  );
  useSyncSource({ kind: 'dance', items, apply: applyRemote, ready });
  return null;
}
