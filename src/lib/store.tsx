import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { BUILT_IN_DANCES } from './builtins';
import { DEFAULT_START, uid } from './pattern';
import type { Dance } from './types';

const STORAGE_KEY = 'stepnotes.dances.v1';

interface DanceStore {
  ready: boolean;
  dances: Dance[];
  custom: Dance[];
  get: (id: string) => Dance | undefined;
  save: (dance: Dance) => Promise<void>;
  remove: (id: string) => Promise<void>;
  duplicate: (dance: Dance) => Promise<Dance>;
  importJson: (json: string) => Promise<Dance>;
}

const Ctx = createContext<DanceStore | null>(null);

export function DanceProvider({ children }: { children: ReactNode }) {
  const [custom, setCustom] = useState<Dance[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setCustom(JSON.parse(raw));
      })
      .catch((e) => console.warn('Could not load dances', e))
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: Dance[]) => {
    setCustom(next);
    return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const save = useCallback(
    async (dance: Dance) => {
      const d = { ...dance, builtIn: false, updatedAt: Date.now() };
      const exists = custom.some((c) => c.id === d.id);
      await persist(exists ? custom.map((c) => (c.id === d.id ? d : c)) : [d, ...custom]);
    },
    [custom, persist],
  );

  const remove = useCallback(
    async (id: string) => {
      await persist(custom.filter((c) => c.id !== id));
    },
    [custom, persist],
  );

  const duplicate = useCallback(
    async (dance: Dance) => {
      const copy: Dance = {
        ...structuredCloneSafe(dance),
        id: uid('dance'),
        name: `${dance.name} (my version)`,
        builtIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await persist([copy, ...custom]);
      return copy;
    },
    [custom, persist],
  );

  const importJson = useCallback(
    async (json: string) => {
      const parsed = JSON.parse(json) as Partial<Dance>;
      if (!parsed || typeof parsed !== 'object' || !parsed.roles?.leader?.steps) {
        throw new Error('This does not look like a StepNotes dance.');
      }
      const d: Dance = {
        name: 'Imported dance',
        style: '',
        description: '',
        bpm: 120,
        beatsPerBar: 4,
        ...parsed,
        roles: {
          leader: { start: parsed.roles.leader.start ?? DEFAULT_START, steps: parsed.roles.leader.steps },
          follower: parsed.roles.follower,
        },
        id: uid('dance'),
        builtIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await persist([d, ...custom]);
      return d;
    },
    [custom, persist],
  );

  const value = useMemo<DanceStore>(() => {
    const dances = [...custom, ...BUILT_IN_DANCES];
    return {
      ready,
      dances,
      custom,
      get: (id) => dances.find((d) => d.id === id),
      save,
      remove,
      duplicate,
      importJson,
    };
  }, [custom, ready, save, remove, duplicate, importJson]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDances() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDances must be used inside <DanceProvider>');
  return ctx;
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function newDance(): Dance {
  return {
    id: uid('dance'),
    name: '',
    style: '',
    description: '',
    bpm: 120,
    beatsPerBar: 4,
    roles: { leader: { start: DEFAULT_START, steps: [] } },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Strip internal fields before sharing. */
export function exportJson(d: Dance) {
  const { builtIn: _b, ...rest } = d;
  return JSON.stringify({ app: 'stepnotes', version: 1, ...rest }, null, 2);
}
