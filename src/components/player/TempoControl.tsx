import { memo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Icon, LipSurface, Slider, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, lip, radius, type ColorSet } from '@/lib/theme';

interface Props {
  /** tempo multiplier (1 = the dance's own bpm) */
  speed: number;
  bpm: number;
  tone: ColorSet;
  /** live while dragging */
  onChange: (speed: number) => void;
  /** once, when the user lets go (persist) */
  onCommit: (speed: number) => void;
}

const MIN = 50;
const MAX = 125;

/** Tempo slider 50–125 % in 5 % steps; the "75% · 63 bpm" label resets to 100 % when tapped. */
export const TempoControl = memo(function TempoControl({ speed, bpm, tone, onChange, onCommit }: Props) {
  const pct = Math.min(MAX, Math.max(MIN, Math.round((speed * 100) / 5) * 5));
  const effective = Math.round(bpm * (pct / 100));
  const narrow = useWindowDimensions().width < 360;
  const t = useT();
  const [pressed, setPressed] = useState(false);
  return (
    <LipSurface radius={radius.md} lipDepth={lip.md} faceStyle={s.face}>
      <View style={s.label} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="tempo" size={18} color={colors.ink2} strokeWidth={2.4} />
        {!narrow && (
          <Text variant="smallStrong" color="ink2">
            {t.tempo.label}
          </Text>
        )}
      </View>
      <Slider
        value={pct}
        min={MIN}
        max={MAX}
        step={5}
        label={t.tempo.label}
        formatValue={(v) => t.tempo.value(v, Math.round(bpm * (v / 100)))}
        onChange={(v) => onChange(v / 100)}
        onChangeEnd={(v) => onCommit(v / 100)}
        tone={tone}
        style={s.slider}
        testID="tempo-slider"
      />
      <Pressable
        onPress={() => {
          if (pct !== 100) {
            onChange(1);
            onCommit(1);
          }
        }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t.tempo.current(pct, effective)}
        accessibilityHint={pct !== 100 ? t.tempo.resetHint : undefined}
        style={[s.value, pressed && s.pressed]}
        testID="tempo-label"
      >
        <Text variant="numeralSm" style={s.pct}>
          {t.units.percent(pct)}
        </Text>
        <Text variant="small" color="ink3" style={s.bpm}>
          {` · ${t.units.bpm(effective)}`}
        </Text>
      </Pressable>
    </LipSurface>
  );
});

const s = StyleSheet.create({
  face: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 6, borderWidth: 2, borderColor: colors.cardBorder },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slider: { flex: 1 },
  value: { flexDirection: 'row', alignItems: 'baseline', minHeight: 44, alignContent: 'center', paddingTop: 13, paddingLeft: 2, borderRadius: 10 },
  pressed: { opacity: 0.55 },
  pct: { fontSize: 16, lineHeight: 20 },
  bpm: { lineHeight: 20 },
});
