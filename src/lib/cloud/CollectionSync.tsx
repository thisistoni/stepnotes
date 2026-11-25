import { useMemo } from 'react';

import { toCloudData } from '../collectionModel';
import { useCollections } from '../collections';
import { useSyncSource } from './sync';

/**
 * Backs up the user's collections (kind 'collection'; data = name, dance ids, creation time).
 * Mounted once inside <SyncProvider> and <CollectionsProvider>, next to <DanceSync />; renders nothing.
 */
export function CollectionSync() {
  const { collections, ready, applyRemote } = useCollections();
  const items = useMemo(() => collections.map((c) => ({ id: c.id, updatedAt: c.updatedAt, data: toCloudData(c) })), [collections]);
  useSyncSource({ kind: 'collection', items, apply: applyRemote, ready });
  return null;
}
