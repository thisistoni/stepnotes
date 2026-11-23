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
 * Foot outlines drawn for a LEFT foot, centred on (0,0), toes pointing up (negative y).
 * Size: ~1 unit wide, 2.6 units long (y -1.3 … 1.3). Right feet are mirrored.
 * The flat shoe is two sub-paths (sole + heel) in ONE path so a sticker costs two <Path>s.
 */
export const SHOE_PATH =
  'M0.05,-1.3 C0.4,-1.3 0.52,-0.9 0.48,-0.5 C0.45,-0.1 0.34,0.2 0.3,0.35 L-0.32,0.35 ' +
  'C-0.4,0.1 -0.5,-0.3 -0.48,-0.7 C-0.46,-1.1 -0.3,-1.3 0.05,-1.3 Z ' +
  'M-0.3,0.5 L0.3,0.5 C0.34,0.8 0.32,1.15 0.1,1.26 C0,1.3 -0.1,1.3 -0.18,1.25 C-0.34,1.12 -0.34,0.8 -0.3,0.5 Z';

/**
 * Heeled shoe as ONE outline: forefoot pad tapering through the shank into a block heel, so the
 * heel reads as part of the shoe instead of a detached dot.
 */
export const HEEL_PATH =
  'M0.05,-1.3 C0.45,-1.25 0.54,-0.7 0.45,-0.35 ' +
  'C0.39,-0.1 0.28,0.12 0.2,0.42 ' + // inner edge narrows into the shank
  'C0.17,0.6 0.16,0.78 0.16,0.9 L0.17,1.12 ' + // shank flows into a block heel
  'C0.17,1.24 0.1,1.28 0.01,1.28 C-0.09,1.28 -0.16,1.24 -0.16,1.12 ' +
  'L-0.15,0.9 C-0.15,0.78 -0.17,0.6 -0.2,0.42 ' +
  'C-0.28,0.14 -0.4,-0.05 -0.45,-0.35 ' +
  'C-0.54,-0.75 -0.36,-1.3 0.05,-1.3 Z';

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
