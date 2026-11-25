/**
 * Accounts: e-mail + 6-digit code, a display name, sign out, delete.
 *
 *   const { ready, user, profile, signedIn, sendCode, verifyCode, signInWithApple, saveProfile, signOut, deleteAccount } = useAuth();
 *   const requireAccount = useRequireAccount();
 *   if (!requireAccount()) return;   // opened the sign-in screen; try again when the user is back
 *
 * Every action rejects with a `CloudError` (show `cloudErrorText(e, t)`). The profile is cached
 * on the device (`waltzy.account.v1`) so the Me screen shows the name offline too.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CloudError, type CloudUser, type Profile } from './api';
import { cloud } from './index';
import { resetSyncMemory } from './syncMemory';

const ACCOUNT_KEY = 'waltzy.account.v1';
export const NAME_MAX = 40;

interface Cached {
  userId: string;
  displayName: string;
}

export interface Auth {
  /** false until the stored session was read */
  ready: boolean;
  user: CloudUser | null;
  /** null = no display name yet (or not signed in) */
  profile: Profile | null;
  signedIn: boolean;
  sendCode: (email: string) => Promise<void>;
  /** Signs in; resolves with the profile (null when the user still has to pick a name). */
  verifyCode: (email: string, code: string) => Promise<Profile | null>;
  /** iOS: signs in with the token from Apple's sheet; resolves like `verifyCode`. */
  signInWithApple: (identityToken: string) => Promise<Profile | null>;
  saveProfile: (displayName: string) => Promise<Profile>;
  /** Signs out on this device only. Dances stay on the device. */
  signOut: () => Promise<void>;
  /** Deletes the account and everything stored with it in the cloud. Dances stay on the device. */
  deleteAccount: () => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

async function readCache(userId: string): Promise<Profile | null> {
  try {
    const c = JSON.parse((await AsyncStorage.getItem(ACCOUNT_KEY)) ?? 'null') as Cached | null;
    return c && c.userId === userId && c.displayName ? { displayName: c.displayName } : null;
  } catch {
    return null;
  }
}
const writeCache = (userId: string, p: Profile | null) =>
  (p ? AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify({ userId, displayName: p.displayName } satisfies Cached)) : AsyncStorage.removeItem(ACCOUNT_KEY)).catch(() => {});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const userRef = useRef<CloudUser | null>(null);

  /** Show the cached name at once, then ask the cloud (offline: keep the cached one). */
  const loadProfile = useCallback(async (u: CloudUser) => {
    const cached = await readCache(u.id);
    if (userRef.current?.id === u.id && cached) setProfile(cached);
    try {
      const p = await cloud.getProfile();
      if (userRef.current?.id !== u.id) return p;
      setProfile(p);
      await writeCache(u.id, p);
      return p;
    } catch (e) {
      if (e instanceof CloudError && e.reason === 'notSignedIn') {
        userRef.current = null;
        setUser(null);
        setProfile(null);
      }
      return cached;
    }
  }, []);

  const adopt = useCallback(
    (u: CloudUser | null) => {
      if (u?.id === userRef.current?.id) return;
      userRef.current = u;
      setUser(u);
      setProfile(null);
      if (u) void loadProfile(u);
    },
    [loadProfile],
  );

  useEffect(() => {
    let alive = true;
    cloud
      .getUser()
      .then((u) => alive && adopt(u))
      .catch(() => {})
      .finally(() => alive && setReady(true));
    const off = cloud.onAuthChange((u) => alive && adopt(u));
    return () => {
      alive = false;
      off();
    };
  }, [adopt]);

  const sendCode = useCallback((email: string) => cloud.sendCode(email.trim()), []);

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      const u = await cloud.verifyCode(email.trim(), code);
      userRef.current = u;
      setUser(u);
      setProfile(null);
      return loadProfile(u);
    },
    [loadProfile],
  );

  const signInWithApple = useCallback(
    async (identityToken: string) => {
      const u = await cloud.signInWithApple(identityToken);
      userRef.current = u;
      setUser(u);
      setProfile(null);
      return loadProfile(u);
    },
    [loadProfile],
  );

  const saveProfile = useCallback(async (displayName: string) => {
    const u = userRef.current;
    if (!u) throw new CloudError('notSignedIn');
    const p = await cloud.saveProfile({ displayName: displayName.trim().slice(0, NAME_MAX) });
    setProfile(p);
    await writeCache(u.id, p);
    return p;
  }, []);

  const signOut = useCallback(async () => {
    await cloud.signOut();
    userRef.current = null;
    setUser(null);
    setProfile(null);
    await writeCache('', null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await cloud.deleteAccount();
    userRef.current = null;
    setUser(null);
    setProfile(null);
    await writeCache('', null);
    await resetSyncMemory();
  }, []);

  const value = useMemo<Auth>(
    () => ({ ready, user, profile, signedIn: !!user, sendCode, verifyCode, signInWithApple, saveProfile, signOut, deleteAccount }),
    [ready, user, profile, sendCode, verifyCode, signInWithApple, saveProfile, signOut, deleteAccount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * For actions that publish something (share, class): returns a function that is `true` when the
 * user is signed in and has a display name; otherwise it opens the sign-in screen (which also
 * asks for the name) and returns `false`.
 */
export function useRequireAccount(): () => boolean {
  const { signedIn, profile } = useAuth();
  return useCallback(() => {
    if (signedIn && profile?.displayName) return true;
    router.push('/sign-in');
    return false;
  }, [signedIn, profile]);
}
