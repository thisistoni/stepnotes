import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Thrown by `update` when the change could not be saved; `message` is user-facing. */
export class PersistError extends Error {}

interface Options {
  /**
   * true (prefs): the change is kept in memory even if it could not be written, and the write
   * error is only logged. false (default, user data): memory changes only after the write
   * succeeded, and `update` rejects with a `PersistError` otherwise.
   */
  optimistic?: boolean;
}

/**
 * A value persisted under one AsyncStorage key, with safe writes:
 * - `update` waits until the stored value has been loaded, so an early write can never
 *   overwrite (wipe) data that was not read yet. If the read itself failed, the read is retried
 *   before the first write, and nothing is written while it keeps failing;
 * - updates are functional and run one after another (a promise queue), each on the latest
 *   value, so concurrent saves never lose each other's changes (no stale closures);
 * - the in-memory value changes only once the write succeeded (unless `optimistic`).
 *
 * `sanitize` turns whatever was stored (already JSON-parsed) into a valid value; it must not
 * throw, and calls `dropped()` if it had to discard part of the data. Unparsable JSON and data
 * that was partly dropped are copied to `<key>.corrupt` before they can be overwritten.
 */
export function usePersistedValue<T>(key: string, initial: T, sanitize: (raw: unknown, dropped: () => void) => T, { optimistic = false }: Options = {}) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const current = useRef<T>(initial);
  // Resolved once the first load finished. Created at first render (not in the effect) because
  // children's effects run before ours and may already call `update`.
  const [loaded] = useState(deferred);
  const queue = useRef<Promise<unknown>>(loaded.promise);
  const sanitizeRef = useRef(sanitize);
  /** true while the stored value could not be read: writing now would destroy it */
  const loadFailed = useRef(false);
  const unmounted = useRef(false);

  /** Read + sanitise the stored value into memory. Returns false if storage could not be read. */
  const load = useCallback(async () => {
    let raw: string | null;
    try {
      raw = await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn(`Could not load "${key}"`, e);
      loadFailed.current = true;
      return false;
    }
    loadFailed.current = false;
    if (raw == null) return true;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`Stored data under "${key}" is not valid JSON; keeping a copy and starting fresh.`);
      await AsyncStorage.setItem(`${key}.corrupt`, raw).catch(() => {});
      return true;
    }
    let lost = false;
    const clean = sanitizeRef.current(parsed, () => (lost = true));
    if (lost) await AsyncStorage.setItem(`${key}.corrupt`, raw).catch(() => {});
    if (!unmounted.current) {
      current.current = clean;
      setValue(clean);
    }
    return true;
  }, [key]);

  useEffect(() => {
    unmounted.current = false;
    load().finally(() => {
      if (unmounted.current) return;
      setReady(true);
      loaded.resolve();
    });
    return () => {
      unmounted.current = true;
    };
  }, [load, loaded]);

  /** Apply `fn` to the latest value, persist the result and resolve with `fn`'s second return value. */
  const update = useCallback(
    <R = void>(fn: (cur: T) => [T, R]): Promise<R> => {
      const run = async () => {
        // the first read failed: try again rather than overwrite what we could not read
        if (loadFailed.current) await load();
        const [next, result] = fn(current.current);
        if (next === current.current) return result;
        const commit = () => {
          current.current = next;
          if (!unmounted.current) setValue(next);
        };
        if (loadFailed.current) {
          if (optimistic) {
            commit();
            return result;
          }
          throw new PersistError('Your dances could not be read from this device, so nothing was saved. Please try again.');
        }
        if (optimistic) commit();
        try {
          await AsyncStorage.setItem(key, JSON.stringify(next));
        } catch (e) {
          console.warn(`Could not save "${key}"`, e);
          if (optimistic) return result;
          throw new PersistError('Could not save on this device. Please try again.');
        }
        if (!optimistic) commit();
        return result;
      };
      const p = queue.current.then(run, run);
      queue.current = p.catch(() => {});
      return p;
    },
    [key, load, optimistic],
  );

  return { value, ready, update };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
