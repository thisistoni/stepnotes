import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/lib/theme';

import { hapticSelect } from './feedback';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Accessible name ("Tempo") */
  label: string;
  /** Unit under the number ("bpm") */
  unit?: string;
  format?: (v: number) => string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** − value + with hold-to-repeat (speeds up while held). Adjustable for screen readers. */
export function Stepper({ value, onChange, min = -Infinity, max = Infinity, step = 1, label, unit, format, disabled, style }: StepperProps) {
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const bump = (dir: 1 | -1) => {
    const next = clamp(Math.round((latest.current + dir * step) * 1000) / 1000, min, max);
    if (next === latest.current) return false;
    latest.current = next;
    hapticSelect();
    onChange(next);
    return true;
  };
  const repeat = (dir: 1 | -1, delay: number) => {
    stop();
    timer.current = setTimeout(() => {
      if (bump(dir)) repeat(dir, Math.max(40, delay * 0.8));
    }, delay);
  };

  const text = format ? format(value) : String(value);
  const button = (dir: 1 | -1) => (
    <IconButton
      icon={dir === 1 ? 'plus' : 'minus'}
      label={`${dir === 1 ? 'Increase' : 'Decrease'} ${label}`}
      size={44}
      disabled={disabled || (dir === 1 ? value >= max : value <= min)}
      onPress={() => bump(dir)}
      delayLongPress={350}
      onLongPress={() => {
        bump(dir);
        repeat(dir, 160);
      }}
      onPressOut={stop}
    />
  );
  return (
    <View
      style={[s.row, style]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: unit ? `${text} ${unit}` : text }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => bump(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      {button(-1)}
      <View style={s.value}>
        <Text variant="heading" align="center" numberOfLines={1} style={s.num}>
          {text}
        </Text>
        {!!unit && (
          <Text variant="caption" color="ink2" align="center" style={s.unit}>
            {unit}
          </Text>
        )}
      </View>
      {button(1)}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, alignSelf: 'flex-start' },
  value: {
    minWidth: 72,
    paddingHorizontal: 8,
    height: 48,
    justifyContent: 'center',
    backgroundColor: colors.track,
    borderRadius: radius.chip,
  },
  num: { lineHeight: 22 },
  unit: { lineHeight: 13, fontSize: 11 },
});
