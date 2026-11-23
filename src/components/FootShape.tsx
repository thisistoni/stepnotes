import { memo } from 'react';
import { G, Path, Text as SvgText } from 'react-native-svg';

import { fonts } from '@/lib/theme';
import type { Foot, FootPos, FootStyle } from '@/lib/types';

/**
 * Display font for SVG text (L/R letters, counts). expo-font registers the family under this
 * name on web and native, so the same string works everywhere. Never add a fontWeight to it.
 */
export const SVG_FONT = fonts.display700;
export const SVG_FONT_MEDIUM = fonts.display600;

/**
 * Shoe-print outlines drawn for a LEFT foot, centred on (0,0), toes pointing up (negative y).
 * The big-toe (inner) side is +x. Size: ~1 unit wide, 2.6 units long (y -1.3 … 1.3); right feet
 * are the mirror image. Each print is a sole and a separate heel mark behind a gap, as two
 * sub-paths of ONE path (SHOE_PATH / HEEL_PATH) for ghosts and glyphs; stickers draw the heel's tip
 * separately with a thinner outline (see STICKER_PARTS). On a sticker the gap reads as a white cut.
 */

/**
 * Flat (leader) shoe: rounded toe leaning to the big-toe side, a full outer edge, a straighter
 * inner edge pinched in at the arch, a slanted cut, then a broad rounded heel block.
 */
export const SHOE_PARTS = {
  // toe → inner ball → arch waist → slanted cut → outer edge → toe
  sole:
    'M0.1,-1.3 C0.38,-1.3 0.5,-1.04 0.5,-0.74 ' +
    'C0.5,-0.44 0.36,-0.24 0.28,-0.04 C0.23,0.08 0.23,0.2 0.25,0.3 ' +
    'L-0.38,0.4 C-0.45,0.12 -0.52,-0.22 -0.51,-0.6 ' +
    'C-0.5,-1.04 -0.24,-1.3 0.1,-1.3 Z',
  // heel block, top edge parallel to the cut
  heel:
    'M-0.37,0.55 L0.26,0.45 C0.33,0.74 0.34,1.04 0.2,1.2 ' +
    'C0.1,1.31 -0.14,1.32 -0.26,1.2 C-0.38,1.07 -0.4,0.8 -0.37,0.55 Z',
} as const;

/**
 * High heel (follower): a slim, lopsided leaf (about 2.3× as long as wide). The toe point sits on
 * the big-toe side, the inner edge is flatter, the outer edge fuller, and the sole narrows
 * gradually into a waist that runs almost to the heel tip: a small solid block behind a gap.
 */
export const HEEL_PARTS = {
  // Sampled from a leaf profile (widest ~38% down, inner edge falling linearly, outer edge eased),
  // so it is many short curves: toe point → flatter inner edge → waist → fuller outer edge → toe.
  sole:
    'M0.16,-1.3 C0.17,-1.28 0.23,-1.21 0.25,-1.17 C0.28,-1.13 0.29,-1.09 0.31,-1.04 ' +
    'C0.33,-1 0.34,-0.96 0.35,-0.91 C0.36,-0.86 0.37,-0.81 0.38,-0.76 C0.38,-0.71 0.39,-0.66 0.39,-0.61 ' +
    'C0.38,-0.56 0.38,-0.51 0.37,-0.45 C0.35,-0.4 0.34,-0.34 0.32,-0.28 C0.31,-0.23 0.29,-0.17 0.28,-0.11 ' +
    'C0.26,-0.05 0.25,0.01 0.23,0.07 C0.21,0.13 0.2,0.2 0.18,0.27 C0.16,0.33 0.14,0.4 0.13,0.47 ' +
    'C0.11,0.54 0.1,0.65 0.09,0.69 L-0.15,0.66 ' +
    'C-0.15,0.63 -0.14,0.52 -0.14,0.44 C-0.14,0.37 -0.16,0.3 -0.18,0.23 C-0.2,0.16 -0.23,0.09 -0.25,0.02 ' +
    'C-0.28,-0.04 -0.31,-0.1 -0.33,-0.17 C-0.36,-0.23 -0.38,-0.29 -0.4,-0.35 C-0.41,-0.41 -0.42,-0.47 -0.42,-0.53 ' +
    'C-0.43,-0.58 -0.42,-0.64 -0.41,-0.69 C-0.4,-0.74 -0.38,-0.79 -0.35,-0.83 C-0.33,-0.88 -0.3,-0.93 -0.27,-0.97 ' +
    'C-0.24,-1.01 -0.2,-1.05 -0.16,-1.09 C-0.12,-1.13 -0.09,-1.17 -0.03,-1.2 C0.01,-1.24 0.12,-1.28 0.16,-1.3 Z',
  // heel tip, set a little to the outer side under the heel bone
  heel: 'M-0.22,0.86 L0.15,0.86 C0.17,1 0.16,1.18 0.1,1.25 C0.05,1.3 -0.11,1.3 -0.16,1.25 C-0.22,1.18 -0.24,1 -0.22,0.86 Z',
} as const;

/** The heel tip's sticker outline, as a fraction of the sole's, so the tip reads as a solid block. */
export const HEEL_TIP_OUTLINE = 0.45;

export const SHOE_PATH = `${SHOE_PARTS.sole} ${SHOE_PARTS.heel}`;
export const HEEL_PATH = `${HEEL_PARTS.sole} ${HEEL_PARTS.heel}`;

/** Box (in diagram units) that always contains a sticker footprint centred on (0,0) at any rotation. */
export const FOOT_BOX = 3.3;

/** Sticker geometry (diagram units). */
export const STICKER = {
  /** White outline width */
  outline: 0.16,
  /** Lip offset (straight down on screen) */
  lip: 0.1,
  /** Dashed ghost outline */
  ghostWidth: 0.07,
  ghostDash: '0.17 0.12',
} as const;

interface Props {
  foot: Foot;
  /** Defaults to the origin, upright (the animated layer positions feet with view transforms). */
  pos?: FootPos;
  style: FootStyle;
  /** Fill (solid foot) or dashed stroke (outline foot) */
  color: string;
  /** Colour of the L / R letter; pick one that contrasts with `color`. */
  letterColor?: string;
  opacity?: number;
  showLetter?: boolean;
  /** Dashed outline instead of fill (used for ghost positions and taps) */
  outline?: boolean;
  /** Sticker lip colour under a solid foot (omit for a flat foot) */
  lip?: string;
  /** Sticker outline colour around a solid foot (omit for none) */
  stroke?: string;
  /** Outline width (default STICKER.outline) */
  strokeWidth?: number;
  /** Fill inside a dashed outline */
  ghostFill?: string;
  /** Dashed outline width (default STICKER.ghostWidth) */
  ghostWidth?: number;
  /** Letter size in diagram units (default 0.62); raise it on small diagrams so L / R stay legible */
  letterSize?: number;
  /** Text drawn inside an OUTLINE foot (e.g. the next step's count), in `letterColor` */
  outlineLabel?: string;
}

/** Default L / R letter size (diagram units). */
export const LETTER_SIZE = 0.62;

const ORIGIN: FootPos = { x: 0, y: 0, rot: 0 };

/**
 * Sticker pieces per style: [path, outline width factor]. The flat shoe is one path; the heel's
 * small tip gets its own path with a thinner outline so it reads as a solid block, not a cup.
 */
const STICKER_PARTS: Record<FootStyle, readonly (readonly [string, number])[]> = {
  shoe: [[SHOE_PATH, 1]],
  heel: [
    [HEEL_PARTS.sole, 1],
    [HEEL_PARTS.heel, HEEL_TIP_OUTLINE],
  ],
};

/**
 * One footprint. Solid feet are stickers: an offset darker lip, the coloured face and a white
 * outline (2 paths, 4 for the heel). Outline feet are a single dashed path. Cheap enough for
 * thumbnails.
 */
export const FootShape = memo(function FootShape({
  foot,
  pos = ORIGIN,
  style,
  color,
  letterColor,
  opacity = 1,
  showLetter,
  outline,
  lip,
  stroke,
  strokeWidth = STICKER.outline,
  ghostFill,
  ghostWidth = STICKER.ghostWidth,
  letterSize = LETTER_SIZE,
  outlineLabel,
}: Props) {
  const flip = foot === 'R' ? -1 : 1;
  const d = style === 'shoe' ? SHOE_PATH : HEEL_PATH;
  const place = `translate(${pos.x} ${pos.y}) rotate(${pos.rot})`;

  if (outline) {
    return (
      <G transform={place} opacity={opacity}>
        <G transform={`scale(${flip} 1)`}>
          <Path
            d={d}
            fill={ghostFill ?? 'none'}
            stroke={color}
            strokeWidth={ghostWidth}
            strokeDasharray={STICKER.ghostDash}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
        {!!outlineLabel && letterColor && (
          <SvgText x={0} y={-0.42 + letterSize * 0.36} fontSize={letterSize} fontFamily={SVG_FONT_MEDIUM} fill={letterColor} textAnchor="middle">
            {outlineLabel}
          </SvgText>
        )}
      </G>
    );
  }

  const sw = stroke || lip ? strokeWidth : 0;
  const parts = STICKER_PARTS[style];
  return (
    <G opacity={opacity}>
      {lip && (
        <G transform={`translate(${pos.x} ${pos.y + STICKER.lip}) rotate(${pos.rot}) scale(${flip} 1)`}>
          {parts.map(([pd, k]) => (
            <Path key={k} d={pd} fill={lip} stroke={lip} strokeWidth={sw * k} strokeLinejoin="round" />
          ))}
        </G>
      )}
      <G transform={place}>
        <G transform={`scale(${flip} 1)`}>
          {parts.map(([pd, k]) => (
            <Path key={k} d={pd} fill={color} stroke={stroke ?? 'none'} strokeWidth={sw * k} strokeLinejoin="round" />
          ))}
        </G>
        {showLetter && letterColor && (
          <SvgText x={0} y={-0.48 + letterSize * 0.36} fontSize={letterSize} fontFamily={SVG_FONT} fill={letterColor} textAnchor="middle">
            {foot}
          </SvgText>
        )}
      </G>
    </G>
  );
});
