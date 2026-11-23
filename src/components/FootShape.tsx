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
 * sub-paths of ONE path so a sticker still costs two <Path>s. The gap is narrower than the white
 * sticker outline, so on a sticker it reads as a white cut, and dashed ghosts show both parts.
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
 * High heel (follower): an almond / leaf-shaped sole with a softly pointed toe on the big-toe
 * side, widest at the ball, tapering into a narrow shank, then a small separate heel tip.
 */
export const HEEL_PARTS = {
  // pointed toe → inner ball → straight inner edge into the shank → fuller outer edge → toe
  sole:
    'M0.24,-1.3 C0.3,-1.22 0.4,-1.08 0.45,-0.9 C0.49,-0.78 0.49,-0.7 0.47,-0.58 ' +
    'C0.43,-0.24 0.18,0.22 0.06,0.62 ' +
    'L-0.14,0.62 C-0.2,0.3 -0.43,0 -0.49,-0.4 ' +
    'C-0.55,-0.78 -0.42,-1.08 -0.05,-1.25 C0.06,-1.29 0.16,-1.3 0.24,-1.3 Z',
  // heel tip, set a little to the outer side under the heel bone; a touch wider than the shank
  // so it survives the white outline at small sizes
  heel: 'M-0.23,0.8 L0.15,0.8 C0.17,0.98 0.16,1.2 0.08,1.27 C0.02,1.31 -0.1,1.31 -0.16,1.27 C-0.24,1.2 -0.25,0.98 -0.23,0.8 Z',
} as const;

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
 * One footprint. Solid feet are stickers: an offset darker lip, the coloured face and a white
 * outline (2 paths). Outline feet are a single dashed path. Cheap enough for thumbnails.
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
  return (
    <G opacity={opacity}>
      {lip && (
        <G transform={`translate(${pos.x} ${pos.y + STICKER.lip}) rotate(${pos.rot}) scale(${flip} 1)`}>
          <Path d={d} fill={lip} stroke={lip} strokeWidth={sw} strokeLinejoin="round" />
        </G>
      )}
      <G transform={place}>
        <G transform={`scale(${flip} 1)`}>
          <Path d={d} fill={color} stroke={stroke ?? 'none'} strokeWidth={sw} strokeLinejoin="round" />
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
