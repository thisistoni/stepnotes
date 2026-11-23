import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import { Entrance, FootSticker, Text, useReducedMotion } from '@/components/ui';
import { motion, ROLE_COLOR, space, STYLE_COLORS, type ColorSet } from '@/lib/theme';
import type { Foot } from '@/lib/types';

// --- the footprint trail -------------------------------------------------------------------------

const TRAIL_W = 200;
const TRAIL_H = 232;
const FOOT = 64;
/** Walking up and to the right: one stride per foot, feet alternate either side of the path. */
const STRIDE = { x: 19, y: -33 };
const ORIGIN = { x: 58, y: 196 };
const SIDE = 15;
const TONES: ColorSet[] = [
  STYLE_COLORS.bachata,
  STYLE_COLORS.latin,
  STYLE_COLORS.salsa,
  STYLE_COLORS.ballroom,
  ROLE_COLOR.follower,
  ROLE_COLOR.leader,
];

const len = Math.hypot(STRIDE.x, STRIDE.y);
const dir = { x: STRIDE.x / len, y: STRIDE.y / len };
/** The walker's left, in screen coordinates (y points down). */
const left = { x: dir.y, y: -dir.x };
const HEADING = (Math.atan2(dir.x, -dir.y) * 180) / Math.PI;

const TRAIL = TONES.map((tone, i) => {
  const foot: Foot = i % 2 === 0 ? 'L' : 'R';
  const side = foot === 'L' ? SIDE : -SIDE;
  return {
    foot,
    tone,
    x: ORIGIN.x + STRIDE.x * i + left.x * side,
    y: ORIGIN.y + STRIDE.y * i + left.y * side,
  };
});

const FIRST_DELAY = 180;
const STEP_DELAY = 170;

function TrailFoot({ index, animate }: { index: number; animate: boolean }) {
  const reduced = useReducedMotion();
  const f = TRAIL[index];
  const v = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    const delay = reduced ? index * 60 : FIRST_DELAY + index * STEP_DELAY;
    v.set(withDelay(delay, reduced ? withTiming(1, { duration: motion.base }) : withSpring(1, motion.pop)));
  }, [animate, index, reduced, v]);
  const st = useAnimatedStyle(() => {
    const p = v.get();
    return {
      opacity: Math.min(1, Math.max(0, p * 1.6)),
      transform: [
        { translateY: reduced ? 0 : (1 - p) * -10 },
        { rotate: `${HEADING}deg` },
        { scale: reduced ? 1 : 0.55 + 0.45 * p },
      ],
    };
  });
  const w = FOOT * 0.55;
  return (
    <Animated.View style={[s.foot, { left: f.x - w / 2, top: f.y - FOOT / 2, width: w, height: FOOT }, st]}>
      <FootSticker foot={f.foot} tone={f.tone} size={FOOT} />
    </Animated.View>
  );
}

// --- step ---------------------------------------------------------------------------------------

/** Step 1: footprints walk in, app name, the promise. */
export function WelcomeStep({ animate }: { animate: boolean }) {
  return (
    <View style={s.root} testID="intro-welcome">
      <View style={s.trail} accessible={false} importantForAccessibility="no-hide-descendants">
        {TRAIL.map((_, i) => (
          <TrailFoot key={i} index={i} animate={animate} />
        ))}
      </View>
      <Entrance index={2}>
        <Text variant="display" align="center" accessibilityRole="header">
          StepNotes
        </Text>
      </Entrance>
      <Entrance index={4}>
        <Text variant="body" color="ink2" align="center" style={s.promise}>
          Learn any dance step, one footprint at a time.
        </Text>
      </Entrance>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space.xl },
  trail: { width: TRAIL_W, height: TRAIL_H, marginBottom: space.xl },
  foot: { position: 'absolute' },
  promise: { marginTop: space.s, maxWidth: 260, fontSize: 18, lineHeight: 26 },
});
