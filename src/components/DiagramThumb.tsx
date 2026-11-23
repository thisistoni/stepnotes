import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

import { layoutChart } from '@/lib/chartLayout';
import { computeStates } from '@/lib/pattern';
import { colors, withAlpha, type ColorSet } from '@/lib/theme';
import type { FootStyle, Pattern } from '@/lib/types';

import { FootShape } from './FootShape';

export interface DiagramThumbProps {
  pattern: Pattern;
  /** Dance-style colours (`styleColor(dance.style)`) */
  tone: ColorSet;
  footStyle: FootStyle;
  style?: StyleProp<ViewStyle>;
}

/**
 * Legible miniature of a pattern for cards: start feet as solid stickers, every other position
 * as a dashed outline — no arrows, letters or numbers (unreadable at this size). Pure SVG (no measuring), memoised:
 * re-renders only when the pattern object changes. Fills its parent box.
 */
export const DiagramThumb = memo(function DiagramThumb({ pattern, tone, footStyle, style }: DiagramThumbProps) {
  const layout = useMemo(() => layoutChart(pattern, computeStates(pattern), { labels: false }), [pattern]);
  // fit the FEET only (chart bounds include arrow / label room, which makes thumbnails tiny),
  // with a minimum size so a 2-step pattern is not blown up
  const xs = layout.feet.map((f) => f.pos.x);
  const ys = layout.feet.map((f) => f.pos.y);
  let minX = Math.min(...xs) - 0.8;
  let maxX = Math.max(...xs) + 0.8;
  let minY = Math.min(...ys) - 1.5;
  let maxY = Math.max(...ys) + 1.5;
  const grow = (lo: number, hi: number, min: number): [number, number] =>
    hi - lo >= min ? [lo, hi] : [lo - (min - (hi - lo)) / 2, hi + (min - (hi - lo)) / 2];
  [minX, maxX] = grow(minX, maxX, 4);
  [minY, maxY] = grow(minY, maxY, 4.5);
  const viewBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  const ghost = withAlpha(colors.ink, 0.3);
  return (
    <View style={[s.box, style]} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={viewBox}>
        {layout.feet
          .filter((f) => !f.isStart)
          .map((f, i) => (
            <FootShape
              key={`g${i}`}
              foot={f.foot}
              pos={f.pos}
              style={footStyle}
              color={ghost}
              ghostFill={withAlpha(colors.card, 0.5)}
              ghostWidth={0.11}
              outline
            />
          ))}
        {layout.feet
          .filter((f) => f.isStart)
          .map((f, i) => (
            <FootShape
              key={`s${i}`}
              foot={f.foot}
              pos={f.pos}
              style={footStyle}
              color={tone.base}
              lip={tone.lip}
              stroke={colors.card}
              strokeWidth={0.2}
            />
          ))}
      </Svg>
    </View>
  );
});

const s = StyleSheet.create({
  box: { flex: 1 },
});
