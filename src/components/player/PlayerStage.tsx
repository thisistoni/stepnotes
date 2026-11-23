import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReducedMotion, type SharedValue } from 'react-native-reanimated';

import { StepDiagram } from '@/components/StepDiagram';
import { Icon, Segmented, Stage, Text } from '@/components/ui';
import { layoutChart, layoutLive, type Bounds } from '@/lib/chartLayout';
import { barRanges, computeStates, facingOf, slicePattern } from '@/lib/pattern';
import { useT } from '@/lib/i18n';
import { colors, radius, roleTheme, ROLE_COLOR, withAlpha, type ColorSet } from '@/lib/theme';
import type { FootStyle, Pattern, Role } from '@/lib/types';

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

/**
 * Facing indicator: which way is forward on the diagram ("Mirrored" in mirror mode). The arrow
 * turns with the dancer (`deg`, 0 = up): after a quarter turn "forward" is no longer up the screen.
 */
function FacingTag({ tone, mirrored, compact, deg = 0 }: { tone: ColorSet; mirrored: boolean; compact?: boolean; deg?: number }) {
  const t = useT();
  const label = mirrored ? t.player.mirrored : t.player.facing;
  return (
    <View
      style={[s.facing, compact && s.facingCompact]}
      accessible
      accessibilityLabel={mirrored ? t.player.mirroredA11y : t.player.facingA11y}
      testID="facing-tag"
    >
      <View style={deg ? { transform: [{ rotate: `${Math.round(deg)}deg` }] } : undefined} testID={`facing-${Math.round(deg)}`}>
        <Icon name={mirrored ? 'mirror' : 'arrow-up'} size={13} color={tone.deep} strokeWidth={3} />
      </View>
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
  const t = useT();
  return (
    <View style={[s.roleTag, { backgroundColor: c.base }]}>
      <Text variant="overline" color={c.on} style={s.roleTagText}>
        {t.roles[role]}
      </Text>
    </View>
  );
}

interface Chart {
  pattern: Pattern;
  bounds: Bounds | undefined;
}

/**
 * The chart for one bar (or all). Each bar is fitted to its own feet, so a bar's chart is as
 * large as the stage allows (a chart is read, not animated: a zoom change between bars is fine).
 */
function chartFor(pattern: Pattern, beatsPerBar: number, chartBar: ChartBar): Chart {
  const bars = barRanges(pattern, beatsPerBar);
  if (chartBar === 'all' || bars.length <= 1) return { pattern, bounds: undefined };
  const bar = bars.find((b) => b.bar === chartBar);
  if (!bar) return { pattern, bounds: undefined };
  return { pattern: slicePattern(pattern, bar.from, bar.to, computeStates(pattern)), bounds: undefined };
}

/**
 * Which way the dancer faces on what is shown: after the current step in the animation, at the
 * start of the bar in a one-bar chart, at the start of the pattern in the chart of all bars.
 */
function facingFor(pattern: Pattern, mode: StageMode, index: number, beatsPerBar: number, chartBar: ChartBar) {
  const states = computeStates(pattern);
  if (mode === 'live') return facingOf(states[Math.max(0, Math.min(states.length - 1, index + 1))]);
  if (chartBar === 'all') return facingOf(states[0]);
  const bar = barRanges(pattern, beatsPerBar).find((b) => b.bar === chartBar);
  return facingOf(states[bar ? bar.from : 0]);
}

/** Bars the animated view shows at once in a long routine (the starters' figures are two bars long). */
const WINDOW_BARS = 2;

/** First step of the animation window that step `index` belongs to, or -1 when the whole pattern fits. */
function windowStart(pattern: Pattern, beatsPerBar: number, index: number) {
  const bars = barRanges(pattern, beatsPerBar);
  if (bars.length <= WINDOW_BARS) return -1;
  const k = Math.max(0, bars.findIndex((b) => index >= b.from && index < b.to));
  return bars[Math.floor(k / WINDOW_BARS) * WINDOW_BARS].from;
}

/**
 * The animated view of a long routine fits two bars at a time instead of the whole routine, so the
 * feet stay big enough to read (a six-bar routine that turns round the floor would otherwise shrink
 * them to half). The window has the same shape as the whole routine's bounds, so the diagram keeps
 * its size and only the content zooms; it starts where the feet are before its first step.
 */
function windowBounds(pattern: Pattern, beatsPerBar: number, from: number): Bounds | undefined {
  if (from < 0) return undefined;
  const bars = barRanges(pattern, beatsPerBar);
  const k = bars.findIndex((b) => b.from === from);
  if (k < 0) return undefined;
  const to = bars[Math.min(bars.length - 1, k + WINDOW_BARS - 1)].to;
  const states = computeStates(pattern);
  const slice = slicePattern(pattern, from, to, states);
  const b = layoutLive(slice, computeStates(slice)).bounds;
  const full = layoutLive(pattern, states).bounds;
  const aspect = (full.maxX - full.minX) / (full.maxY - full.minY);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const W = Math.max(w, h * aspect);
  const H = W / aspect;
  return { minX: cx - W / 2, maxX: cx + W / 2, minY: cy - H / 2, maxY: cy + H / 2 };
}

/** `target`, eased over ~350 ms whenever it changes (a camera move, not a jump). */
function useTweenedBounds(target: Bounds | undefined): Bounds | undefined {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (!target || !from || reduced) {
      fromRef.current = target;
      setShown(target);
      return;
    }
    let raf = 0;
    const t0 = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / 350);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const mix = (a: number, b: number) => a + (b - a) * e;
      const b: Bounds = { minX: mix(from.minX, target.minX), maxX: mix(from.maxX, target.maxX), minY: mix(from.minY, target.minY), maxY: mix(from.maxY, target.maxY) };
      fromRef.current = b;
      setShown(b);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return target ? shown : undefined;
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
  beatsPerBar,
}: {
  r: StageRole;
  mode: StageMode;
  beat: SharedValue<number>;
  index: number;
  letters: boolean;
  chart: Chart;
  maxHeight: number;
  beatsPerBar: number;
}) {
  const theme = roleTheme(r.role);
  const from = mode === 'live' && r.synced ? windowStart(r.pattern, beatsPerBar, index) : -1;
  const target = useMemo(() => windowBounds(r.pattern, beatsPerBar, from), [r.pattern, beatsPerBar, from]);
  const liveBounds = useTweenedBounds(target);
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
      bounds={liveBounds}
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
  const t = useT();
  const narrow = winW < 370;
  const charts = useMemo(() => roles.map((r) => chartFor(r.pattern, beatsPerBar, chartBar)), [roles, beatsPerBar, chartBar]);
  const facings = useMemo(
    () => roles.map((r) => facingFor(r.pattern, mode, r.synced ? index : -1, beatsPerBar, chartBar)),
    [roles, mode, index, beatsPerBar, chartBar],
  );
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
      options={[
        { value: 'live' as const, label: t.player.animate, icon: 'play' as const, accessibilityLabel: t.player.animateA11y },
        { value: 'overview' as const, label: t.player.chart, icon: 'chart' as const, accessibilityLabel: t.player.chartA11y },
      ]}
      value={mode}
      onChange={onModeChange}
      itemWidth={t.player.animate.length > 7 || t.player.chart.length > 7 ? 106 : 94}
      label={t.player.view}
      testID="mode-toggle"
    />
  );

  // A chart is width-limited for wide patterns: shrink the tile to what the chart needs (the same
  // for every bar, so switching bars never changes the layout) instead of leaving empty bands.
  const chartAspect = useMemo(() => {
    if (mode !== 'overview' || roles.length !== 1) return 0;
    const p = roles[0].pattern;
    const options = [p, ...barRanges(p, beatsPerBar).map((b) => slicePattern(p, b.from, b.to, computeStates(p)))];
    return Math.max(
      ...options.map((x) => {
        const b = layoutChart(x, computeStates(x)).bounds;
        return (b.maxY - b.minY) / (b.maxX - b.minX);
      }),
    );
  }, [mode, roles, beatsPerBar]);

  if (roles.length === 1) {
    const r = roles[0];
    const innerW = Math.min(winW, 480) - 48 - PAD * 2 - 4;
    const stageH = chartAspect > 0 ? Math.min(height, Math.max(220, Math.ceil(TOP_INSET_SINGLE + PAD + 8 + innerW * chartAspect))) : height;
    return (
      <Stage
        tone={tone}
        height={stageH}
        topLeft={toggle}
        topRight={<FacingTag tone={tone} mirrored={mirrored} compact={narrow} deg={mirrored ? 0 : facings[0]} />}
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
          maxHeight={stageH - TOP_INSET_SINGLE - PAD - 4}
          beatsPerBar={beatsPerBar}
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
        {/* the roles can face different ways (one turns, the other not): each stage shows its own
            facing arrow; the shared tag here only says "Mirrored" */}
        {mirrored && <FacingTag tone={tone} mirrored compact={narrow} />}
      </View>
      <View style={[s.pair, stacked && s.stack]} testID={stacked ? 'stage-stacked' : 'stage-side-by-side'}>
        {roles.map((r, i) => (
          <Stage
            key={r.role}
            tone={tone}
            height={stageH}
            topLeft={<RoleTag role={r.role} />}
            topRight={mirrored ? undefined : <FacingTag tone={tone} mirrored={false} compact deg={facings[i]} />}
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
              beatsPerBar={beatsPerBar}
            />
          </Stage>
        ))}
      </View>
    </View>
  );
});

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
