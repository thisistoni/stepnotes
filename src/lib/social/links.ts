/**
 * Links people send each other:
 *
 *   https://<web origin>/s/<shareId>     a shared dance        appLink: waltzy://s/<shareId>
 *   https://<web origin>/c/<classCode>   a class (8 chars)     appLink: waltzy://c/<classCode>
 *
 * Ids and codes are lower-case (the backend trims and lower-cases them too).
 */
import { APP_SCHEME, WEB_ORIGIN } from '../cloud/config';

export const CLASS_CODE_LENGTH = 8;
export const SHARE_ID_LENGTH = 12;

export const shareUrl = (id: string) => `${WEB_ORIGIN}/s/${encodeURIComponent(id)}`;
export const classUrl = (code: string) => `${WEB_ORIGIN}/c/${encodeURIComponent(code)}`;
export const shareAppUrl = (id: string) => `${APP_SCHEME}://s/${encodeURIComponent(id)}`;
export const classAppUrl = (code: string) => `${APP_SCHEME}://c/${encodeURIComponent(code)}`;

/** A link without "https://" for showing (it still reads as a link, and it is shorter). */
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, '');

/** Lower-case, no spaces or dashes: "AB12 cd34" → "ab12cd34". */
export const normalizeCode = (code: string) => code.trim().toLowerCase().replace(/[\s-]+/g, '');

/**
 * What someone typed or pasted into "Join a class": the 8-character code (spaces / dashes are
 * fine) or a whole link (`…/c/<code>`, also `waltzy://c/<code>`, extra chat text around it is
 * fine). Returns the code, or null if the text holds none.
 */
export function parseClassInput(text: string): string | null {
  const link = /(?:\/|:\/\/)c\/([a-z0-9]+)/i.exec(text);
  if (link) return link[1].toLowerCase().length === CLASS_CODE_LENGTH ? link[1].toLowerCase() : null;
  const code = normalizeCode(text);
  return /^[a-z0-9]+$/.test(code) && code.length === CLASS_CODE_LENGTH ? code : null;
}

/**
 * What a scanned QR code holds: a class (link or bare code) or a shared dance (link). Returns the
 * route inside the app, or null when it is not one of ours.
 */
export function parseScanned(text: string): `/c/${string}` | `/s/${string}` | null {
  const share = /(?:\/|:\/\/)s\/([a-z0-9]+)/i.exec(text);
  if (share) return share[1].length === SHARE_ID_LENGTH ? `/s/${share[1].toLowerCase()}` : null;
  const code = parseClassInput(text);
  return code ? `/c/${code}` : null;
}

/** The class-post reference used for credit and reports: "<code>/<postId>". */
export const postRef = (code: string, postId: string) => `${code}/${postId}`;
