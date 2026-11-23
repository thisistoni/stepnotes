/**
 * TEMPORARY compatibility layer: the pre-redesign `Button / Segmented / Toggle / Card /
 * SectionTitle` API, implemented with the new kit, so the Player / Editor / Import screens keep
 * working until they are rewritten. New code must import from '@/components/ui' instead.
 * Delete this file once nothing imports it.
 */
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { ROLE_COLOR, TONE, type ColorSet } from '@/lib/theme';

import {
  Button as KitButton,
  Card as KitCard,
  Chip,
  Segmented as KitSegmented,
  Text,
} from './ui';

export function Button({
  label,
  onPress,
  variant = 'secondary',
  style,
  disabled,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  small?: boolean;
}) {
  return <KitButton label={label} onPress={onPress} variant={variant} size={small ? 'sm' : 'md'} disabled={disabled} style={style} />;
}

/** Old API took a colour string; map the role colours, anything else becomes ink. */
function toneFor(color?: string): ColorSet | undefined {
  if (!color) return undefined;
  if (color === ROLE_COLOR.leader.base) return ROLE_COLOR.leader;
  if (color === ROLE_COLOR.follower.base) return ROLE_COLOR.follower;
  return TONE.ink;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  color,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  color?: string;
}) {
  return <KitSegmented options={options} value={value} onChange={onChange} color={toneFor(color)} />;
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <Chip variant="toggle" label={label} selected={value} onPress={() => onChange(!value)} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <KitCard style={style} padding={14}>
      {children}
    </KitCard>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text variant="overline" color="ink2" style={{ marginTop: 18, marginBottom: 8 }}>
      {children}
    </Text>
  );
}
