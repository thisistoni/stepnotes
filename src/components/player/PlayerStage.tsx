import { memo, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { StepDiagram } from '@/components/StepDiagram';
import { Icon, Segmented, Stage, Text } from '@/components/ui';
import { growTo, layoutChart, layoutLive, unionBounds, type Bounds } from '@/lib/chartLayout';
import { barRanges, computeStates, slicePattern } from '@/lib/pattern';
import { colors, radius, roleTheme, ROLE_COLOR, withAlpha, type ColorSet } from '@/lib/theme';
import { ROLE_LABEL, type FootStyle, type Pattern, type Role } from '@/lib/types';

export type StageMode = 'live' | 'overview';
/** 'all' or a bar number (0-based, as in `barRanges`) */
export type ChartBar = 'all' | number;

export interface StageRole {
  role: Role;
  pattern: Pattern;
  footStyle: FootStyle;
  /** pass the playback index to this diagram (same step timing as the clock) */
  synced: boolean;
}

interface Props {
  roles: StageRole[];
  tone: ColorSet;
  mode: StageMode;
  onModeChange: (m: StageMode) => void;
  beat: SharedValue<number>;
  index: number;
  letters: boolean;
  mirrored: boolean;
  chartBar: ChartBar;
  beatsPerBar: number;
  height: number;
}

const MODE_OPTIONS = [
  { value: 'live' as const, label: 'Animate', icon: 'play' as const, accessibilityLabel: 'Animate the steps' },
  { value: 'overview' as const, label: 'Chart', icon: 'chart' as const, accessibilityLabel: 'Show the step chart' },
];

/** Facing indicator: which way is forward on the diagram ("Mirrored" in mirror mode). */
function FacingTag({ tone, mirrored, compact }: { tone: ColorSet; mirrored: boolean; compact?: boolean }) {
  const label = mirrored ? 'Mirrored' : 'Facing';
  return (
    <View
      style={[s.facing, compact && s.facingCompact]}
      accessible
      accessibilityLabel={mirrored ? 'Mirrored view: left and right are swapped. Forward is up.' : 'Forward is up the screen'}
    >
      <Icon name={mirrored ? 'mirror' : 'arrow-up'} size={13} color={tone.deep} strokeWidth={3} />
      {!compact && (
        <Text variant="overline" color={tone.deep} style={s.facingText}>
          {label}
        </Text>
      )}
    </View>
  );
}

function RoleTag({ role }: { role: Role }) {
  const c = ROLE_COLOR[role];
  return (
    <View style={[s.roleTag, { backgroundColor: c.base }]}>
      <Text variant="overline" color={c.on} style={s.roleTagText}>
        {ROLE_LABEL[role]}
      </Text>
    </View>
  );
}

interface Chart {
  pattern: Pattern;
  bounds: Bounds | undefined;
}

/** The chart for one bar (or all), with one zoom shared by every bar of this role. */
function chartFor(pattern: Pattern, beatsPerBar: number, chartBar: ChartBar): Chart {
  const bars = barRanges(pattern, beatsPerBar);
  if (chartBar === 'all' || bars.length <= 1) return { pattern, bounds: undefined };
  const k = bars.findIndex((b) => b.bar === chartBar);
  if (k < 0) return { pattern, bounds: undefined };
  const states = computeStates(pattern);
  const slices = bars.map((b) => slicePattern(pattern, b.from, b.to, states));
  const boxes = slices.map((p) => layoutChart(p, computeStates(p)).bounds);
  const u = unionBounds(boxes)!;
  // same scale for every bar (no zoom jump between bars), each centred on its own feet
  const own = boxes[k];
  const w = u.maxX - u.minX;
  const h = u.maxY - u.minY;
  const cx = (own.minX + own.maxX) / 2;
  const cy = (own.minY + own.maxY) / 2;
  return { pattern: slices[k], bounds: growTo({ minX: cx - w / 2, maxX: cx + w / 2, minY: cy - h / 2, maxY: cy + h / 2 }, 0) };
}

/** Width / height of what a role's diagram will draw (to choose the Both arrangement). */
function contentSize(r: StageRole, mode: StageMode, chart: Chart) {
  const b =
    mode === 'live'
      ? layoutLive(r.pattern, computeStates(r.pattern)).bounds
      : (chart.bounds ?? layoutChart(chart.pattern, computeStates(chart.pattern)).bounds);
  return { w: b.maxX - b.minX, h: b.maxY - b.minY };
}

const RoleDiagram = memo(function RoleDiagram({
  r,
  mode,
  beat,
  index,
  letters,
  chart,
  maxHeight,
}: {
  r: StageRole;
  mode: StageMode;
  beat: SharedValue<number>;
  index: number;
  letters: boolean;
  chart: Chart;
  maxHeight: number;
}) {
  const theme = roleTheme(r.role);
  if (mode === 'overview') {
    return (
      <StepDiagram
        testID={`diagram-chart-${r.role}`}
        pattern={chart.pattern}
        bounds={chart.bounds}
        theme={theme}
        footStyle={r.footStyle}
        mode="overview"
        showLetters={letters}
        maxHeight={maxHeight}
      />
    );
  }
  return (
    <StepDiagram
      testID={`diagram-live-${r.role}`}
      pattern={r.pattern}
      theme={theme}
      footStyle={r.footStyle}
      mode="live"
      beat={beat}
      index={r.synced ? index : undefined}
      showLetters={letters}
      maxHeight={maxHeight}
    />
  );
});

const PAD = 10;
const TOP_INSET_SINGLE = 50;
const TOP_INSET_BOTH = 40;
const TOP_INSET_STACKED = 34;
const TOOLBAR_H = 36;

/**
 * The stage tile(s): style tint + dot grid, the Animate / Chart toggle, the Facing tag, and one
 * diagram per role. "Both" = two half-width stages side by side (same clock, both fully visible)
 * with the toggle in a row above them.
 */
export const PlayerStage = memo(function PlayerStage({
  roles,
  tone,
  mode,
  onModeChange,
  beat,
  index,
  letters,
  mirrored,
  chartBar,
  beatsPerBar,
  height,
}: Props) {
  const { width: winW } = useWindowDimensions();
  const narrow = winW < 370;
  const charts = useMemo(() => roles.map((r) => chartFor(r.pattern, beatsPerBar, chartBar)), [roles, beatsPerBar, chartBar]);
  // Both: side by side (the default) or stacked, whichever draws the feet bigger. Wide patterns
  // (Bachata, Cha-Cha charts) get about twice the size stacked.
  const stacked = useMemo(() => {
    if (roles.length < 2) return false;
    const colW = Math.min(winW, 480) - 48;
    const areaH = height - TOOLBAR_H - 8;
    const sizes = roles.map((r, i) => contentSize(r, mode, charts[i]));
    const fitScale = (cw: number, ch: number) => Math.min(...sizes.map((z) => Math.min(cw / z.w, ch / z.h)));
    const side = fitScale((colW - 10) / 2 - 12, areaH - TOP_INSET_BOTH - 10);
    const stack = fitScale(colW - 12, (areaH - 10) / 2 - TOP_INSET_STACKED - 10);
    return stack > side * 1.15;
  }, [roles, mode, charts, winW, height]);
  const toggle = (
    <Segmented
      variant="compact"
      options={MODE_OPTIONS}
      value={mode}
      onChange={onModeChange}
      itemWidth={94}
      label="Diagram view"
      testID="mode-toggle"
    />
  );

  if (roles.length === 1) {
    const r = roles[0];
    return (
      <Stage
        tone={tone}
        height={height}
        topLeft={toggle}
        topRight={<FacingTag tone={tone} mirrored={mirrored} compact={narrow} />}
        topInset={TOP_INSET_SINGLE}
        padding={PAD}
        testID="stage"
      >
        <RoleDiagram
          r={r}
          mode={mode}
          beat={beat}
          index={index}
          letters={letters}
          chart={charts[0]}
          maxHeight={height - TOP_INSET_SINGLE - PAD - 4}
        />
      </Stage>
    );
  }

  const areaH = height - TOOLBAR_H - 8;
  const stageH = stacked ? (areaH - 10) / 2 : areaH;
  const inset = stacked ? TOP_INSET_STACKED : TOP_INSET_BOTH;
  return (
    <View style={{ height }} testID="stage">
      <View style={s.toolbar}>
        {toggle}
        <FacingTag tone={tone} mirrored={mirrored} compact={narrow} />
      </View>
      <View style={[s.pair, stacked && s.stack]} testID={stacked ? 'stage-stacked' : 'stage-side-by-side'}>
        {roles.map((r, i) => (
          <Stage
            key={r.role}
            tone={tone}
            height={stageH}
            topLeft={<RoleTag role={r.role} />}
            topInset={inset}
            padding={6}
            style={s.half}
          >
            <RoleDiagram
              r={r}
              mode={mode}
              beat={beat}
              index={index}
              letters={letters}
              chart={charts[i]}
              maxHeight={stageH - inset - 6 - 4}
            />
          </Stage>
        ))}
      </View>
    </View>
  );
});

export const STAGE_TOOLBAR_H = TOOLBAR_H;

const s = StyleSheet.create({
  facing: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: withAlpha(colors.card, 0.78),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  facingCompact: { paddingHorizontal: 8 },
  facingText: { fontSize: 11, letterSpacing: 0.8 },
  roleTag: { height: 22, paddingHorizontal: 8, borderRadius: 8, justifyContent: 'center' },
  roleTagText: { fontSize: 10.5, letterSpacing: 0.8, lineHeight: 13 },
  toolbar: { height: TOOLBAR_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  pair: { flex: 1, flexDirection: 'row', gap: 10 },
  stack: { flexDirection: 'column' },
  half: { flex: 1, borderRadius: radius.card },
});
