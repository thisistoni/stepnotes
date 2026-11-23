import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

import { computeStates, stepStartBeats, totalBeats } from '@/lib/pattern';
import { colors, withAlpha, type ColorSet } from '@/lib/theme';
import type { Foot, FootPos, FootStyle, Pattern } from '@/lib/types';

import { FootShape } from './FootShape';

export interface DiagramThumbProps {
  pattern: Pattern;
  /** Dance-style colours (`styleColor(dance.style)`) */
  tone: ColorSet;
  footStyle: FootStyle;
  /**
   * Width / height of the box the thumbnail is drawn in (default 1.66, the library tile). Used to
   * decide whether the whole pattern or only its first half reads better at that shape.
   */
  aspect?: number;
  style?: StyleProp<ViewStyle>;
}

interface Spot {
  foot: Foot;
  pos: FootPos;
  start: boolean;
}

/** Half-extents of a sticker foot (with outline) along / across its length, in units. */
const HALF_LEN = 1.42;
const HALF_W = 0.62;
/** Smallest viewBox (units) so a 2-step pattern is not blown up into giant feet. */
const MIN_W = 4;
const MIN_H = 4.5;

function spotsOf(pattern: Pattern, upto: number): Spot[] {
  const states = computeStates(pattern);
  const out: Spot[] = [
    { foot: 'L', pos: pattern.start.L, start: true },
    { foot: 'R', pos: pattern.start.R, start: true },
  ];
  pattern.steps.slice(0, upto).forEach((s, i) => {
    if (s.kind === 'hold') return;
    const p = states[i + 1].pos[s.foot];
    if (out.some((o) => o.foot === s.foot && Math.abs(o.pos.x - p.x) < 0.05 && Math.abs(o.pos.y - p.y) < 0.05)) return;
    out.push({ foot: s.foot, pos: p, start: false });
  });
  return out;
}

function boxOf(spots: Spot[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const { pos } of spots) {
    // rotated feet: project the half extents onto the axes
    const r = (pos.rot * Math.PI) / 180;
    const hx = Math.abs(Math.sin(r)) * HALF_LEN + Math.abs(Math.cos(r)) * HALF_W;
    const hy = Math.abs(Math.cos(r)) * HALF_LEN + Math.abs(Math.sin(r)) * HALF_W;
    minX = Math.min(minX, pos.x - hx);
    maxX = Math.max(maxX, pos.x + hx);
    minY = Math.min(minY, pos.y - hy);
    maxY = Math.max(maxY, pos.y + hy);
  }
  const grow = (lo: number, hi: number, min: number): [number, number] =>
    hi - lo >= min ? [lo, hi] : [lo - (min - (hi - lo)) / 2, hi + (min - (hi - lo)) / 2];
  [minX, maxX] = grow(minX, maxX, MIN_W);
  [minY, maxY] = grow(minY, maxY, MIN_H);
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Legible miniature of a pattern for cards: start feet as solid stickers, the positions the feet
 * step to as dashed outlines — no arrows, letters or numbers (unreadable at this size).
 *
 * Fitted tightly to the feet. Library tiles are wide and short, so a pattern that travels far
 * forward AND back (Salsa, Cha-Cha) would shrink to tiny feet; when showing only the first half of
 * the pattern (or, for a long routine, its first third) makes the feet clearly bigger, the
 * thumbnail shows that part (like a snapshot of the first move) instead. Pure SVG (no measuring), memoised on the pattern.
 */
export const DiagramThumb = memo(function DiagramThumb({ pattern, tone, footStyle, aspect = 1.66, style }: DiagramThumbProps) {
  const { spots, viewBox } = useMemo(() => {
    const all = spotsOf(pattern, pattern.steps.length);
    let chosen = all;
    const total = totalBeats(pattern);
    if (pattern.steps.length >= 4 && total >= 4) {
      const starts = stepStartBeats(pattern);
      const scaleOf = (b: { w: number; h: number }) => Math.min(aspect / b.w, 1 / b.h);
      let best = 1.25 * scaleOf(boxOf(all));
      // the first half, and for a long routine (several figures) also its first third: the
      // opening figure, e.g. the waltz's box before it starts turning round the floor
      for (const part of total >= 18 ? [2, 3] : [2]) {
        const prefix = spotsOf(pattern, starts.filter((b) => b < total / part - 1e-6).length);
        const sc = scaleOf(boxOf(prefix));
        if (prefix.length > 2 && sc > best) {
          best = sc;
          chosen = prefix;
        }
      }
    }
    const b = boxOf(chosen);
    return { spots: chosen, viewBox: `${b.minX} ${b.minY} ${b.w} ${b.h}` };
  }, [pattern, aspect]);

  const ghost = withAlpha(colors.ink, 0.32);
  return (
    <View style={[s.box, style]} pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox={viewBox}>
        {spots
          .filter((f) => !f.start)
          .map((f, i) => (
            <FootShape
              key={`g${i}`}
              foot={f.foot}
              pos={f.pos}
              style={footStyle}
              color={ghost}
              ghostFill={withAlpha(colors.card, 0.55)}
              ghostWidth={0.12}
              outline
            />
          ))}
        {spots
          .filter((f) => f.start)
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
