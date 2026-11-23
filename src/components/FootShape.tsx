import { G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Foot, FootPos, FootStyle } from '@/lib/types';
import { Platform } from 'react-native';

const SVG_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : undefined;

/**
 * Foot outlines drawn for a LEFT foot, centred on (0,0), toes pointing up (negative y).
 * Size: ~1 unit wide, 2.6 units long. Right feet are mirrored.
 */
const SHOE_SOLE =
  'M0.05,-1.3 C0.4,-1.3 0.52,-0.9 0.48,-0.5 C0.45,-0.1 0.34,0.2 0.3,0.35 L-0.32,0.35 ' +
  'C-0.4,0.1 -0.5,-0.3 -0.48,-0.7 C-0.46,-1.1 -0.3,-1.3 0.05,-1.3 Z';
const SHOE_HEEL =
  'M-0.3,0.5 L0.3,0.5 C0.34,0.8 0.32,1.15 0.1,1.26 C0,1.3 -0.1,1.3 -0.18,1.25 C-0.34,1.12 -0.34,0.8 -0.3,0.5 Z';

const HEEL_SOLE =
  'M0.05,-1.3 C0.45,-1.25 0.54,-0.7 0.44,-0.35 C0.34,0 0.16,0.28 0,0.28 ' +
  'C-0.2,0.28 -0.36,0 -0.45,-0.35 C-0.54,-0.75 -0.36,-1.3 0.05,-1.3 Z';

interface Props {
  foot: Foot;
  pos: FootPos;
  style: FootStyle;
  color: string;
  opacity?: number;
  showLetter?: boolean;
  /** Dashed outline instead of fill (used for ghost positions) */
  outline?: boolean;
}

export function FootShape({ foot, pos, style, color, opacity = 1, showLetter, outline }: Props) {
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
          <>
            <Path d={HEEL_SOLE} {...fillProps} />
            <Rect x={-0.1} y={1.02} width={0.2} height={0.24} rx={0.05} {...fillProps} />
          </>
        )}
      </G>
      {showLetter && !outline && (
        <SvgText
          x={0}
          y={-0.3}
          fontSize={0.62}
          fontWeight="700"
          fontFamily={SVG_FONT}
          fill="#FFFFFF"
          textAnchor="middle"
          opacity={0.9}
        >
          {foot}
        </SvgText>
      )}
    </G>
  );
}
