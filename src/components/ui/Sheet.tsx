import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useT } from '@/lib/i18n';
import { colors, layout, motion, radius, space, withAlpha } from '@/lib/theme';

import { useReducedMotion } from './feedback';
import { useKeyboardOpen } from './keyboard';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  /** Backdrop tap, drag down, Escape (web) or the Android back button */
  onClose: () => void;
  /** After the exit animation finished and the modal is gone (run follow-up actions here) */
  onClosed?: () => void;
  title?: string;
  children?: ReactNode;
  testID?: string;
}

/**
 * Modal bottom sheet: dimmed backdrop, springs up, drag handle (drag down to dismiss), closes on
 * backdrop tap / Escape / back button. Content column max 480 wide.
 *
 * The sheet sits on top of the keyboard: while it is open the sheet only has the space above it
 * (at most up to the status bar), so tall content must be able to shrink (a ScrollView with
 * `flexShrink: 1`; see `useScrollToEndOnFocus` for a field at the end of such a list).
 */
export function Sheet({ visible, onClose, onClosed, title, children, testID }: SheetProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const kb = useKeyboardOpen();
  const tr = useT();
  const [mounted, setMounted] = useState(visible);
  /** false once the exit animation ended: the native modal is being dismissed */
  const [shown, setShown] = useState(visible);
  const t = useSharedValue(0);
  const drag = useSharedValue(0);
  const height = useSharedValue(800);

  if (visible && (!mounted || !shown)) {
    setMounted(true);
    setShown(true);
  }

  // Follow-up actions (a ConfirmDialog, the share sheet) may only start once the native modal is
  // really gone: on iOS presenting while another modal is dismissing can fail silently. iOS reports
  // that with `onDismiss`; elsewhere (and as a fallback) we wait a moment.
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  });
  const done = useRef(true);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissed = useCallback(() => {
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
    if (done.current) return;
    done.current = true;
    setMounted(false);
    onClosedRef.current?.();
  }, []);
  useEffect(() => () => {
    if (fallback.current) clearTimeout(fallback.current);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      if (fallback.current) clearTimeout(fallback.current);
      fallback.current = null;
      done.current = false;
      drag.set(0);
      t.set(reduced ? withTiming(1, { duration: motion.base }) : withSpring(1, motion.sheet));
    } else {
      const finish = () => {
        setShown(false);
        fallback.current = setTimeout(dismissed, Platform.OS === 'ios' ? 600 : 60);
      };
      t.set(
        withTiming(0, { duration: 200 }, (done) => {
          if (done) scheduleOnRN(finish);
        }),
      );
    }
  }, [visible, mounted, reduced, t, drag, dismissed]);

  const pan = usePanGesture({
    activeOffsetY: [-6, 6],
    onUpdate: (e) => {
      'worklet';
      drag.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (drag.get() > 110 || e.velocityY > 900) {
        scheduleOnRN(onClose);
      } else {
        drag.set(withSpring(0, motion.slide));
      }
    },
  });

  const backdrop = useAnimatedStyle(() => ({ opacity: t.get() }));
  const panel = useAnimatedStyle(() => ({
    opacity: reduced ? t.get() : 1,
    transform: [{ translateY: (reduced ? 0 : (1 - t.get()) * (height.get() + 40)) + drag.get() }],
  }));

  if (!mounted) return null;
  return (
    <Modal
      visible={shown}
      onDismiss={dismissed}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={['portrait']}
    >
      <GestureHandlerRootView style={s.root}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, backdrop]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={tr.common.close}
            testID="sheet-backdrop"
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior="padding"
          enabled={Platform.OS !== 'web'}
          pointerEvents="box-none"
          style={[s.area, kb && { paddingTop: insets.top + space.s }]}
        >
          <Animated.View
            testID={testID}
            accessibilityViewIsModal
            onLayout={(e: LayoutChangeEvent) => height.set(e.nativeEvent.layout.height)}
            style={[s.panel, !kb && s.panelFree, { paddingBottom: (kb ? space.l : Math.max(insets.bottom, space.l)) + space.s }, panel]}
          >
            <GestureDetector gesture={pan}>
              <View style={s.grab} accessibilityHint={tr.common.dragToClose}>
                <View style={s.handle} />
                {!!title && (
                  <Text variant="heading" style={s.title} accessibilityRole="header">
                    {title}
                  </Text>
                )}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  area: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: colors.scrim },
  panel: {
    width: '100%',
    maxWidth: layout.maxWidth,
    flexShrink: 1,
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl - 4,
    boxShadow: [{ offsetX: 0, offsetY: -10, blurRadius: 30, spreadDistance: -12, color: withAlpha(colors.shadow, 0.18) }],
  },
  // (above the keyboard it may take all the room there is, up to the status bar)
  panelFree: { maxHeight: '88%' },
  grab: { paddingTop: 10, paddingBottom: space.s },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: colors.handle, alignSelf: 'center' },
  title: { marginTop: space.m, marginBottom: space.xxs },
});
