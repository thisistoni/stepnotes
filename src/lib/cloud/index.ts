/**
 * Everything the app needs from the backend.
 *
 *   import { cloud, CloudError, cloudErrorText } from '@/lib/cloud';
 *   try { await cloud.publishShare(id, name, dance) }
 *   catch (e) { toast.show({ message: (t) => cloudErrorText(e, t), icon: 'alert' }) }
 *
 * `cloud` is the fake (in memory + AsyncStorage) when the build sets `EXPO_PUBLIC_CLOUD=fake`,
 * else Supabase. Accounts: `useAuth` / `useRequireAccount` from './auth'. Library backup:
 * `useSync` / `useSyncSource` from './sync'.
 */
import { Platform } from 'react-native';

import type { Strings } from '../i18n/en';
import { CloudError, cloudErrorReason, type CloudApi } from './api';
import { CLOUD_MODE } from './config';

export * from './api';
export { CLOUD_MODE, OPERATOR, WEB_ORIGIN } from './config';

// require (not import): only the chosen implementation is evaluated, so a fake build never
// creates a Supabase client.
function pick(): CloudApi {
  if (CLOUD_MODE === 'fake') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fake = require('./fakeApi') as typeof import('./fakeApi');
    if (Platform.OS === 'web' && typeof window !== 'undefined') (window as unknown as Record<string, unknown>).__fakeCloud = fake.fakeControls;
    return fake.fakeApi;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./supabaseApi') as typeof import('./supabaseApi')).supabaseApi;
}

export const cloud: CloudApi = pick();

/** The user-facing message for any error a cloud call threw (in the given language). */
export function cloudErrorText(e: unknown, t: Strings): string {
  return t.cloud.errors[cloudErrorReason(e)];
}

/** true for errors worth retrying later on their own (network, rate limit). */
export const isTransient = (e: unknown) => e instanceof CloudError && (e.reason === 'offline' || e.reason === 'rateLimited');
