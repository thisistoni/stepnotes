import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/lib/theme';

import { Icon, type IconName } from '../Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';

export interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  /** Red row (Delete…) */
  destructive?: boolean;
  disabled?: boolean;
  /** Second line under the label */
  hint?: string;
}

export interface MenuProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  items: MenuItem[];
}

/**
 * Action list in a bottom sheet (each row has the testID `menu-<key>`). Picking an item closes the sheet first and runs the action once
 * it is gone, so the action may safely open a ConfirmDialog or navigate.
 */
export function Menu({ visible, onClose, title, items }: MenuProps) {
  const pending = useRef<(() => void) | null>(null);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      testID="menu"
      onClosed={() => {
        const run = pending.current;
        pending.current = null;
        run?.();
      }}
    >
      <View style={s.list} accessibilityRole="menu">
        {items.map((it) => (
          <Pressable
            key={it.key}
            accessibilityRole="menuitem"
            accessibilityLabel={it.hint ? `${it.label}. ${it.hint}` : it.label}
            accessibilityState={{ disabled: !!it.disabled }}
            aria-disabled={!!it.disabled}
            disabled={it.disabled}
            testID={`menu-${it.key}`}
            onPress={() => {
              pending.current = it.onPress;
              onClose();
            }}
            style={({ pressed }) => [s.row, pressed && s.pressed, it.disabled && s.disabled]}
          >
            <View style={[s.tile, it.destructive && { backgroundColor: colors.dangerTint }]}>
              <Icon name={it.icon} size={21} color={it.destructive ? colors.danger : colors.ink} />
            </View>
            <View style={s.text}>
              <Text variant="bodyStrong" color={it.destructive ? 'dangerInk' : 'ink'}>
                {it.label}
              </Text>
              {!!it.hint && (
                <Text variant="caption" color="ink2">
                  {it.hint}
                </Text>
              )}
            </View>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  list: { paddingTop: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 58, paddingHorizontal: 8, borderRadius: radius.md },
  pressed: { backgroundColor: colors.track },
  disabled: { opacity: 0.45 },
  tile: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
});
