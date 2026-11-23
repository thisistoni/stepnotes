import { Platform, Share } from 'react-native';

import type { ToastOptions } from '@/components/ui';
import { exportJson } from '@/lib/store';
import type { Dance } from '@/lib/types';

type Show = (opts: ToastOptions) => void;

function isAbort(e: unknown) {
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';
}

/**
 * Share a dance as StepNotes JSON text. Native: the system share sheet. Web: the browser share
 * sheet when there is one, otherwise the text is copied to the clipboard; if neither exists a toast
 * explains. Never throws.
 */
export async function shareDance(dance: Dance, show: Show) {
  const message = exportJson(dance);
  const title = dance.name.trim() || 'Untitled dance';
  if (Platform.OS !== 'web') {
    try {
      await Share.share({ title, message });
    } catch {
      show({ message: 'Could not open sharing. Please try again.', icon: 'alert' });
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
      show({ message: 'Dance copied. Paste it into a message to share it.', icon: 'clipboard' });
      return;
    } catch {
      // fall through
    }
  }
  show({ message: 'This browser cannot share or copy. Open StepNotes on your phone to share.', icon: 'alert', duration: 5000 });
}
