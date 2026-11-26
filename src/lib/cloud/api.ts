/**
 * The one seam between the app and the backend. Screens and providers only talk to `cloud`
 * (from '@/lib/cloud'), never to Supabase directly. Two implementations: `supabaseApi.ts` (the
 * real one) and `fakeApi.ts` (in memory + AsyncStorage, for QA builds).
 *
 * Values that come back from the cloud (`dance`, `data`) are untrusted: run a dance through
 * `parseDance` before it is shown or stored.
 */
/** `name`: the first name the sign-in provider knows (Google), to suggest as the display name */
export interface CloudUser { id: string; email: string; name?: string }
export interface Profile { displayName: string }
export interface Author { id: string; name: string }
export type LibraryKind = 'dance' | 'collection';
export interface LibraryItem { kind: LibraryKind; id: string; data: unknown | null; updatedAt: number; deleted: boolean; serverUpdatedAt: string }
export type LibraryPush = Omit<LibraryItem, 'serverUpdatedAt'>;
export interface SharedDance { id: string; name: string; dance: unknown; author: Author; updatedAt: string; mine: boolean }
export interface MyShare { id: string; danceId: string; name: string; updatedAt: string }
/** `pending`: asked to join a class with approval, the teacher has not accepted yet */
export type Membership = 'none' | 'pending' | 'member';
/**
 * `member` = `membership === 'member'`. `approval`: new people have to be accepted by the teacher.
 * `memberCount` / `requestCount` are only filled for the teacher (0 for everyone else).
 */
export interface ClassSummary { id: string; code: string; name: string; description: string; owner: Author; mine: boolean; member: boolean; membership: Membership; approval: boolean; memberCount: number; requestCount: number; updatedAt: string; postCount: number }
export interface ClassPost { id: string; name: string; note: string; dance: unknown; createdAt: string; updatedAt: string }
/** `locked`: a class with approval, seen by someone who is not accepted (yet): `posts` is empty */
export interface ClassDetail extends Omit<ClassSummary, 'postCount'> { locked: boolean; posts: ClassPost[] }
/** One person in the teacher's list of a class. `joinedAt`: when they joined (or asked). */
export interface ClassMember { id: string; name: string; status: 'pending' | 'member'; joinedAt: string }
export type ReportKind = 'share' | 'class' | 'post' | 'user';
export type ReportReason = 'offensive' | 'spam' | 'copyright' | 'other';

export interface CloudApi {
  // account
  getUser(): Promise<CloudUser | null>;
  onAuthChange(cb: (user: CloudUser | null) => void): () => void;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<CloudUser>;
  signInWithApple(identityToken: string): Promise<CloudUser>;       // iOS: the token from Apple's sign-in sheet
  signInWithGoogle(): Promise<CloudUser | null>;                    // null = closed without signing in (web: the page leaves for Google)
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<Profile>;
  // library sync
  pullLibrary(since: string | null): Promise<LibraryItem[]>;      // rows with server_updated_at > since, oldest first, all pages
  pushLibrary(items: LibraryPush[]): Promise<void>;               // chunks of ≤ 100
  onLibraryChange(cb: () => void): () => void;                    // live: my library changed in the cloud (best effort; returns "stop")
  // shares
  publishShare(danceId: string, name: string, dance: unknown): Promise<MyShare>;   // creates or updates the dance's link
  listMyShares(): Promise<MyShare[]>;
  unpublishShare(id: string): Promise<void>;
  getShare(id: string): Promise<SharedDance | null>;
  // classes
  listClasses(knownCodes: string[]): Promise<ClassSummary[]>;
  getClass(code: string): Promise<ClassDetail | null>;
  createClass(name: string, description: string, approval: boolean): Promise<ClassSummary>;
  updateClass(id: string, patch: { name?: string; description?: string; approval?: boolean }): Promise<void>;
  deleteClass(id: string): Promise<void>;
  joinClass(code: string): Promise<'member' | 'pending' | null>;  // needs an account; pending = the teacher has to accept; null = unknown code
  leaveClass(id: string): Promise<void>;                          // also takes back a request
  listClassMembers(classId: string): Promise<ClassMember[]>;      // teacher only: requests first, then members (newest first)
  approveClassMember(classId: string, userId: string): Promise<void>;
  removeClassMember(classId: string, userId: string): Promise<void>;   // also declines a request
  addClassPost(classId: string, post: { name: string; note: string; dance: unknown }): Promise<ClassPost>;
  updateClassPost(postId: string, patch: { name?: string; note?: string; dance?: unknown }): Promise<void>;
  removeClassPost(postId: string): Promise<void>;
  // moderation
  report(kind: ReportKind, ref: string, reason: ReportReason, details?: string): Promise<void>;
}

export type CloudErrorReason = 'offline' | 'notSignedIn' | 'invalidCode' | 'rateLimited' | 'limit' | 'notFound' | 'unknown';

/** Every method rejects with this. `reason` picks the message in `t.cloud.errors`. */
export class CloudError extends Error {
  reason: CloudErrorReason;
  constructor(reason: CloudErrorReason, detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = 'CloudError';
    this.reason = reason;
  }
}

/** The reason of any caught error (non-CloudErrors count as `unknown`). */
export const cloudErrorReason = (e: unknown): CloudErrorReason => (e instanceof CloudError ? e.reason : 'unknown');
