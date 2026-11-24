import { Platform, Share } from 'react-native';

import type { ToastOptions } from '@/components/ui';
import type { Strings } from '@/lib/i18n';
import { shareText } from '@/lib/store';
import type { Dance } from '@/lib/types';

type Show = (opts: ToastOptions) => void;

function isAbort(e: unknown) {
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';
}

/**
 * Share a dance as Waltzy JSON text. Native: the system share sheet. Web: the browser share
 * sheet when there is one, otherwise the text is copied to the clipboard; if neither exists a toast
 * explains. Never throws.
 */
export async function shareDance(dance: Dance, t: Strings, show: Show) {
  const message = shareText(dance, t);
  const title = dance.name.trim() || t.common.untitled;
  if (Platform.OS !== 'web') {
    try {
      await Share.share({ title, message });
    } catch {
      show({ message: (tr) => tr.share.failed, icon: 'alert' });
    }
    return;
  }

  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function') {
    try {
      await Share.share({ title, message });
      return;
    } catch (e) {
      if (isAbort(e)) return; // the user closed the share sheet
      // fall through to the clipboard
    }
  }
  if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(message);
      show({ message: (tr) => tr.share.copied, icon: 'clipboard' });
      return;
    } catch {
      // fall through
    }
  }
  show({ message: (tr) => tr.share.unsupported, icon: 'alert', duration: 5000 });
}
