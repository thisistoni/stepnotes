/**
 * The real backend: Supabase (EU / Frankfurt). See README "Backend" for the contract.
 *
 * Rules kept here:
 * - the client is created on first use, so nothing touches the network (or loads auth state)
 *   until the cloud is needed;
 * - every method resolves with app types (camelCase) or rejects with a `CloudError`;
 * - `dance` / `data` values are passed through untouched: callers validate them.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, isAuthError, type SupabaseClient, type User } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { CloudError, type ClassDetail, type ClassPost, type ClassSummary, type CloudApi, type CloudUser, type LibraryItem, type MyShare, type SharedDance } from './api';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

let client: SupabaseClient | null = null;

function sb(): SupabaseClient {
  if (client) return client;
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  if (Platform.OS !== 'web') {
    // Refresh the session only while the app is in the foreground (Supabase Expo guide).
    const c = client;
    const sync = (state: string) => (state === 'active' ? c.auth.startAutoRefresh() : c.auth.stopAutoRefresh());
    sync(AppState.currentState ?? 'active');
    AppState.addEventListener('change', sync);
  }
  return client;
}

// --- errors ------------------------------------------------------------------------------------

interface PgError {
  message?: string;
  code?: string;
}

/** A failed PostgREST / RPC response → CloudError. `status` 0 means the request never got an answer. */
function dbError(error: PgError, status: number): CloudError {
  const code = error.code ?? '';
  if (status === 0) return new CloudError('offline', error.message);
  if (status === 429) return new CloudError('rateLimited', error.message);
  if (code === '28000' || status === 401 || code === 'PGRST301' || code === 'PGRST303') return new CloudError('notSignedIn', error.message);
  if (code === '53400') return new CloudError('limit', error.message);
  if (code === 'PGRST116') return new CloudError('notFound', error.message);
  return new CloudError('unknown', `${code} ${error.message ?? ''}`.trim());
}

/** An auth error → CloudError. `verifying`: a rejected token means a wrong or expired code. */
function authError(e: unknown, verifying = false): CloudError {
  if (e instanceof CloudError) return e;
  if (isAuthError(e)) {
    const code = e.code ?? '';
    if (e.name === 'AuthRetryableFetchError' || !e.status) return new CloudError('offline', e.message);
    if (e.status === 429 || code.startsWith('over_')) return new CloudError('rateLimited', e.message);
    if (verifying && (code === 'otp_expired' || /invalid|expired/i.test(e.message))) return new CloudError('invalidCode', e.message);
    if (code === 'session_not_found' || code === 'session_expired' || e.name === 'AuthSessionMissingError') return new CloudError('notSignedIn', e.message);
    return new CloudError('unknown', `${code} ${e.message}`.trim());
  }
  // fetch itself threw (no connection)
  if (e instanceof TypeError) return new CloudError('offline', e.message);
  return new CloudError('unknown', e instanceof Error ? e.message : String(e));
}

/** Unwrap a PostgREST / RPC result or throw a CloudError. */
async function run<T>(q: PromiseLike<{ data: T; error: PgError | null; status: number }>): Promise<T> {
  let res: { data: T; error: PgError | null; status: number };
  try {
    res = await q;
  } catch (e) {
    throw authError(e);
  }
  if (res.error) throw dbError(res.error, res.status);
  return res.data;
}

const toUser = (u: User | null | undefined): CloudUser | null => (u ? { id: u.id, email: u.email ?? '' } : null);

/** The signed-in user from the stored session (no network), or a `notSignedIn` error. */
async function requireUser(): Promise<CloudUser> {
  let user: CloudUser | null;
  try {
    const { data } = await sb().auth.getSession();
    user = toUser(data.session?.user);
  } catch (e) {
    throw authError(e);
  }
  if (!user) throw new CloudError('notSignedIn');
  return user;
}

// --- row mapping (snake_case → camelCase) ------------------------------------------------------

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
const author = (v: unknown) => {
  const r = (v ?? {}) as Row;
  return { id: s(r.id), name: s(r.name) };
};

const toLibraryItem = (r: Row): LibraryItem => ({
  kind: r.kind === 'collection' ? 'collection' : 'dance',
  id: s(r.id),
  data: r.data ?? null,
  updatedAt: n(r.updated_at),
  deleted: r.deleted === true,
  serverUpdatedAt: s(r.server_updated_at),
});
const toShare = (r: Row): MyShare => ({ id: s(r.id), danceId: s(r.dance_id), name: s(r.name), updatedAt: s(r.updated_at) });
const toSummary = (r: Row): ClassSummary => ({
  id: s(r.id),
  code: s(r.code),
  name: s(r.name),
  description: s(r.description),
  owner: author(r.owner),
  mine: r.mine === true,
  member: r.member === true,
  updatedAt: s(r.updated_at),
  postCount: n(r.post_count),
});
const toPost = (r: Row): ClassPost => ({
  id: s(r.id),
  name: s(r.name),
  note: s(r.note),
  dance: r.dance ?? null,
  createdAt: s(r.created_at),
  updatedAt: s(r.updated_at),
});

const SHARE_COLS = 'id, dance_id, name, updated_at';
const POST_COLS = 'id, name, note, dance, created_at, updated_at';
/** PostgREST returns at most this many rows per request. */
const PAGE = 1000;
/** `push_library_items` takes at most 200; we send 100 at a time. */
const PUSH_CHUNK = 100;

// --- the API -----------------------------------------------------------------------------------

export const supabaseApi: CloudApi = {
  async getUser() {
    try {
      const { data } = await sb().auth.getSession();
      return toUser(data.session?.user);
    } catch (e) {
      throw authError(e);
    }
  },

  onAuthChange(cb) {
    // Supabase holds its auth lock while it runs this callback: calling back into the client from
    // here (our listeners load the profile) would deadlock, so hand over on the next tick.
    const { data } = sb().auth.onAuthStateChange((_event, session) => {
      const user = toUser(session?.user);
      setTimeout(() => cb(user), 0);
    });
    return () => data.subscription.unsubscribe();
  },

  async sendCode(email) {
    try {
      const { error } = await sb().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
      if (error) throw error;
    } catch (e) {
      throw authError(e);
    }
  },

  async verifyCode(email, code) {
    try {
      const { data, error } = await sb().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      if (error) throw error;
      const user = toUser(data.user);
      if (!user) throw new CloudError('invalidCode');
      return user;
    } catch (e) {
      throw authError(e, true);
    }
  },

  async signInWithApple(identityToken) {
    try {
      const { data, error } = await sb().auth.signInWithIdToken({ provider: 'apple', token: identityToken });
      if (error) throw error;
      const user = toUser(data.user);
      if (!user) throw new CloudError('unknown', 'no user after Apple sign-in');
      return user;
    } catch (e) {
      throw authError(e);
    }
  },

  async signOut() {
    try {
      // this device only: other devices stay signed in
      const { error } = await sb().auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (e) {
      throw authError(e);
    }
  },

  async deleteAccount() {
    await requireUser();
    await run(sb().rpc('delete_account'));
    // the user no longer exists on the server: just forget the session here
    await sb().auth.signOut({ scope: 'local' }).catch(() => {});
  },

  async getProfile() {
    const user = await requireUser();
    const row = await run(sb().from('profiles').select('display_name').eq('id', user.id).maybeSingle());
    const name = s((row as Row | null)?.display_name).trim();
    return name ? { displayName: name } : null;
  },

  async saveProfile({ displayName }) {
    const user = await requireUser();
    const name = displayName.trim().slice(0, 40);
    // update first (clients may only update display_name); insert when there is no row yet
    const updated = await run(sb().from('profiles').update({ display_name: name }).eq('id', user.id).select('display_name'));
    if (!(updated as Row[] | null)?.length) {
      await run(sb().from('profiles').insert({ id: user.id, display_name: name }));
    }
    return { displayName: name };
  },

  async pullLibrary(since) {
    await requireUser();
    const out: LibraryItem[] = [];
    for (let from = 0; ; ) {
      let q = sb().from('library_items').select('kind, id, data, updated_at, deleted, server_updated_at');
      if (since) q = q.gt('server_updated_at', since);
      const rows = (await run(q.order('server_updated_at', { ascending: true }).order('kind').order('id').range(from, from + PAGE - 1))) as Row[] | null;
      const page = rows ?? [];
      out.push(...page.map(toLibraryItem));
      if (page.length < PAGE) return out;
      from += page.length;
    }
  },

  async pushLibrary(items) {
    if (!items.length) return;
    await requireUser();
    for (let i = 0; i < items.length; i += PUSH_CHUNK) {
      const chunk = items.slice(i, i + PUSH_CHUNK).map((it) => ({
        kind: it.kind,
        id: it.id,
        data: it.deleted ? null : it.data,
        updated_at: Math.round(it.updatedAt),
        deleted: it.deleted,
      }));
      await run(sb().rpc('push_library_items', { items: chunk }));
    }
  },

  async publishShare(danceId, name, dance) {
    await requireUser();
    // Same result as an upsert on (owner, dance_id), without asking for update rights on dance_id:
    // update my existing link for this dance, else insert one (and retry the update if another
    // device inserted it meanwhile).
    const update = () => run(sb().from('shares').update({ name, dance }).eq('dance_id', danceId).select(SHARE_COLS));
    let rows = (await update()) as Row[] | null;
    if (!rows?.length) {
      const res = await sb().from('shares').insert({ dance_id: danceId, name, dance }).select(SHARE_COLS);
      if (res.error?.code === '23505') rows = (await update()) as Row[] | null;
      else if (res.error) throw dbError(res.error, res.status);
      else rows = res.data as Row[] | null;
    }
    if (!rows?.length) throw new CloudError('unknown', 'share was not saved');
    return toShare(rows[0]);
  },

  async listMyShares() {
    const user = await requireUser();
    const rows = (await run(sb().from('shares').select(SHARE_COLS).eq('owner', user.id).order('updated_at', { ascending: false }))) as Row[] | null;
    return (rows ?? []).map(toShare);
  },

  async unpublishShare(id) {
    await requireUser();
    await run(sb().from('shares').delete().eq('id', id));
  },

  async getShare(id) {
    const r = (await run(sb().rpc('get_share', { p_id: id }))) as Row | null;
    if (!r) return null;
    const share: SharedDance = { id: s(r.id), name: s(r.name), dance: r.dance ?? null, author: author(r.author), updatedAt: s(r.updated_at), mine: r.mine === true };
    return share;
  },

  async listClasses(knownCodes) {
    const rows = (await run(sb().rpc('class_summaries', { p_codes: knownCodes }))) as Row[] | null;
    return (rows ?? []).map(toSummary);
  },

  async getClass(code) {
    const r = (await run(sb().rpc('get_class', { p_code: code }))) as Row | null;
    if (!r) return null;
    const { postCount: _p, ...summary } = toSummary(r);
    const detail: ClassDetail = { ...summary, posts: Array.isArray(r.posts) ? (r.posts as Row[]).map(toPost) : [] };
    return detail;
  },

  async createClass(name, description) {
    await requireUser();
    const row = (await run(sb().from('classes').insert({ name, description }).select('id, code').single())) as Row;
    // read it back through class_summaries for the owner name and flags
    const list = (await run(sb().rpc('class_summaries', { p_codes: [s(row.code)] }))) as Row[] | null;
    const found = (list ?? []).map(toSummary).find((c) => c.id === s(row.id));
    if (!found) throw new CloudError('unknown', 'created class not found');
    return found;
  },

  async updateClass(id, patch) {
    await requireUser();
    const rows = (await run(sb().from('classes').update(patch).eq('id', id).select('id'))) as Row[] | null;
    if (!rows?.length) throw new CloudError('notFound');
  },

  async deleteClass(id) {
    await requireUser();
    await run(sb().from('classes').delete().eq('id', id));
  },

  async joinClass(code) {
    await requireUser();
    const id = await run(sb().rpc('join_class', { p_code: code }));
    return id != null;
  },

  async leaveClass(id) {
    const user = await requireUser();
    await run(sb().from('class_members').delete().eq('class_id', id).eq('user_id', user.id));
  },

  async addClassPost(classId, post) {
    await requireUser();
    const row = (await run(sb().from('class_posts').insert({ class_id: classId, name: post.name, note: post.note, dance: post.dance }).select(POST_COLS).single())) as Row;
    return toPost(row);
  },

  async updateClassPost(postId, patch) {
    await requireUser();
    const rows = (await run(sb().from('class_posts').update(patch).eq('id', postId).select('id'))) as Row[] | null;
    if (!rows?.length) throw new CloudError('notFound');
  },

  async removeClassPost(postId) {
    await requireUser();
    await run(sb().from('class_posts').delete().eq('id', postId));
  },

  async report(kind, ref, reason, details) {
    await run(sb().rpc('report_content', { p_kind: kind, p_ref: ref, p_reason: reason, p_details: details ?? '' }));
  },
};
