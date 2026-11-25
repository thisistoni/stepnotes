/**
 * A stand-in for the backend, for QA builds (`EXPO_PUBLIC_CLOUD=fake`). It keeps the same rules
 * as the database: rows belong to their owner, others cannot change them, library rows follow
 * last-writer-wins on `updatedAt`, ids and codes are generated, `mine` / `member` are computed.
 *
 * - The "server" lives in AsyncStorage under `waltzy.fakecloud.v1` and is re-read on every call,
 *   so one browser profile can play several devices: wipe the other `waltzy.*` keys (the device)
 *   and keep this one (the cloud).
 * - The session lives under `waltzy.fakesession.v1`, i.e. on the device.
 * - Sign-in accepts any e-mail; the code is always 123456 (000000 or anything else is wrong).
 * - Set `offline: true` in the stored state to make every call fail with `offline`
 *   (`window.__fakeCloud.setOffline(true)` on web).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CloudError, type ClassDetail, type ClassSummary, type CloudApi, type CloudUser, type LibraryItem, type LibraryKind, type MyShare } from './api';

export const FAKE_CLOUD_KEY = 'waltzy.fakecloud.v1';
export const FAKE_SESSION_KEY = 'waltzy.fakesession.v1';
export const FAKE_CODE = '123456';

interface FUser { id: string; email: string; displayName: string | null }
interface FLib { owner: string; kind: LibraryKind; id: string; data: unknown | null; updatedAt: number; deleted: boolean; serverUpdatedAt: string }
interface FShare { id: string; owner: string; danceId: string; name: string; dance: unknown; updatedAt: string }
interface FClass { id: string; code: string; owner: string; name: string; description: string; updatedAt: string }
interface FPost { id: string; classId: string; name: string; note: string; dance: unknown; createdAt: string; updatedAt: string }
interface FMember { classId: string; userId: string }
interface FReport { by: string | null; kind: string; ref: string; reason: string; details: string; at: string }

interface State {
  users: FUser[];
  library: FLib[];
  shares: FShare[];
  classes: FClass[];
  posts: FPost[];
  members: FMember[];
  reports: FReport[];
  /** last server timestamp handed out (ms), keeps them strictly increasing */
  clock: number;
  /** simulate a failing network */
  offline: boolean;
}

const EMPTY: State = { users: [], library: [], shares: [], classes: [], posts: [], members: [], reports: [], clock: 0, offline: false };
const LATENCY_MS = 120;

async function load(): Promise<State> {
  try {
    const raw = await AsyncStorage.getItem(FAKE_CLOUD_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<State>) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}
const save = (st: State) => AsyncStorage.setItem(FAKE_CLOUD_KEY, JSON.stringify(st));

const sessionUser = async (): Promise<string | null> => (await AsyncStorage.getItem(FAKE_SESSION_KEY).catch(() => null)) || null;

/** One "request": latency, the offline switch, then `fn` on fresh state (saved if it returns true for `write`). */
async function call<T>(fn: (st: State, uid: string | null) => T | Promise<T>, write = false): Promise<T> {
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  const st = await load();
  if (st.offline) throw new CloudError('offline', 'fake cloud is offline');
  const result = await fn(st, await sessionUser());
  if (write) await save(st);
  return result;
}

const needUser = (uid: string | null): string => {
  if (!uid) throw new CloudError('notSignedIn');
  return uid;
};
function now(st: State): string {
  st.clock = Math.max(Date.now(), st.clock + 1);
  return new Date(st.clock).toISOString();
}
const rand = (len: number) => {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += abc[Math.floor(Math.random() * abc.length)];
  return out;
};
const copy = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));
const nameOf = (st: State, id: string) => st.users.find((u) => u.id === id)?.displayName ?? '';

function summary(st: State, c: FClass, uid: string | null): ClassSummary {
  return {
    id: c.id,
    code: c.code,
    name: c.name,
    description: c.description,
    owner: { id: c.owner, name: nameOf(st, c.owner) },
    mine: c.owner === uid,
    member: !!uid && st.members.some((m) => m.classId === c.id && m.userId === uid),
    updatedAt: c.updatedAt,
    postCount: st.posts.filter((p) => p.classId === c.id).length,
  };
}

const listeners = new Set<(u: CloudUser | null) => void>();
const emit = (u: CloudUser | null) => listeners.forEach((l) => l(u));

export const fakeApi: CloudApi = {
  async getUser() {
    const uid = await sessionUser();
    if (!uid) return null;
    const st = await load();
    const u = st.users.find((x) => x.id === uid);
    // the account was deleted from another device: the session is gone too
    if (!u) {
      await AsyncStorage.removeItem(FAKE_SESSION_KEY).catch(() => {});
      return null;
    }
    return { id: u.id, email: u.email };
  },

  onAuthChange(cb) {
    listeners.add(cb);
    return () => void listeners.delete(cb);
  },

  sendCode: (email) =>
    call(() => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new CloudError('unknown', 'invalid e-mail');
    }),

  async verifyCode(email, code) {
    const user = await call((st) => {
      if (code.trim() !== FAKE_CODE) throw new CloudError('invalidCode');
      const e = email.trim().toLowerCase();
      let u = st.users.find((x) => x.email === e);
      if (!u) {
        u = { id: `u-${rand(10)}`, email: e, displayName: null };
        st.users.push(u);
      }
      return { id: u.id, email: u.email };
    }, true);
    await AsyncStorage.setItem(FAKE_SESSION_KEY, user.id);
    emit(user);
    return user;
  },

  async signInWithApple(identityToken) {
    // one fake Apple account per token; Apple hides the real address behind a relay address
    const user = await call((st) => {
      const e = `${identityToken.slice(0, 12).toLowerCase() || 'apple'}@privaterelay.appleid.com`;
      let u = st.users.find((x) => x.email === e);
      if (!u) {
        u = { id: `u-${rand(10)}`, email: e, displayName: null };
        st.users.push(u);
      }
      return { id: u.id, email: u.email };
    }, true);
    await AsyncStorage.setItem(FAKE_SESSION_KEY, user.id);
    emit(user);
    return user;
  },

  async signInWithGoogle() {
    const user = await call((st) => {
      const e = 'gina.google@gmail.com';
      let u = st.users.find((x) => x.email === e);
      if (!u) {
        u = { id: `u-${rand(10)}`, email: e, displayName: null };
        st.users.push(u);
      }
      return { id: u.id, email: u.email, name: 'Gina' };
    }, true);
    await AsyncStorage.setItem(FAKE_SESSION_KEY, user.id);
    emit(user);
    return user;
  },

  async signOut() {
    await AsyncStorage.removeItem(FAKE_SESSION_KEY);
    emit(null);
  },

  async deleteAccount() {
    await call((st, uid) => {
      const me = needUser(uid);
      const mine = new Set(st.classes.filter((c) => c.owner === me).map((c) => c.id));
      st.users = st.users.filter((u) => u.id !== me);
      st.library = st.library.filter((r) => r.owner !== me);
      st.shares = st.shares.filter((r) => r.owner !== me);
      st.classes = st.classes.filter((c) => !mine.has(c.id));
      st.posts = st.posts.filter((p) => !mine.has(p.classId));
      st.members = st.members.filter((m) => m.userId !== me && !mine.has(m.classId));
    }, true);
    await AsyncStorage.removeItem(FAKE_SESSION_KEY);
    emit(null);
  },

  getProfile: () =>
    call((st, uid) => {
      const name = st.users.find((u) => u.id === needUser(uid))?.displayName;
      return name ? { displayName: name } : null;
    }),

  saveProfile: ({ displayName }) =>
    call((st, uid) => {
      const u = st.users.find((x) => x.id === needUser(uid));
      if (!u) throw new CloudError('notSignedIn');
      const name = displayName.trim().slice(0, 40);
      if (!name) throw new CloudError('unknown', 'name must be 1–40 characters');
      u.displayName = name;
      return { displayName: name };
    }, true),

  pullLibrary: (since) =>
    call((st, uid) => {
      const me = needUser(uid);
      return st.library
        .filter((r) => r.owner === me && (!since || r.serverUpdatedAt > since))
        .sort((a, b) => (a.serverUpdatedAt < b.serverUpdatedAt ? -1 : a.serverUpdatedAt > b.serverUpdatedAt ? 1 : 0))
        .map(({ owner: _o, ...r }): LibraryItem => copy(r));
    }),

  // the fake has no live channel: the sync engine's slow poll finds what another "device" pushed
  onLibraryChange: () => () => {},

  pushLibrary: (items) =>
    call((st, uid) => {
      const me = needUser(uid);
      for (const it of items) {
        const i = st.library.findIndex((r) => r.owner === me && r.kind === it.kind && r.id === it.id);
        // last writer wins: only a strictly newer row replaces the stored one
        if (i >= 0 && !(it.updatedAt > st.library[i].updatedAt)) continue;
        const row: FLib = { owner: me, kind: it.kind, id: it.id, data: it.deleted ? null : copy(it.data), updatedAt: it.updatedAt, deleted: it.deleted, serverUpdatedAt: now(st) };
        if (i >= 0) st.library[i] = row;
        else st.library.push(row);
      }
    }, true),

  publishShare: (danceId, name, dance) =>
    call((st, uid): MyShare => {
      const me = needUser(uid);
      let sh = st.shares.find((x) => x.owner === me && x.danceId === danceId);
      if (sh) Object.assign(sh, { name, dance: copy(dance), updatedAt: now(st) });
      else {
        sh = { id: rand(12), owner: me, danceId, name, dance: copy(dance), updatedAt: now(st) };
        st.shares.push(sh);
      }
      return { id: sh.id, danceId: sh.danceId, name: sh.name, updatedAt: sh.updatedAt };
    }, true),

  listMyShares: () =>
    call((st, uid) => {
      const me = needUser(uid);
      return st.shares
        .filter((x) => x.owner === me)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
        .map((x) => ({ id: x.id, danceId: x.danceId, name: x.name, updatedAt: x.updatedAt }));
    }),

  unpublishShare: (id) =>
    call((st, uid) => {
      const me = needUser(uid);
      st.shares = st.shares.filter((x) => !(x.id === id && x.owner === me));
    }, true),

  getShare: (id) =>
    call((st, uid) => {
      const sh = st.shares.find((x) => x.id === id.trim().toLowerCase());
      if (!sh) return null;
      return { id: sh.id, name: sh.name, dance: copy(sh.dance), author: { id: sh.owner, name: nameOf(st, sh.owner) }, updatedAt: sh.updatedAt, mine: sh.owner === uid };
    }),

  listClasses: (knownCodes) =>
    call((st, uid) => {
      const codes = new Set(knownCodes.map((c) => c.trim().toLowerCase()));
      return st.classes
        .filter((c) => codes.has(c.code) || (!!uid && (c.owner === uid || st.members.some((m) => m.classId === c.id && m.userId === uid))))
        .map((c) => summary(st, c, uid))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    }),

  getClass: (code) =>
    call((st, uid): ClassDetail | null => {
      const c = st.classes.find((x) => x.code === code.trim().toLowerCase());
      if (!c) return null;
      const { postCount: _n, ...rest } = summary(st, c, uid);
      const posts = st.posts
        .filter((p) => p.classId === c.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map(({ classId: _c, ...p }) => copy(p));
      return { ...rest, posts };
    }),

  createClass: (name, description) =>
    call((st, uid) => {
      const me = needUser(uid);
      const c: FClass = { id: `c-${rand(10)}`, code: rand(8), owner: me, name, description, updatedAt: now(st) };
      st.classes.push(c);
      return summary(st, c, me);
    }, true),

  updateClass: (id, patch) =>
    call((st, uid) => {
      const me = needUser(uid);
      const c = st.classes.find((x) => x.id === id && x.owner === me);
      if (!c) throw new CloudError('notFound');
      if (patch.name !== undefined) c.name = patch.name;
      if (patch.description !== undefined) c.description = patch.description;
      c.updatedAt = now(st);
    }, true),

  deleteClass: (id) =>
    call((st, uid) => {
      const me = needUser(uid);
      if (!st.classes.some((c) => c.id === id && c.owner === me)) return;
      st.classes = st.classes.filter((c) => c.id !== id);
      st.posts = st.posts.filter((p) => p.classId !== id);
      st.members = st.members.filter((m) => m.classId !== id);
    }, true),

  joinClass: (code) =>
    call((st, uid) => {
      const me = needUser(uid);
      const c = st.classes.find((x) => x.code === code.trim().toLowerCase());
      if (!c) return false;
      if (c.owner !== me && !st.members.some((m) => m.classId === c.id && m.userId === me)) st.members.push({ classId: c.id, userId: me });
      return true;
    }, true),

  leaveClass: (id) =>
    call((st, uid) => {
      const me = needUser(uid);
      st.members = st.members.filter((m) => !(m.classId === id && m.userId === me));
    }, true),

  addClassPost: (classId, post) =>
    call((st, uid) => {
      const me = needUser(uid);
      const c = st.classes.find((x) => x.id === classId && x.owner === me);
      if (!c) throw new CloudError('notFound');
      const at = now(st);
      const p: FPost = { id: `p-${rand(10)}`, classId, name: post.name, note: post.note, dance: copy(post.dance), createdAt: at, updatedAt: at };
      st.posts.push(p);
      c.updatedAt = at;
      const { classId: _c, ...out } = p;
      return copy(out);
    }, true),

  updateClassPost: (postId, patch) =>
    call((st, uid) => {
      const me = needUser(uid);
      const p = st.posts.find((x) => x.id === postId && st.classes.some((c) => c.id === x.classId && c.owner === me));
      if (!p) throw new CloudError('notFound');
      if (patch.name !== undefined) p.name = patch.name;
      if (patch.note !== undefined) p.note = patch.note;
      if (patch.dance !== undefined) p.dance = copy(patch.dance);
      p.updatedAt = now(st);
      // like the database trigger: any change to its dances counts as activity in the class
      const c = st.classes.find((x) => x.id === p.classId);
      if (c) c.updatedAt = p.updatedAt;
    }, true),

  removeClassPost: (postId) =>
    call((st, uid) => {
      const me = needUser(uid);
      const gone = st.posts.find((p) => p.id === postId && st.classes.some((c) => c.id === p.classId && c.owner === me));
      if (!gone) return;
      st.posts = st.posts.filter((p) => p !== gone);
      const c = st.classes.find((x) => x.id === gone.classId);
      if (c) c.updatedAt = now(st);
    }, true),

  report: (kind, ref, reason, details) =>
    call((st, uid) => {
      st.reports.push({ by: uid, kind, ref, reason, details: details ?? '', at: now(st) });
    }, true),
};

/** QA hooks (web only): flip the network, inspect the stored state. */
export const fakeControls = {
  async setOffline(offline: boolean) {
    const st = await load();
    st.offline = offline;
    await save(st);
  },
  dump: load,
};
