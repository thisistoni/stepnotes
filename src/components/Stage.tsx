import { useId, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { radius, withAlpha, type ColorSet } from '@/lib/theme';

export interface StageProps {
  /** Dance-style colours: tint background, dot grid from the lip colour */
  tone: ColorSet;
  /** The diagram. A function receives the free area (px) so it can pass `maxHeight`. */
  children?: ReactNode | ((area: { width: number; height: number }) => ReactNode);
  /** Overlay slots (12px from the edges) — e.g. Animate/Chart toggle, Facing tag */
  topLeft?: ReactNode;
  topRight?: ReactNode;
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
  /** Fixed height; otherwise give `style={{ flex: 1 }}` or let the content size it */
  height?: number;
  /** Space kept free for the top overlays (default 52 when topLeft/topRight are set) */
  topInset?: number;
  /** Padding around the diagram (default 12) */
  padding?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Rounded tile in a style tint with a subtle dot grid, hosting a StepDiagram plus overlay slots. */
export function Stage({
  tone,
  children,
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  height,
  topInset,
  padding = 12,
  testID,
  style,
}: StageProps) {
  const id = `dots${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const top = topInset ?? (topLeft || topRight ? 52 : padding);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    setArea((a) => (a && a.width === width && a.height === h ? a : { width, height: h }));
  };
  return (
    <View
      testID={testID}
      style={[s.stage, { backgroundColor: tone.tint, borderColor: withAlpha(tone.base, 0.16) }, height != null && { height }, style]}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <Pattern id={id} x={0} y={0} width={18} height={18} patternUnits="userSpaceOnUse">
            <Circle cx={9} cy={9} r={1.3} fill={withAlpha(tone.lip, 0.2)} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <View style={[s.content, { padding, paddingTop: top }]} onLayout={onLayout}>
        {typeof children === 'function'
          ? area && children({ width: area.width - padding * 2, height: area.height - top - padding })
          : children}
      </View>
      {topLeft && <View style={[s.slot, s.tl]}>{topLeft}</View>}
      {topRight && <View style={[s.slot, s.tr]}>{topRight}</View>}
      {bottomLeft && <View style={[s.slot, s.bl]}>{bottomLeft}</View>}
      {bottomRight && <View style={[s.slot, s.br]}>{bottomRight}</View>}
    </View>
  );
}

const s = StyleSheet.create({
  stage: { borderRadius: radius.xl, borderWidth: 2, overflow: 'hidden' },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  slot: { position: 'absolute' },
  tl: { left: 10, top: 10 },
  tr: { right: 10, top: 10 },
  bl: { left: 10, bottom: 10 },
  br: { right: 10, bottom: 10 },
});
