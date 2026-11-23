/**
 * Haptics + reduced-motion helpers shared by the kit. Haptics are never fired on web.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

const native = Platform.OS !== 'web';

/** Light tap (lip press). */
export function hapticPress() {
  if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Selection tick (segmented, chips, slider snaps). */
export function hapticSelect() {
  if (native) Haptics.selectionAsync().catch(() => {});
}

/** Medium thump (a step landing while playing). */
export function hapticStep() {
  if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success / warning notifications (save, delete). */
export function hapticNotify(kind: 'success' | 'warning' | 'error' = 'success') {
  if (!native) return;
  const map = {
    success: Haptics.NotificationFeedbackType.Success,
    warning: Haptics.NotificationFeedbackType.Warning,
    error: Haptics.NotificationFeedbackType.Error,
  };
  Haptics.notificationAsync(map[kind]).catch(() => {});
}

/** true when the OS asks for reduced motion: replace movement with fades. */
export { useReducedMotion };
