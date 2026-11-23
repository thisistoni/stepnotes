import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';

import { Icon, IconButton, ProgressRing, Text, useReducedMotion } from '@/components/ui';
import { colors, motion, type ColorSet } from '@/lib/theme';

interface Props {
  playing: boolean;
  progress: SharedValue<number>;
  tone: ColorSet & { light: string; border: string };
  canPlay: boolean;
  canPrev: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** short screens: smaller buttons */
  compact?: boolean;
}

const SIZE = { regular: { h: 84, ring: 82, core: 62, side: 52 }, compact: { h: 72, ring: 70, core: 54, side: 46 } };
/** Height of the transport row. */
export function transportHeight(compact: boolean) {
  return (compact ? SIZE.compact : SIZE.regular).h;
}

/** Play ↔ pause icons cross-fade with a small 0.94 → 1 spring. */
function PlayPauseIcon({ playing, color }: { playing: boolean; color: string }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(playing ? 1 : 0);
  const s = useSharedValue(1);
  useEffect(() => {
    p.set(withTiming(playing ? 1 : 0, { duration: motion.fast }));
    if (!reduced) s.set(withSequence(withTiming(0.94, { duration: 60 }), withSpring(1, motion.pop)));
  }, [playing, reduced, p, s]);
  const playStyle = useAnimatedStyle(() => ({ opacity: 1 - p.get(), transform: [{ scale: s.get() }] }));
  const pauseStyle = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ scale: s.get() }] }));
  return (
    <View style={st.iconBox}>
      <Animated.View style={[st.abs, playStyle]}>
        {/* the play triangle is optically centred a little to the right */}
        <View style={st.playNudge}>
          <Icon name="play" size={30} color={color} />
        </View>
      </Animated.View>
      <Animated.View style={[st.abs, pauseStyle]}>
        <Icon name="pause" size={30} color={color} />
      </Animated.View>
    </View>
  );
}

/** previous · big round play/pause inside the progress ring · next */
export const Transport = memo(function Transport({ playing, progress, tone, canPlay, canPrev, onToggle, onPrev, onNext, compact = false }: Props) {
  const z = compact ? SIZE.compact : SIZE.regular;
  return (
    <View style={st.wrap}>
      <View style={[st.row, { height: z.h }]}>
        <IconButton icon="skip-prev" label="Previous step" size={z.side} iconSize={22} onPress={onPrev} disabled={!canPlay || !canPrev} testID="prev" />
        <ProgressRing progress={progress} size={z.ring} strokeWidth={5} tone={tone} trackColor={tone.tint}>
          <IconButton
            icon="play"
            label={playing ? 'Pause' : 'Play'}
            variant="primary"
            shape="round"
            size={z.core}
            tone={tone}
            onPress={onToggle}
            disabled={!canPlay}
            testID="play"
          >
            <PlayPauseIcon playing={playing} color={canPlay ? tone.on : colors.ink3} />
          </IconButton>
        </ProgressRing>
        <IconButton icon="skip-next" label="Next step" size={z.side} iconSize={22} onPress={onNext} disabled={!canPlay} testID="next" />
      </View>
      {!canPlay && (
        <Text variant="small" color="ink2" align="center" style={st.hint} testID="play-disabled-hint">
          This dance has no steps yet. Add some in the editor to play it.
        </Text>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  wrap: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  iconBox: { width: 30, height: 30 },
  abs: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  playNudge: { marginLeft: 3 },
  hint: { marginTop: 2, maxWidth: 300 },
});
