import createQr from 'qrcode-generator';
import { memo, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '@/lib/theme';

/** Light modules around the code (the QR spec asks for 4). */
const QUIET = 4;

/** The QR matrix for `text` (error correction M, smallest version that fits). Pure JS. */
export function qrMatrix(text: string): boolean[][] {
  const qr = createQr(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** One path for all dark modules: a row's adjacent modules merge into one rectangle. */
function toPath(m: boolean[][]) {
  let d = '';
  m.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      let end = c;
      while (end + 1 < row.length && row[end + 1]) end++;
      d += `M${c + QUIET} ${r + QUIET}h${end - c + 1}v1h${-(end - c + 1)}z`;
      c = end;
    }
  });
  return d;
}

export interface QrCodeProps {
  value: string;
  /** Edge length in px including the quiet zone (default 220) */
  size?: number;
  /** Read out instead of the pattern ("QR code for the link …") */
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A scannable QR code drawn with react-native-svg: ink modules on white, with the 4-module
 * quiet zone. Modules snap to whole pixels where the size allows, so it stays crisp.
 */
export const QrCode = memo(function QrCode({ value, size = 220, accessibilityLabel, testID, style }: QrCodeProps) {
  const { d, n } = useMemo(() => {
    const m = qrMatrix(value);
    return { d: toPath(m), n: m.length + QUIET * 2 };
  }, [value]);
  // whole pixels per module (crisp edges on screens and in screenshots)
  const px = Math.max(1, Math.floor(size / n)) * n;
  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Svg width={px} height={px} viewBox={`0 0 ${n} ${n}`}>
        <Rect x={0} y={0} width={n} height={n} fill={colors.card} />
        <Path d={d} fill={colors.ink} />
      </Svg>
    </View>
  );
});
