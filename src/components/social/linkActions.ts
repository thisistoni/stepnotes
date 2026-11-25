import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import type { ToastOptions } from '@/components/ui';

type Show = (opts: ToastOptions) => void;

const isAbort = (e: unknown) => typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';

/** Copy a link to the clipboard and say so. Never throws. */
export async function copyLink(url: string, show: Show) {
  try {
    const ok = await Clipboard.setStringAsync(url);
    if (ok === false) throw new Error('not copied');
    show({ message: (t) => t.share.linkCopied, icon: 'clipboard' });
  } catch {
    show({ message: (t) => t.share.copyFailed, icon: 'alert' });
  }
}

/**
 * The system share sheet with one friendly line and the link. Web: the browser's share sheet,
 * or the link is copied when there is none. Never throws.
 */
export async function shareLink(message: string, url: string, show: Show) {
  const nav = Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator : undefined;
  if (Platform.OS === 'web' && !(nav && typeof nav.share === 'function')) return copyLink(url, show);
  try {
    await Share.share({ message });
  } catch (e) {
    if (isAbort(e)) return; // closed the share sheet
    if (Platform.OS === 'web') return copyLink(url, show);
    show({ message: (t) => t.share.failed, icon: 'alert' });
  }
}
