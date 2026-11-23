import { useEffect, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { ChoiceRow, CoachBubble, Entrance, Text, useReducedMotion } from '@/components/ui';
import { motion, ROLE_COLOR, space, STYLE_COLORS, type ColorSet } from '@/lib/theme';
import type { IconName } from '@/components/Icon';

export type RoleChoice = 'leader' | 'follower' | 'both';

const CHOICES: { key: RoleChoice; title: string; subtitle: string; icon: IconName; tone: ColorSet }[] = [
  { key: 'leader', title: 'Leader', subtitle: 'I lead the steps', icon: 'flat-shoe', tone: ROLE_COLOR.leader },
  { key: 'follower', title: 'Follower', subtitle: 'I follow my partner', icon: 'heel', tone: ROLE_COLOR.follower },
  { key: 'both', title: 'Both / not sure', subtitle: 'Start as leader', icon: 'footprints', tone: STYLE_COLORS.bachata },
];

/** Coach line per selection: plain text with one emphasised phrase. */
const COACH: Record<RoleChoice | 'none', { before: string; strong: string; after: string; tone: ColorSet }> = {
  none: { before: 'You can ', strong: 'switch parts', after: ' in any dance later.', tone: STYLE_COLORS.bachata },
  leader: { before: 'Leaders usually start on the ', strong: 'left foot', after: '. We’ll show their steps first.', tone: ROLE_COLOR.leader },
  follower: { before: 'Followers usually start on the ', strong: 'right foot', after: '. We’ll show their steps first.', tone: ROLE_COLOR.follower },
  both: { before: 'We’ll start with the leader. ', strong: 'Switch parts', after: ' in any dance.', tone: STYLE_COLORS.bachata },
};

/** Re-plays a small pop whenever `id` changes (the coach "says" something new). */
function Pop({ id, children }: { id: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(1);
  useEffect(() => {
    v.set(0);
    v.set(reduced ? withTiming(1, { duration: motion.fast }) : withSpring(1, motion.pop));
  }, [id, reduced, v]);
  const st = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * Math.min(1, v.get()),
    transform: [{ scale: reduced ? 1 : 0.96 + 0.04 * v.get() }],
  }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

export interface RoleStepProps {
  value: RoleChoice | null;
  onChange: (v: RoleChoice) => void;
}

/** Step 2: which part do you dance? */
export function RoleStep({ value, onChange }: RoleStepProps) {
  const coach = COACH[value ?? 'none'];
  // short phones: a smaller title keeps the coach bubble on screen
  const compact = useWindowDimensions().height < 700;
  return (
    <View style={[s.root, compact && s.rootCompact]} testID="intro-role">
      <Entrance index={0}>
        <Text variant={compact ? 'title' : 'display'} accessibilityRole="header" style={s.title}>
          Which part do you dance?
        </Text>
      </Entrance>
      <View style={[s.choices, compact && s.choicesCompact]} accessibilityRole="radiogroup">
        {CHOICES.map((c, i) => (
          <Entrance key={c.key} index={2 + i}>
            <ChoiceRow
              title={c.title}
              subtitle={c.subtitle}
              icon={c.icon}
              tone={c.tone}
              selected={value === c.key}
              onPress={() => onChange(c.key)}
              testID={`role-${c.key}`}
            />
          </Entrance>
        ))}
      </View>
      <Entrance index={5} style={[s.coach, compact && s.coachCompact]}>
        <Pop id={value ?? 'none'}>
          <CoachBubble tone={coach.tone}>
            <Text variant="small" color="ink2" testID="role-coach">
              {coach.before}
              <Text variant="smallStrong" color={coach.tone.deep}>
                {coach.strong}
              </Text>
              {coach.after}
            </Text>
          </CoachBubble>
        </Pop>
      </Entrance>
    </View>
  );
}

const s = StyleSheet.create({
  root: { paddingTop: space.l },
  rootCompact: { paddingTop: space.s },
  title: { maxWidth: 340 },
  choices: { gap: space.m, marginTop: space.xl },
  choicesCompact: { marginTop: space.l, gap: 10 },
  coach: { marginTop: space.xl },
  coachCompact: { marginTop: space.m },
});
