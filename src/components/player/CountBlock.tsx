import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { FootBadge, Icon, Text, useReducedMotion } from '@/components/ui';
import type { BarRange } from '@/lib/pattern';
import { colors, lip, motion, radius, ROLE_COLOR, space, typography } from '@/lib/theme';
import type { Role, Step } from '@/lib/types';

import { BeatPills } from './BeatPills';

export interface CountLine {
  role: Role;
  step: Step | null;
  text: string;
}

interface Props {
  role: Role;
  steps: Step[];
  bars: BarRange[];
  index: number;
  /** one line per visible role (two in the Both view) */
  lines: CountLine[];
  onJump: (i: number) => void;
  /** short screens: smaller tile and description */
  compact?: boolean;
}

const TILE = { regular: { w: 76, h: 80 }, compact: { w: 64, h: 66 } };
/** Height of the whole block: tile row (tile + lip) + pills row. */
export function countBlockHeight(compact: boolean) {
  return (compact ? TILE.compact.h : TILE.regular.h) + lip.lg + 2 + 6 + 40;
}

function numeralSize(label: string, compact: boolean) {
  const k = compact ? 0.82 : 1;
  if (label.length <= 1) return 58 * k;
  if (label.length === 2) return 44 * k;
  if (label.length === 3) return 30 * k;
  return 22 * k;
}

/** The big count tile: pops on every count, says "Ready" at the start, pulses a HOLD tag on holds. */
const CountTile = memo(function CountTile({ role, step, index, compact }: { role: Role; step: Step | null; index: number; compact: boolean }) {
  const T = compact ? TILE.compact : TILE.regular;
  const c = ROLE_COLOR[role];
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  const fade = useSharedValue(1);
  const pulse = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      fade.set(withSequence(withTiming(0.35, { duration: 40 }), withTiming(1, { duration: motion.fast })));
    } else {
      pop.set(withSequence(withTiming(0.82, { duration: 60 }), withSpring(1, motion.pop)));
    }
  }, [index, reduced, pop, fade]);

  const hold = step?.kind === 'hold';
  useEffect(() => {
    if (hold && !reduced) {
      pulse.set(withRepeat(withSequence(withTiming(1.12, { duration: 260 }), withTiming(1, { duration: 260 })), -1));
    } else {
      cancelAnimation(pulse);
      pulse.set(1);
    }
  }, [hold, reduced, pulse]);

  const faceStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ scale: pop.get() }] }));
  const tagStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));
  const label = step?.count ?? '';
  const size = numeralSize(label, compact);

  return (
    <View
      style={[s.tileWrap, { width: T.w, height: T.h + lip.lg }]}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={step ? `Count ${label}${hold ? ', hold' : step.kind === 'tap' ? ', tap' : ''}` : 'Ready, start position'}
      testID="count-tile"
    >
      <View style={[s.tileLip, { backgroundColor: c.lip, height: T.h }]} />
      <View style={[s.tile, { backgroundColor: c.base, width: T.w, height: T.h }]}>
        <Animated.View style={[s.tileInner, faceStyle]}>
          {step ? (
            <Text
              variant="numeral"
              color={c.on}
              numberOfLines={1}
              maxFontSizeMultiplier={1}
              style={{ fontSize: size, lineHeight: size * 1.1 }}
              testID="current-count"
            >
              {label}
            </Text>
          ) : (
            <>
              <Icon name="footprints" size={compact ? 26 : 30} color={c.on} />
              <Text variant="overline" color={c.on} style={s.ready}>
                Ready
              </Text>
            </>
          )}
        </Animated.View>
      </View>
      {step && step.kind !== 'step' && (
        <View style={s.tagRow} pointerEvents="none">
          <Animated.View style={[s.tag, { borderColor: c.base }, tagStyle]} testID="count-kind-tag">
            <Text variant="overline" color={c.deep} style={s.tagText}>
              {hold ? 'Hold' : 'Tap'}
            </Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
});

/**
 * Count block under the stage: big count tile, "STEP 4 OF 6", the plain-language description and
 * the beat pills. Fixed height (two lines reserved for the description) so nothing jumps.
 */
export const CountBlock = memo(function CountBlock({ role, steps, bars, index, lines, onJump, compact = false }: Props) {
  const step = index >= 0 ? (steps[index] ?? null) : null;
  const n = steps.length;
  const tone = ROLE_COLOR[role];
  const overline = n === 0 ? 'No steps yet' : step ? `Step ${index + 1} of ${n}` : `Ready · ${n} ${n === 1 ? 'step' : 'steps'}`;
  const both = lines.length > 1;
  return (
    <View style={{ height: countBlockHeight(compact) }} testID="count-block">
      <View style={s.row}>
        <CountTile role={role} step={step} index={index} compact={compact} />
        <View style={s.text}>
          <Text variant="overline" color="ink2" numberOfLines={1} testID="count-overline">
            {overline}
          </Text>
          {both ? (
            <View style={s.lines}>
              {lines.map((l) => (
                <View key={l.role} style={s.line}>
                  <FootBadge
                    foot={l.step && l.step.kind !== 'hold' ? l.step.foot : null}
                    role={l.role}
                    weight={l.step?.kind === 'step'}
                    size={22}
                  />
                  <Text variant="smallStrong" numberOfLines={1} style={s.lineText}>
                    {l.text}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="cardTitle" numberOfLines={2} style={[s.desc, compact && s.descCompact]} testID="count-description">
              {lines[0]?.text ?? ''}
            </Text>
          )}
        </View>
      </View>
      {n > 0 && (
        <View style={s.pills}>
          <BeatPills steps={steps} bars={bars} index={index} tone={tone} onJump={onJump} />
        </View>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  pills: { marginTop: 6, height: 40, justifyContent: 'center' },
  tileWrap: { marginTop: 2 },
  tileLip: { position: 'absolute', left: 0, right: 0, top: lip.lg, borderRadius: radius.card },
  tile: { borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tileInner: { alignItems: 'center', justifyContent: 'center' },
  ready: { fontSize: 10.5, marginTop: 2, letterSpacing: 1 },
  tagRow: { position: 'absolute', left: 0, right: 0, bottom: -4, alignItems: 'center' },
  tag: {
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  tagText: { fontSize: 10, lineHeight: 12, letterSpacing: 0.8 },
  text: { flex: 1, minWidth: 0 },
  desc: { marginTop: 2, height: typography.cardTitle.lineHeight * 2 },
  descCompact: { fontSize: 16, lineHeight: 20, height: 40 },
  lines: { marginTop: 6, gap: 6, height: 2 * 22 + 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { flex: 1 },
});

export const COUNT_GAP = space.m;
