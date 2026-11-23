import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

import { colors, type ColorSet } from '@/lib/theme';
import type { Foot, FootStyle } from '@/lib/types';

import { FootShape } from '../FootShape';

export interface FootStickerProps {
  foot?: Foot;
  footStyle?: FootStyle;
  /** Face + lip colours (e.g. `styleColor('Salsa')`, `ROLE_COLOR.follower`) */
  tone: Pick<ColorSet, 'base' | 'lip'>;
  /** Height in px (width is ~45%) */
  size?: number;
  /** Rotation in degrees */
  rotate?: number;
  /** Outline colour (default white) */
  outline?: string;
  style?: StyleProp<ViewStyle>;
}

/** A single sticker footprint for illustrations (avatars, empty states, intro). */
export const FootSticker = memo(function FootSticker({
  foot = 'L',
  footStyle = 'shoe',
  tone,
  size = 40,
  rotate = 0,
  outline = colors.card,
  style,
}: FootStickerProps) {
  const w = size * 0.55;
  return (
    <Svg width={w} height={size} viewBox="-0.85 -1.55 1.7 3.1" style={style} accessible={false} pointerEvents="none">
      <FootShape
        foot={foot}
        style={footStyle}
        pos={{ x: 0, y: -0.05, rot: rotate }}
        color={tone.base}
        lip={tone.lip}
        stroke={outline}
        strokeWidth={0.17}
      />
    </Svg>
  );
});
