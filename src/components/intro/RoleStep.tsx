import { useEffect, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { ChoiceRow, CoachBubble, Entrance, Text, useReducedMotion } from '@/components/ui';
import { emphasis, useT } from '@/lib/i18n';
import { motion, ROLE_COLOR, space, STYLE_COLORS, type ColorSet } from '@/lib/theme';
import type { IconName } from '@/components/Icon';

export type RoleChoice = 'leader' | 'follower' | 'both';

const CHOICES: { key: RoleChoice; icon: IconName; tone: ColorSet }[] = [
  { key: 'leader', icon: 'flat-shoe', tone: ROLE_COLOR.leader },
  { key: 'follower', icon: 'heel', tone: ROLE_COLOR.follower },
  { key: 'both', icon: 'footprints', tone: STYLE_COLORS.bachata },
];

/** Coach bubble colour per selection (the text, with one **emphasised** phrase, is in the dictionary). */
const COACH_TONE: Record<RoleChoice | 'none', ColorSet> = {
  none: STYLE_COLORS.bachata,
  leader: ROLE_COLOR.leader,
  follower: ROLE_COLOR.follower,
  both: STYLE_COLORS.bachata,
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
  const t = useT();
  const key = value ?? 'none';
  const tone = COACH_TONE[key];
  // short phones: a smaller title keeps the coach bubble on screen
  const compact = useWindowDimensions().height < 700;
  return (
    <View style={[s.root, compact && s.rootCompact]} testID="intro-role">
      <Entrance index={0}>
        <Text variant={compact ? 'title' : 'display'} accessibilityRole="header" style={s.title}>
          {t.intro.roleTitle}
        </Text>
      </Entrance>
      <View style={[s.choices, compact && s.choicesCompact]} accessibilityRole="radiogroup">
        {CHOICES.map((c, i) => (
          <Entrance key={c.key} index={2 + i}>
            <ChoiceRow
              title={t.intro.choices[c.key].title}
              subtitle={t.intro.choices[c.key].subtitle}
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
          <CoachBubble tone={tone}>
            <Text variant="small" color="ink2" testID="role-coach">
              {emphasis(t.intro.coach[key]).map((part, i) =>
                part.strong ? (
                  <Text key={i} variant="smallStrong" color={tone.deep}>
                    {part.text}
                  </Text>
                ) : (
                  part.text
                ),
              )}
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
