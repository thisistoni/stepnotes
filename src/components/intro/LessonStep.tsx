import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { StepDiagram } from '@/components/StepDiagram';
import { Entrance, Icon, IconButton, Stage, Text } from '@/components/ui';
import { DEFAULT_FOOT_STYLE, ROLE_COLOR, roleTheme, space } from '@/lib/theme';
import type { Role } from '@/lib/types';

import { demoPattern } from './demo';
import { Legend } from './Legend';
import { useDemoLesson } from './useDemoLesson';

/** The stage gives way first on short screens; it never grows into a poster on tall ones. */
const STAGE_MIN = 128;
const STAGE_MAX = 420;

/** Step 3 (and the stand-alone lesson): a live demo on the real diagram + a legend that follows it. */
export function LessonStep({ role }: { role: Role }) {
  const pattern = useMemo(() => demoPattern(role), [role]);
  const theme = roleTheme(role);
  const footStyle = DEFAULT_FOOT_STYLE[role];
  const tone = ROLE_COLOR[role];
  const { beat, running, toggle, phase, dip } = useDemoLesson(pattern);
  const dipStyle = useAnimatedStyle(() => ({ opacity: dip.get() }));
  // short phones: every pixel the title gives back goes to the stage
  const compact = useWindowDimensions().height < 700;

  return (
    <View style={[s.root, compact && s.rootCompact]} testID="intro-lesson">
      <Entrance index={0}>
        <Text variant={compact ? 'heading' : 'title'} accessibilityRole="header">
          How to read the footprints
        </Text>
      </Entrance>
      <Entrance index={1} style={[s.stageWrap, compact && s.stageWrapCompact]}>
        <Stage
          tone={tone}
          style={s.stage}
          padding={space.m}
          bottomRight={
            <IconButton
              icon={running ? 'pause' : 'play'}
              label={running ? 'Pause the demo' : 'Play the demo'}
              variant="primary"
              tone={tone}
              shape="round"
              onPress={toggle}
              testID="lesson-play"
            >
              <Icon name={running ? 'pause' : 'play'} size={20} color={tone.on} />
            </IconButton>
          }
          bottomLeft={
            <View style={[s.tag, { backgroundColor: tone.wash }]} accessible accessibilityLabel="Facing up the screen">
              <Icon name="arrow-up" size={14} color={tone.deep} strokeWidth={2.8} />
              <Text variant="overline" color={tone.deep}>
                Facing
              </Text>
            </View>
          }
          testID="lesson-stage"
        >
          {(area) => (
            <Animated.View style={[s.diagram, dipStyle]}>
              <StepDiagram pattern={pattern} theme={theme} footStyle={footStyle} mode="live" beat={beat} maxHeight={area.height} />
            </Animated.View>
          )}
        </Stage>
      </Entrance>
      <Entrance index={2}>
        <Legend phase={phase} role={role} footStyle={footStyle} />
      </Entrance>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingTop: space.m },
  rootCompact: { paddingTop: space.xxs },
  stageWrap: { flex: 1, minHeight: STAGE_MIN, maxHeight: STAGE_MAX, marginTop: space.l, marginBottom: space.s },
  stageWrapCompact: { marginTop: space.m },
  stage: { flex: 1 },
  diagram: { width: '100%', alignItems: 'center' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
});
