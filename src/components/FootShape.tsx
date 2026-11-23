import { memo } from 'react';
import { Platform } from 'react-native';
import { G, Path, Text as SvgText } from 'react-native-svg';

import type { Foot, FootPos, FootStyle } from '@/lib/types';

export const SVG_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : undefined;

/**
 * Foot outlines drawn for a LEFT foot, centred on (0,0), toes pointing up (negative y).
 * Size: ~1 unit wide, 2.6 units long (y -1.3 … 1.3). Right feet are mirrored.
 */
const SHOE_SOLE =
  'M0.05,-1.3 C0.4,-1.3 0.52,-0.9 0.48,-0.5 C0.45,-0.1 0.34,0.2 0.3,0.35 L-0.32,0.35 ' +
  'C-0.4,0.1 -0.5,-0.3 -0.48,-0.7 C-0.46,-1.1 -0.3,-1.3 0.05,-1.3 Z';
const SHOE_HEEL =
  'M-0.3,0.5 L0.3,0.5 C0.34,0.8 0.32,1.15 0.1,1.26 C0,1.3 -0.1,1.3 -0.18,1.25 C-0.34,1.12 -0.34,0.8 -0.3,0.5 Z';

/**
 * Heeled shoe as ONE outline: forefoot pad tapering through the shank into a block heel, so the
 * heel reads as part of the shoe instead of a detached dot.
 */
const HEEL_SHOE =
  'M0.05,-1.3 C0.45,-1.25 0.54,-0.7 0.45,-0.35 ' +
  'C0.39,-0.1 0.28,0.12 0.2,0.42 ' + // inner edge narrows into the shank
  'C0.17,0.6 0.16,0.78 0.16,0.9 L0.17,1.12 ' + // shank flows into a block heel
  'C0.17,1.24 0.1,1.28 0.01,1.28 C-0.09,1.28 -0.16,1.24 -0.16,1.12 ' +
  'L-0.15,0.9 C-0.15,0.78 -0.17,0.6 -0.2,0.42 ' +
  'C-0.28,0.14 -0.4,-0.05 -0.45,-0.35 ' +
  'C-0.54,-0.75 -0.36,-1.3 0.05,-1.3 Z';

/** Box (in diagram units) that always contains a footprint centred on (0,0) at any rotation. */
export const FOOT_BOX = 2.8;

interface Props {
  foot: Foot;
  /** Defaults to the origin, upright (the animated layer positions feet with view transforms). */
  pos?: FootPos;
  style: FootStyle;
  color: string;
  /** Colour of the L / R letter; pick one that contrasts with `color`. */
  letterColor?: string;
  opacity?: number;
  showLetter?: boolean;
  /** Dashed outline instead of fill (used for ghost positions and taps) */
  outline?: boolean;
}

const ORIGIN: FootPos = { x: 0, y: 0, rot: 0 };

export const FootShape = memo(function FootShape({
  foot,
  pos = ORIGIN,
  style,
  color,
  letterColor,
  opacity = 1,
  showLetter,
  outline,
}: Props) {
  const flip = foot === 'R' ? -1 : 1;
  const fillProps = outline
    ? { fill: 'none', stroke: color, strokeWidth: 0.06, strokeDasharray: '0.15 0.12' }
    : { fill: color };

  return (
    <G transform={`translate(${pos.x} ${pos.y}) rotate(${pos.rot})`} opacity={opacity}>
      <G transform={`scale(${flip} 1)`}>
        {style === 'shoe' ? (
          <>
            <Path d={SHOE_SOLE} {...fillProps} />
            <Path d={SHOE_HEEL} {...fillProps} />
          </>
        ) : (
          <Path d={HEEL_SHOE} {...fillProps} strokeLinejoin="round" />
        )}
      </G>
      {showLetter && !outline && letterColor && (
        <SvgText x={0} y={-0.3} fontSize={0.62} fontWeight="700" fontFamily={SVG_FONT} fill={letterColor} textAnchor="middle">
          {foot}
        </SvgText>
      )}
    </G>
  );
});
