import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import { SVG_FONT } from '@/components/FootShape';
import { FootSticker, Segmented, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import type { BarRange } from '@/lib/pattern';
import { colors, ROLE_COLOR, TONE, type ColorSet } from '@/lib/theme';
import type { Role } from '@/lib/types';

import type { ChartBar } from './PlayerStage';

interface Props {
  bars: BarRange[];
  value: ChartBar;
  onChange: (b: ChartBar) => void;
  role: Role;
}

function NumberBadge({ c }: { c: ColorSet }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Circle cx={10} cy={10} r={8.5} fill={colors.card} stroke={c.lip} strokeWidth={1.6} />
      <SvgText x={10} y={14} fontSize={11} fontFamily={SVG_FONT} fill={c.lip} textAnchor="middle">
        1
      </SvgText>
    </Svg>
  );
}

function DashedArrow({ color }: { color: string }) {
  return (
    <Svg width={22} height={20} viewBox="0 0 22 20">
      <Line x1={3} y1={10} x2={17} y2={10} stroke={color} strokeWidth={2.2} strokeDasharray="3 3" strokeLinecap="round" />
      <Line x1={13} y1={6} x2={18} y2={10} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={13} y1={14} x2={18} y2={10} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

const PICKER_H = 46;
const GAP = 12;
const LEGEND_H = 22;

/** Height of the controls (with or without the bar picker). */
export function chartControlsHeight(withBars: boolean) {
  return withBars ? PICKER_H + GAP + LEGEND_H : LEGEND_H;
}

/** Chart mode: "Bar 1 · Bar 2 · All" (only with more than one bar) and a one-line legend. */
export const ChartControls = memo(function ChartControls({ bars, value, onChange, role }: Props) {
  const c = ROLE_COLOR[role];
  const narrow = useWindowDimensions().width < 360;
  const t = useT();
  const options = [
    ...bars.map((b, i) => ({ value: String(b.bar), label: bars.length > 4 ? `${i + 1}` : t.chart.bar(i + 1), accessibilityLabel: t.chart.bar(i + 1) })),
    // six bars and "All" leave too little room for the word on a small phone: the chart icon says it
    bars.length > 5 && narrow
      ? { value: 'all', label: '', icon: 'chart' as const, accessibilityLabel: t.chart.allA11y }
      : { value: 'all', label: t.chart.all, accessibilityLabel: t.chart.allA11y },
  ];
  return (
    <View style={s.wrap} testID="chart-controls">
      {bars.length > 1 && (
        <Segmented
          options={options}
          value={String(value)}
          onChange={(v) => onChange(v === 'all' ? 'all' : Number(v))}
          color={TONE.ink}
          label={t.chart.of}
          testID="bar-picker"
        />
      )}
      <View style={s.legend} accessible accessibilityLabel={t.chart.legendA11y}>
        <View style={s.item}>
          <FootSticker size={22} tone={c} />
          <Text variant="caption" color="ink2">
            {t.chart.start}
          </Text>
        </View>
        <View style={s.item}>
          <NumberBadge c={c} />
          <Text variant="caption" color="ink2">
            {t.chart.count}
          </Text>
        </View>
        <View style={s.item}>
          <DashedArrow color={c.lip} />
          <Text variant="caption" color="ink2">
            {narrow ? t.chart.tap : t.chart.tapLong}
          </Text>
        </View>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { gap: GAP },
  legend: { flexDirection: 'row', justifyContent: 'center', columnGap: 14, height: LEGEND_H, alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
