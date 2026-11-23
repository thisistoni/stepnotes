import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { resolveText, useT, type Localized } from '@/lib/i18n';
import { colors, layout, motion, radius, space, withAlpha } from '@/lib/theme';

import { Icon, type IconName } from '../Icon';
import { Button } from './Button';
import { useReducedMotion } from './feedback';
import { Text } from './Text';

/** Texts may be functions of the dictionary (`(t) => t.editor.discard`): resolved while shown. */
export interface ConfirmOptions {
  title: Localized;
  message?: Localized;
  confirmLabel?: Localized;
  cancelLabel?: Localized;
  /** Red confirm button + warning tile */
  destructive?: boolean;
  icon?: IconName;
}

export interface ConfirmDialogProps extends ConfirmOptions {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Centred confirmation card (replaces Alert.alert / window.confirm). Controlled. */
export function ConfirmDialog({
  visible,
  title: titleText,
  message: messageText,
  confirmLabel: confirmText,
  cancelLabel: cancelText,
  destructive,
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const reduced = useReducedMotion();
  const tr = useT();
  const title = resolveText(titleText, tr);
  const message = messageText === undefined ? undefined : resolveText(messageText, tr);
  const confirmLabel = resolveText(confirmText ?? tr.common.confirm, tr);
  const cancelLabel = resolveText(cancelText ?? tr.common.cancel, tr);
  const [mounted, setMounted] = useState(visible);
  const t = useSharedValue(0);
  if (visible && !mounted) setMounted(true);
  useEffect(() => {
    if (!mounted) return;
    if (visible) t.set(reduced ? withTiming(1, { duration: motion.base }) : withSpring(1, motion.pop));
    else
      t.set(
        withTiming(0, { duration: motion.fast }, (done) => {
          if (done) scheduleOnRN(setMounted, false);
        }),
      );
  }, [visible, mounted, reduced, t]);

  const backdrop = useAnimatedStyle(() => ({ opacity: Math.min(1, t.get()) }));
  const card = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.get() * 1.5),
    transform: [{ scale: reduced ? 1 : 0.92 + 0.08 * t.get() }],
  }));

  if (!mounted) return null;
  const tileIcon = icon ?? (destructive ? 'trash' : 'info');
  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent navigationBarTranslucent>
      <View style={s.root}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel={cancelLabel} />
        </Animated.View>
        <Animated.View style={[s.card, card]} accessibilityViewIsModal accessibilityRole="alert" testID="confirm-dialog">
          <View style={[s.tile, { backgroundColor: destructive ? colors.dangerTint : colors.primaryTint }]}>
            <Icon name={tileIcon} size={26} color={destructive ? colors.danger : colors.primaryInk} />
          </View>
          <Text variant="heading" align="center">
            {title}
          </Text>
          {!!message && (
            <Text variant="body" color="ink2" align="center" style={s.msg}>
              {message}
            </Text>
          )}
          <View style={s.buttons}>
            <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} size="md" onPress={onConfirm} testID="confirm-ok" />
            <Button label={cancelLabel} variant="secondary" size="md" onPress={onCancel} testID="confirm-cancel" />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// --- imperative host ---------------------------------------------------------------------------

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<ConfirmFn | null>(null);

/** `const confirm = useConfirm(); if (await confirm({ title: 'Delete?', destructive: true })) …` */
export function useConfirm(): ConfirmFn {
  const fn = useContext(Ctx);
  if (!fn) throw new Error('useConfirm must be used inside <ConfirmHost>');
  return fn;
}

/** Provides `useConfirm()`. Mount once at the root. */
export function ConfirmHost({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [visible, setVisible] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const confirm = useCallback<ConfirmFn>((o) => {
    resolver.current?.(false);
    setOpts(o);
    setVisible(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const settle = useCallback((ok: boolean) => {
    setVisible(false);
    const r = resolver.current;
    resolver.current = null;
    r?.(ok);
  }, []);
  const value = useMemo(() => confirm, [confirm]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {opts && <ConfirmDialog {...opts} visible={visible} onConfirm={() => settle(true)} onCancel={() => settle(false)} />}
    </Ctx.Provider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  backdrop: { backgroundColor: colors.scrim },
  card: {
    width: '100%',
    maxWidth: layout.maxWidth - 80,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: space.xl,
    paddingTop: space.xl + 4,
    alignItems: 'stretch',
    gap: space.s,
    boxShadow: [{ offsetX: 0, offsetY: 16, blurRadius: 40, spreadDistance: -12, color: withAlpha(colors.shadow, 0.3) }],
  },
  tile: { width: 56, height: 56, borderRadius: 18, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  msg: { marginBottom: space.xs },
  buttons: { gap: space.s, marginTop: space.m },
});
