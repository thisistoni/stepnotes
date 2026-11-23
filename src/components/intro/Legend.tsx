import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';

import { FootShape } from '@/components/FootShape';
import { Text, useReducedMotion } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, motion, radius, roleTheme, ROLE_COLOR, space } from '@/lib/theme';
import type { FootStyle, Role } from '@/lib/types';

import type { LessonPhase } from './useDemoLesson';

const ROWS: LessonPhase[] = ['solid', 'light', 'dashed'];

const SAMPLE_H = 34;

/** A small footprint drawn exactly like the diagram draws it (same theme tokens). */
function Sample({ kind, role, footStyle }: { kind: LessonPhase; role: Role; footStyle: FootStyle }) {
  const t = roleTheme(role);
  return (
    <Svg width={SAMPLE_H * 0.55} height={SAMPLE_H} viewBox="-0.85 -1.55 1.7 3.1" accessible={false}>
      {kind === 'dashed' ? (
        <FootShape foot="L" style={footStyle} color={t.ghost} ghostFill={t.ghostFill} ghostWidth={0.11} outline />
      ) : (
        <FootShape
          foot="L"
          style={footStyle}
          color={kind === 'solid' ? t.solid : t.light}
          lip={kind === 'solid' ? t.solidLip : t.lightLip}
          stroke={t.outline}
          strokeWidth={0.17}
        />
      )}
    </Svg>
  );
}

const Row = memo(function Row({
  row,
  active,
  role,
  footStyle,
}: {
  row: LessonPhase;
  active: boolean;
  role: Role;
  footStyle: FootStyle;
}) {
  const reduced = useReducedMotion();
  const { title, body } = useT().lesson.legend[row];
  const tone = ROLE_COLOR[role];
  const on = useSharedValue(active ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    on.set(withTiming(active ? 1 : 0, { duration: motion.base }));
    if (active && !reduced) {
      pop.set(0.82);
      pop.set(withSpring(1, motion.pop));
    }
  }, [active, reduced, on, pop]);
  const highlight = useAnimatedStyle(() => ({ opacity: on.get() }));
  const sample = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  return (
    <View
      style={s.row}
      accessible
      accessibilityLabel={`${title}: ${body}`}
      accessibilityState={{ selected: active }}
      aria-selected={active}
      testID={`legend-${row}${active ? '-active' : ''}`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, s.highlight, { backgroundColor: tone.wash, borderColor: tone.border }, highlight]} />
      <Animated.View style={[s.tile, { backgroundColor: colors.card, borderColor: active ? tone.border : colors.cardBorder }, sample]}>
        <Sample kind={row} role={role} footStyle={footStyle} />
      </Animated.View>
      <View style={s.text}>
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="small" color="ink2" numberOfLines={2}>
          {body}
        </Text>
      </View>
    </View>
  );
});

export interface LegendProps {
  /** What is happening in the demo right now (that row lights up); null = none */
  phase: LessonPhase | null;
  role: Role;
  footStyle: FootStyle;
}

/** The three things to know, each with a sample drawn like the diagram. */
export function Legend({ phase, role, footStyle }: LegendProps) {
  return (
    <View style={s.list}>
      {ROWS.map((r) => (
        <Row key={r} row={r} active={phase === r} role={role} footStyle={footStyle} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  list: { gap: space.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.xxs, paddingHorizontal: space.s, minHeight: 52 },
  highlight: { borderRadius: radius.md, borderWidth: 2 },
  tile: { width: 42, height: 42, borderRadius: radius.chip, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
});
