/**
 * Waltzy icon set: rounded 2.25px strokes on a 24×24 grid, drawn with react-native-svg so
 * icons are identical on iOS, Android and web and never flash blank (no icon font to load).
 *
 *   <Icon name="play" size={24} color={colors.ink} />
 *
 * Add an icon: append to ICONS (paths in a 24×24 box). `fill: true` draws a solid shape,
 * `knock: true` draws in `knockColor` on top (e.g. the × inside a filled circle).
 */
import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { colors } from '@/lib/theme';

import { HEEL_PARTS, SHOE_PARTS } from './FootShape';

interface Part {
  d: string;
  /** solid shape instead of a stroke */
  fill?: boolean;
  /** drawn in `knockColor` (cut-out look) */
  knock?: boolean;
  /** stroke width override (24-unit grid) */
  w?: number;
  /** SVG transform for this part */
  t?: string;
  dash?: string;
}

/**
 * Footprint glyphs built from the diagram's own geometry (see FootShape): left foot, toes up.
 * `foot(parts, transform)` draws the sole and the heel mark; the heel is nudged back by `gap`
 * units so the cut stays at least ~1px wide at icon sizes (the diagram's gap is filled by the
 * sticker outline instead).
 */
const foot = (parts: { sole: string; heel: string }, t: string, gap = 0.12): Part[] => [
  { d: parts.sole, fill: true, t: `${t} translate(0 ${-gap / 2})` },
  { d: parts.heel, fill: true, t: `${t} translate(0 ${gap / 2})` },
];

const ICONS = {
  back: [{ d: 'M15 5l-7 7 7 7' }],
  close: [{ d: 'M6.5 6.5l11 11M17.5 6.5l-11 11' }],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  minus: [{ d: 'M5 12h14' }],
  search: [{ d: 'M17.5 11a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z' }, { d: 'M16 16l4.5 4.5' }],
  'x-circle': [
    { d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', fill: true },
    { d: 'M9 9l6 6M15 9l-6 6', knock: true, w: 2.2 },
  ],
  play: [{ d: 'M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.7L9.5 4.6A1 1 0 0 0 8 5.5z', fill: true }],
  pause: [
    { d: 'M7.6 5h1A1.6 1.6 0 0 1 10.2 6.6v10.8A1.6 1.6 0 0 1 8.6 19h-1A1.6 1.6 0 0 1 6 17.4V6.6A1.6 1.6 0 0 1 7.6 5z', fill: true },
    { d: 'M15.4 5h1A1.6 1.6 0 0 1 18 6.6v10.8A1.6 1.6 0 0 1 16.4 19h-1a1.6 1.6 0 0 1-1.6-1.6V6.6A1.6 1.6 0 0 1 15.4 5z', fill: true },
  ],
  'skip-prev': [
    { d: 'M6 5v14', w: 2.8 },
    { d: 'M18.5 6.3v11.4a1 1 0 0 1-1.6.8L9.4 12.8a1 1 0 0 1 0-1.6l7.5-5.7a1 1 0 0 1 1.6.8z', fill: true },
  ],
  'skip-next': [
    { d: 'M18 5v14', w: 2.8 },
    { d: 'M5.5 6.3v11.4a1 1 0 0 0 1.6.8l7.5-5.7a1 1 0 0 0 0-1.6L7.1 5.5a1 1 0 0 0-1.6.8z', fill: true },
  ],
  pencil: [{ d: 'M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z' }, { d: 'M13.5 7l3 3' }],
  more: [
    { d: 'M7.8 12a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0z', fill: true },
    { d: 'M13.8 12a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0z', fill: true },
    { d: 'M19.8 12a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0z', fill: true },
  ],
  trash: [
    { d: 'M4 7h16' },
    { d: 'M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7' },
    { d: 'M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7' },
    { d: 'M10 11v5M14 11v5' },
  ],
  copy: [
    { d: 'M11 8h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z' },
    { d: 'M16 8V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h1' },
  ],
  share: [{ d: 'M12 14.5V4' }, { d: 'M7.5 8.5L12 4l4.5 4.5' }, { d: 'M5 13v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4' }],
  globe: [
    { d: 'M20.5 12a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0z' },
    { d: 'M4 9h16M4 15h16' },
    { d: 'M12 3.5c-2.3 2.4-3.4 5.2-3.4 8.5s1.1 6.1 3.4 8.5c2.3-2.4 3.4-5.2 3.4-8.5S14.3 5.9 12 3.5z' },
  ],
  import: [{ d: 'M12 4v10.5' }, { d: 'M7.5 10L12 14.5l4.5-4.5' }, { d: 'M5 15v2a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-2' }],
  clipboard: [
    { d: 'M9 5.5H7.5A2.5 2.5 0 0 0 5 8v9.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V8a2.5 2.5 0 0 0-2.5-2.5H15' },
    { d: 'M10 3.5h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z' },
  ],
  undo: [{ d: 'M9 14L4 9l5-5' }, { d: 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11' }],
  redo: [{ d: 'M15 14l5-5-5-5' }, { d: 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13' }],
  check: [{ d: 'M5 12.5l4.5 4.5L19 7.5' }],
  'chevron-right': [{ d: 'M9 5l7 7-7 7' }],
  'chevron-left': [{ d: 'M15 5l-7 7 7 7' }],
  'chevron-down': [{ d: 'M5 9l7 7 7-7' }],
  'chevron-up': [{ d: 'M5 15l7-7 7 7' }],
  'arrow-up': [{ d: 'M12 19V5' }, { d: 'M6 11l6-6 6 6' }],
  'arrow-right': [{ d: 'M5 12h14' }, { d: 'M13 6l6 6-6 6' }],
  'rotate-left': [{ d: 'M4.5 4.5V9H9' }, { d: 'M4.9 9A7.5 7.5 0 1 1 5 15' }],
  'rotate-right': [{ d: 'M19.5 4.5V9H15' }, { d: 'M19.1 9A7.5 7.5 0 1 0 19 15' }],
  /** Recenter the view (crosshair) */
  recenter: [
    { d: 'M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0z' },
    { d: 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3' },
    { d: 'M12 12v.01', w: 3.2 },
  ],
  loop: [{ d: 'M17 3l3 3-3 3' }, { d: 'M4 11V9a3 3 0 0 1 3-3h13' }, { d: 'M7 21l-3-3 3-3' }, { d: 'M20 13v2a3 3 0 0 1-3 3H4' }],
  volume: [{ d: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z' }, { d: 'M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11' }],
  'volume-off': [{ d: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z' }, { d: 'M16 9.5l5 5M21 9.5l-5 5' }],
  mirror: [{ d: 'M12 3v18', dash: '2 3' }, { d: 'M9 7L4 17h5z' }, { d: 'M15 7l5 10h-5z' }],
  vibrate: [
    { d: 'M9.5 4h5A1.5 1.5 0 0 1 16 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 18.5v-13A1.5 1.5 0 0 1 9.5 4z' },
    { d: 'M4.5 9v6M19.5 9v6' },
  ],
  letters: [{ d: 'M4 6v12h5' }, { d: 'M13 18V6h3.5a3 3 0 0 1 0 6H13' }, { d: 'M16.5 12l3.5 6' }],
  chart: [
    { d: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z' },
    { d: 'M4 12h16M12 4v16' },
  ],
  info: [{ d: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z' }, { d: 'M12 11v5.5' }, { d: 'M12 7.6v.01', w: 2.8 }],
  alert: [
    { d: 'M10.3 5.2a2 2 0 0 1 3.4 0l7 12A2 2 0 0 1 19 20.2H5a2 2 0 0 1-1.7-3z' },
    { d: 'M12 10v4' },
    { d: 'M12 17v.01', w: 2.8 },
  ],
  tempo: [{ d: 'M4 16a8 8 0 1 1 16 0' }, { d: 'M12 16l3.5-4.5' }],
  video: [
    { d: 'M6.5 6h7A2.5 2.5 0 0 1 16 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 15.5v-7A2.5 2.5 0 0 1 6.5 6z' },
    { d: 'M16 10.5l4-2.5v8l-4-2.5z' },
  ],
  'flat-shoe': foot(SHOE_PARTS, 'translate(12 12) rotate(12) scale(6.9)', 0.18),
  heel: foot(HEEL_PARTS, 'translate(12 12) rotate(12) scale(6.9)', 0.18),
  // a left and a right shoe, walking
  footprints: [
    ...foot(SHOE_PARTS, 'translate(8 13.2) rotate(-8) scale(5.2)', 0.2),
    ...foot(SHOE_PARTS, 'translate(16 10.6) rotate(8) scale(-5.2 5.2)', 0.2),
  ],
} satisfies Record<string, Part[]>;

export type IconName = keyof typeof ICONS;

/** Icons keep their size inside flex rows. */
const NO_SHRINK = { flexShrink: 0 } as const;
export interface IconProps {
  name: IconName;
  /** Box size in px (default 24) */
  size?: number;
  /** Stroke / fill colour (default ink) */
  color?: string;
  /** Colour of cut-out parts (default card white) */
  knockColor?: string;
  /** Stroke width on the 24-unit grid (default 2.25) */
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/** One icon from the Waltzy set. Decorative by default (hidden from screen readers). */
export const Icon = memo(function Icon({
  name,
  size = 24,
  color = colors.ink,
  knockColor = colors.card,
  strokeWidth = 2.25,
  style,
}: IconProps) {
  const parts: Part[] = ICONS[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={[NO_SHRINK, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {parts.map((p, i) => {
        const c = p.knock ? knockColor : color;
        const path = p.fill ? (
          <Path key={i} d={p.d} fill={c} />
        ) : (
          <Path
            key={i}
            d={p.d}
            fill="none"
            stroke={c}
            strokeWidth={p.w ?? strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={p.dash}
          />
        );
        return p.t ? (
          <G key={i} transform={p.t}>
            {path}
          </G>
        ) : (
          path
        );
      })}
    </Svg>
  );
});
