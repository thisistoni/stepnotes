import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A value persisted under one AsyncStorage key, with safe writes:
 * - `update` waits until the stored value has been loaded, so an early write can never
 *   overwrite (wipe) data that was not read yet;
 * - updates are functional and run one after another (a promise queue), each on the latest
 *   value, so concurrent saves never lose each other's changes (no stale closures).
 *
 * `sanitize` turns whatever was stored (already JSON-parsed) into a valid value; it must not
 * throw. Unparsable JSON is copied to `<key>.corrupt` before it can be overwritten.
 */
export function usePersistedValue<T>(key: string, initial: T, sanitize: (raw: unknown) => T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const current = useRef<T>(initial);
  // Resolved once the first load finished. Created at first render (not in the effect) because
  // children's effects run before ours and may already call `update`.
  const [loaded] = useState(deferred);
  const queue = useRef<Promise<unknown>>(loaded.promise);
  const sanitizeRef = useRef(sanitize);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw == null) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          console.warn(`Stored data under "${key}" is not valid JSON; keeping a copy and starting fresh.`);
          await AsyncStorage.setItem(`${key}.corrupt`, raw).catch(() => {});
          return;
        }
        const clean = sanitizeRef.current(parsed);
        if (!cancelled) {
          current.current = clean;
          setValue(clean);
        }
      } catch (e) {
        console.warn(`Could not load "${key}"`, e);
      }
    })().finally(() => {
      if (cancelled) return;
      setReady(true);
      loaded.resolve();
    });
    return () => {
      cancelled = true;
    };
  }, [key, loaded]);

  /** Apply `fn` to the latest value, persist the result and resolve with `fn`'s second return value. */
  const update = useCallback(
    <R = void>(fn: (cur: T) => [T, R]): Promise<R> => {
      const run = async () => {
        const [next, result] = fn(current.current);
        if (next !== current.current) {
          current.current = next;
          setValue(next);
          await AsyncStorage.setItem(key, JSON.stringify(next));
        }
        return result;
      };
      const p = queue.current.then(run, run);
      queue.current = p.catch(() => {});
      return p;
    },
    [key],
  );

  return { value, ready, update };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
