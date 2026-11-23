import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { resolveText, useT, type Localized } from '@/lib/i18n';
import { colors, layout, motion, radius, withAlpha } from '@/lib/theme';

import { Icon, type IconName } from '../Icon';
import { useReducedMotion } from './feedback';
import { Text } from './Text';

export interface ToastOptions {
  /** Text, or `(t) => t.editor.saved` so a language switch while it shows re-translates it */
  message: Localized;
  /** Optional action, e.g. `{ label: (t) => t.common.undo, onPress: restore }` */
  action?: { label: Localized; onPress: () => void };
  icon?: IconName;
  /** ms before it hides (default 3500, 6000 with an action) */
  duration?: number;
}

interface ToastApi {
  show: (opts: ToastOptions) => void;
  hide: () => void;
  /**
   * Screens with bottom chrome (pinned footer, FAB) lift toasts above it; returns an unregister
   * function. Screen does this for you on focus.
   */
  registerInset: (px: number) => () => void;
}

const Ctx = createContext<ToastApi | null>(null);

/** `const toast = useToast(); toast.show({ message: 'Dance deleted', action: { label: 'Undo', onPress } })` */
export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastHost>');
  return ctx;
}

/** Optional variant for components that may render outside the host (undefined then). */
export function useToastInset() {
  return useContext(Ctx)?.registerInset;
}

interface Current extends ToastOptions {
  id: number;
}

/** Provides `useToast()` and renders one toast at a time above the bottom inset. Mount once at the root. */
export function ToastHost({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Current | null>(null);
  const [insets, setInsets] = useState<{ id: number; px: number }[]>([]);
  const t = useT();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const inset = insets.length ? insets[insets.length - 1].px : 0;
  const seq = useRef(0);
  const regSeq = useRef(0);
  const registerInset = useCallback((px: number) => {
    regSeq.current += 1;
    const id = regSeq.current;
    setInsets((list) => [...list, { id, px }]);
    return () => setInsets((list) => list.filter((x) => x.id !== id));
  }, []);
  const show = useCallback((opts: ToastOptions) => {
    seq.current += 1;
    setCurrent({ ...opts, id: seq.current });
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(resolveText(opts.message, tRef.current));
  }, []);
  const hideNow = useCallback(() => setCurrent(null), []);
  const [hideSignal, setHideSignal] = useState(0);
  const hide = useCallback(() => setHideSignal((n) => n + 1), []);
  const api = useMemo(() => ({ show, hide, registerInset }), [show, hide, registerInset]);
  return (
    <Ctx.Provider value={api}>
      {children}
      {current && <ToastView key={current.id} toast={current} inset={inset} hideSignal={hideSignal} onGone={hideNow} />}
    </Ctx.Provider>
  );
}

function ToastView({ toast, inset, hideSignal, onGone }: { toast: Current; inset: number; hideSignal: number; onGone: () => void }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const t = useT();
  const message = resolveText(toast.message, t);
  const actionLabel = toast.action ? resolveText(toast.action.label, t) : '';
  const v = useSharedValue(0);
  const startSignal = useRef(hideSignal);

  const leave = useCallback(() => {
    v.set(
      withTiming(0, { duration: motion.fast }, (done) => {
        if (done) scheduleOnRN(onGone);
      }),
    );
  }, [v, onGone]);

  useEffect(() => {
    v.set(reduced ? withTiming(1, { duration: motion.base }) : withSpring(1, motion.sheet));
    const t = setTimeout(leave, toast.duration ?? (toast.action ? 6000 : 3500));
    return () => clearTimeout(t);
  }, [toast, reduced, v, leave]);

  useEffect(() => {
    if (hideSignal !== startSignal.current) leave();
  }, [hideSignal, leave]);

  const st = useAnimatedStyle(() => ({
    opacity: Math.min(1, v.get() * 1.4),
    transform: [{ translateY: reduced ? 0 : (1 - v.get()) * 90 }],
  }));

  return (
    <View pointerEvents="box-none" style={[s.wrap, { bottom: Math.max(insets.bottom, 12) + 12 + inset }]}>
      <Animated.View
        style={[s.toast, st]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        testID="toast"
      >
        {toast.icon && <Icon name={toast.icon} size={20} color={colors.primaryLight} strokeWidth={2.6} />}
        <Text variant="small" color="onColor" style={s.msg} numberOfLines={3}>
          {message}
        </Text>
        {toast.action && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            hitSlop={10}
            onPress={() => {
              toast.action!.onPress();
              leave();
            }}
            style={({ pressed }) => [s.action, pressed && s.actionPressed]}
          >
            <Text variant="smallStrong" color="primaryLight">
              {actionLabel}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  toast: {
    width: '100%',
    maxWidth: layout.maxWidth - 32,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.toast,
    boxShadow: [{ offsetX: 0, offsetY: 10, blurRadius: 24, spreadDistance: -8, color: withAlpha(colors.shadow, 0.4) }],
  },
  msg: { flex: 1, paddingVertical: 6 },
  action: { minHeight: 40, minWidth: 56, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionPressed: { backgroundColor: withAlpha(colors.card, 0.12) },
});
