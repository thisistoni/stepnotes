/**
 * Backend configuration. The publishable key is public by design (row level security protects
 * the data), so it is committed.
 */
import { Platform } from 'react-native';

export const SUPABASE_URL = 'https://ukpgvhhklsmxkvuqleuk.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_8ZYEo9TfuBqhY79e8mf4bg_TeO9Vb1m';

/** `EXPO_PUBLIC_CLOUD=fake` builds talk to the in-memory fake instead of Supabase (QA). */
export const CLOUD_MODE: 'fake' | 'supabase' = process.env.EXPO_PUBLIC_CLOUD === 'fake' ? 'fake' : 'supabase';

/**
 * People sign in with Apple (iOS) or Google. The e-mail code is built but switched off: it needs a
 * mail service on the backend. QA builds (fake cloud) keep it, so the flow stays tested; set
 * EXPO_PUBLIC_EMAIL_SIGN_IN=1 to offer it in a real build once a mail service exists.
 */
export const EMAIL_SIGN_IN = CLOUD_MODE === 'fake' || process.env.EXPO_PUBLIC_EMAIL_SIGN_IN === '1';

/** Origin of the web app, for links people share (`${WEB_ORIGIN}/s/<id>`, `${WEB_ORIGIN}/c/<code>`). */
export const WEB_ORIGIN: string =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : (process.env.EXPO_PUBLIC_WEB_ORIGIN ?? 'https://waltzy.antoniobeslic.com');

/** In-app links use the app scheme ("waltzy://s/<id>"). */
export const APP_SCHEME = 'waltzy';

/**
 * Who runs the app, shown on the terms and privacy pages. Filled in by the owner; while a value
 * is empty the pages simply leave that line out (never a placeholder).
 */
export const OPERATOR = {
  /** Person or company responsible for the app, e.g. "Jane Doe" */
  name: '',
  /** Postal address (one line, or lines separated by "\n") */
  address: '',
  /** Contact e-mail for privacy requests and reports */
  email: '',
  /** Date the texts were last changed, shown as "Last updated", e.g. "2026-12-01" */
  updated: '',
};
