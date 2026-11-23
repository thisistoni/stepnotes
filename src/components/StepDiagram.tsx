/**
 * The footprint diagram: printed-style chart, animated player view and editor canvas.
 *
 * Layers (bottom → top):
 *   1. StaticLayer  – grid, ghost outlines / chart feet, chart arrows + numbered badges. Memoised
 *                     SVG that only re-renders when the pattern, theme or size changes.
 *   2. Live layer   – only in `mode="live"`.
 *        • with `beat` (a Reanimated SharedValue from usePlayback): the FOCUS layer + two animated
 *          feet. The focus layer draws what matters for the current step and nothing else:
 *            destination of the moving foot   strong dashed outline in the role colour
 *            the current arrow + count badge  thick, role coloured, dashed for a tap
 *            next step's destination          faint dashed outline with its count
 *            where the moving foot came from  very faint outline
 *            every other position             barely visible (context only)
 *            turn cue                         curved arrow when the foot rotates ≥ 20°
 *            tap mark                         "TAP" tag on the badge; the foot lands light (never
 *                                             solid) with a dashed ripple
 *          It re-renders once per step (driven by the `index` prop, or by its own reaction on the
 *          beat when no index is given). Each foot is an Animated.View posed on the UI thread from
 *          a precomputed timeline: travel, a small lift while in the air, a squash on landing and
 *          the weight cross-fade (light → solid). No React renders per frame.
 *        • with `frame` (a fixed pose, e.g. the editor) or nothing: drawn statically.
 *
 * Sizes that must stay legible (letters, badges, strokes) have pixel minimums, so the half-width
 * stages of the "Both" view stay readable. Height is reserved from the first frame via
 * `aspectRatio` (from the bounds): no layout jump. All colours come from `theme`.
 */
import { memo, useDeferredValue, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import {
  growTo,
  layoutChart,
  layoutLive,
  LABEL_SIZE,
  LIVE_BADGE_R,
  TURN_ARC_R,
  TURN_MIN_DEG,
  type Bounds,
  type ChartArrow,
  type ChartLayout,
  type LiveLayout,
  type LiveStep,
  type Vec,
} from '@/lib/chartLayout';
import { useT } from '@/lib/i18n';
import {
  buildTimeline,
  computeStates,
  footPhaseAt,
  footPoseAt,
  KIND_CODE,
  samePos,
  shortestAngleDelta,
  stepIndexAt,
  type Frame,
  type Timeline,
} from '@/lib/pattern';
import { withAlpha, type RoleTheme } from '@/lib/theme';
import type { Foot, FootPos, FootStyle, Pattern } from '@/lib/types';

import { FOOT_BOX, FootShape, LETTER_SIZE, SVG_FONT, SVG_FONT_MEDIUM } from './FootShape';

export type { Bounds };
export { SVG_FONT };

/** Labels smaller than this (on screen) are hidden when `showLabels="auto"` (tiny thumbnails). */
export const MIN_LABEL_PX = 11;
/** L / R letters never render smaller than this (px). */
const MIN_LETTER_PX = 11;
const EMPTY_BOUNDS: Bounds = { minX: -3, minY: -3, maxX: 3, maxY: 3 };

export interface StepDiagramProps {
  pattern: Pattern;
  theme: RoleTheme;
  footStyle: FootStyle;
  /** overview = every step numbered (like a printed chart); live = current state of the feet */
  mode: 'overview' | 'live';
  /** live mode: animate from this beat clock (`usePlayback().beat`) */
  beat?: SharedValue<number>;
  /**
   * live mode with `beat`: the current step index (`usePlayback().index`). Optional; when given the
   * focus layer follows it, so the whole screen renders once per step in a single commit. Without
   * it the diagram derives the index from the beat itself.
   */
  index?: number;
  /**
   * live mode: which positions to outline. 'focus' (default with `beat`) = destination strong, next
   * faint, origin very faint, the rest barely visible. 'all' (default without `beat`) = every
   * position as an equal ghost (the editor).
   */
  ghosts?: 'focus' | 'all';
  /** live mode without `beat`: a fixed pose to draw (the editor). Default: start position. */
  frame?: Frame;
  showLetters?: boolean;
  /** Chart step numbers. 'auto' (default) hides them when they would be too small to read. */
  showLabels?: boolean | 'auto';
  maxHeight?: number;
  /** Fixed bounds (the editor uses this so the canvas does not re-zoom while dragging). */
  bounds?: Bounds;
  /** Draw a background grid (editor). */
  grid?: boolean;
  /** Called with diagram coordinates while the user touches / drags the canvas. */
  onTouch?: (x: number, y: number) => void;
  onTouchEnd?: () => void;
  testID?: string;
}

/** Bounds of just the feet positions (used by the editor). */
export function patternBounds(pattern: Pattern, pad = 2.2, minSize = 7): Bounds {
  const pts: FootPos[] = [pattern.start.L, pattern.start.R, ...pattern.steps.map((s) => s.to)];
  return growTo(
    {
      minX: Math.min(...pts.map((p) => p.x)) - pad,
      maxX: Math.max(...pts.map((p) => p.x)) + pad,
      minY: Math.min(...pts.map((p) => p.y)) - pad,
      maxY: Math.max(...pts.map((p) => p.y)) + pad,
    },
    minSize,
  );
}

interface Size {
  width: number;
  height: number;
}

interface Geometry {
  scale: number;
  ox: number;
  oy: number;
}

/** How the viewBox maps into the view (SVG default preserveAspectRatio="xMidYMid meet"). */
function fit(size: Size, b: Bounds): Geometry {
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const scale = Math.min(size.width / bw, size.height / bh);
  return { scale, ox: (size.width - bw * scale) / 2, oy: (size.height - bh * scale) / 2 };
}

/** Letter size in units so letters are at least MIN_LETTER_PX on screen (capped so they fit the foot). */
function letterSizeFor(scale: number | undefined) {
  if (!scale) return LETTER_SIZE;
  return Math.min(0.86, Math.max(LETTER_SIZE, MIN_LETTER_PX / scale));
}

export const StepDiagram = memo(function StepDiagram({
  pattern,
  theme,
  footStyle,
  mode,
  beat,
  index,
  ghosts,
  frame,
  showLetters = true,
  showLabels = 'auto',
  maxHeight = 420,
  bounds: fixedBounds,
  grid,
  onTouch,
  onTouchEnd,
  testID,
}: StepDiagramProps) {
  const [size, setSize] = useState<Size | null>(null);

  // While dragging in the editor the pattern changes on every snapped move; the chart layout
  // (ghosts + arrows) may lag a frame behind so the dragged foot itself stays responsive.
  const layoutPattern = useDeferredValue(pattern);
  const animated = mode === 'live' && !!beat;
  const ghostMode = ghosts ?? 'focus';
  const states = useMemo(() => computeStates(layoutPattern), [layoutPattern]);
  // the printed-chart layout (arrow / label placement) is only needed for the chart
  const layout = useMemo(
    () => (mode === 'overview' ? layoutChart(layoutPattern, states) : { feet: [], arrows: [], bounds: EMPTY_BOUNDS }),
    [mode, layoutPattern, states],
  );
  // live layout: cheap, so a fixed pose (the editor dragging a foot) uses the CURRENT pattern and
  // its arrow follows the finger without lagging a frame behind
  const livePattern = animated ? layoutPattern : pattern;
  const live = useMemo(() => (mode === 'live' ? layoutLive(livePattern, computeStates(livePattern)) : null), [mode, livePattern]);
  const timeline = useMemo(() => (beat ? buildTimeline(pattern) : null), [beat, pattern]);
  const turns = useMemo(
    () =>
      mode === 'overview'
        ? layoutPattern.steps
            .map((s, i) => ({ s, from: states[i].pos[s.foot] }))
            .filter(({ s }) => s.kind !== 'hold')
            .map(({ s, from }) => ({ to: s.to, turn: shortestAngleDelta(from.rot, s.to.rot) }))
            .filter((t) => Math.abs(t.turn) >= TURN_MIN_DEG)
        : [],
    [mode, layoutPattern, states],
  );

  const bounds = fixedBounds ?? live?.bounds ?? layout.bounds;
  const vbW = bounds.maxX - bounds.minX;
  const vbH = bounds.maxY - bounds.minY;
  const viewBox = `${bounds.minX} ${bounds.minY} ${vbW} ${vbH}`;
  // a hidden / collapsing screen can measure 0 × 0: no geometry then (avoids Infinity → NaN paths)
  const geometry = size && size.width > 0 && size.height > 0 ? fit(size, bounds) : null;
  const labelsVisible =
    mode === 'overview' &&
    (showLabels === true || (showLabels === 'auto' && !!geometry && LABEL_SIZE * geometry.scale >= MIN_LABEL_PX));
  const letterSize = letterSizeFor(geometry?.scale);
  // diagram units per screen pixel (for pixel minimums); a sensible guess before the first layout
  const unit = geometry ? 1 / geometry.scale : 1 / 24;

  // --- touch handling (editor) --------------------------------------------------------
  const containerRef = useRef<ComponentRef<typeof View>>(null);
  const origin = useRef({ x: 0, y: 0 });
  /** Set while the grant's measure() is pending: the latest move and whether the touch ended. */
  const held = useRef<{ move: { x: number; y: number } | null; ended: boolean } | null>(null);
  const geom = useRef({ size, bounds });
  const onTouchRef = useRef(onTouch);
  const onTouchEndRef = useRef(onTouchEnd);
  useLayoutEffect(() => {
    geom.current = { size, bounds };
    onTouchRef.current = onTouch;
    onTouchEndRef.current = onTouchEnd;
  });

  // The refs are only read inside the gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => {
    const emit = (pageX: number, pageY: number) => {
      const { size: sz, bounds: b } = geom.current;
      if (!sz) return;
      const { scale, ox, oy } = fit(sz, b);
      const lx = pageX - origin.current.x;
      const ly = pageY - origin.current.y;
      onTouchRef.current?.(b.minX + (lx - ox) / scale, b.minY + (ly - oy) / scale);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !!onTouchRef.current,
      onMoveShouldSetPanResponder: () => !!onTouchRef.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { pageX, pageY } = e.nativeEvent;
        // measure() can be async (web): hold back moves / the release until the grant point is
        // out, so the editor receives the touch in order (first point, moves, end).
        const pending: { move: { x: number; y: number } | null; ended: boolean } = { move: null, ended: false };
        held.current = pending;
        containerRef.current?.measure((_x, _y, _w, _h, px, py) => {
          origin.current = { x: px, y: py };
          held.current = null;
          emit(pageX, pageY);
          if (pending.move) emit(pending.move.x, pending.move.y);
          if (pending.ended) onTouchEndRef.current?.();
        });
      },
      onPanResponderMove: (e) => {
        if (held.current) held.current.move = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        else emit(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderRelease: () => {
        if (held.current) held.current.ended = true;
        else onTouchEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        if (held.current) held.current.ended = true;
        else onTouchEndRef.current?.();
      },
    });
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s && s.width === width && s.height === height ? s : { width, height }));
    if (onTouch) {
      containerRef.current?.measure((_x, _y, _w, _h, px, py) => {
        origin.current = { x: px, y: py };
      });
    }
  };

  return (
    <View
      ref={containerRef}
      onLayout={onLayout}
      testID={testID}
      style={{ width: '100%', aspectRatio: vbW / vbH, maxHeight }}
      {...(onTouch ? responder.panHandlers : {})}
    >
      <StaticLayer
        layout={layout}
        live={live}
        ghostMode={ghostMode}
        viewBox={viewBox}
        bounds={bounds}
        theme={theme}
        footStyle={footStyle}
        mode={mode}
        grid={!!grid}
        showLetters={showLetters}
        showLabels={labelsVisible}
        letterSize={letterSize}
        unit={unit}
        turns={turns}
      />
      {mode === 'live' &&
        (beat && timeline && live ? (
          geometry && (
            <LiveLayer
              live={live}
              timeline={timeline}
              beat={beat}
              index={index}
              ghostMode={ghostMode}
              bounds={bounds}
              viewBox={viewBox}
              geometry={geometry}
              theme={theme}
              footStyle={footStyle}
              showLetters={showLetters}
              letterSize={letterSize}
            />
          )
        ) : (
          live && (
            <StaticPose
              live={live}
              ghostMode={ghostMode}
              viewBox={viewBox}
              theme={theme}
              footStyle={footStyle}
              showLetters={showLetters}
              letterSize={letterSize}
              unit={unit}
              frame={frame ?? { index: -1, feet: pattern.start, weight: null, progress: 1 }}
            />
          )
        ))}
    </View>
  );
});

// --- static layer --------------------------------------------------------------------------

interface StaticLayerProps {
  layout: ChartLayout;
  live: LiveLayout | null;
  ghostMode: 'focus' | 'all';
  viewBox: string;
  bounds: Bounds;
  theme: RoleTheme;
  footStyle: FootStyle;
  mode: 'overview' | 'live';
  grid: boolean;
  showLetters: boolean;
  showLabels: boolean;
  letterSize: number;
  unit: number;
  turns: { to: FootPos; turn: number }[];
}

const StaticLayer = memo(function StaticLayer({
  layout,
  live,
  ghostMode,
  viewBox,
  bounds,
  theme,
  footStyle,
  mode,
  grid,
  showLetters,
  showLabels,
  letterSize,
  unit,
  turns,
}: StaticLayerProps) {
  const positions = live?.positions ?? layout.feet;
  return (
    <Svg width="100%" height="100%" viewBox={viewBox} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {grid && <Grid bounds={bounds} theme={theme} />}
      {mode === 'overview' ? (
        <G>
          {layout.feet.map((p, i) => (
            <FootShape
              key={`f${i}`}
              foot={p.foot}
              pos={p.pos}
              style={footStyle}
              color={p.isTap ? theme.activeArrow : p.isStart ? theme.solid : theme.light}
              lip={p.isStart ? theme.solidLip : theme.lightLip}
              stroke={theme.outline}
              ghostFill={withAlpha(theme.light, 0.25)}
              ghostWidth={Math.max(0.09, 1.8 * unit)}
              letterColor={p.isTap ? theme.activeArrow : p.isStart ? theme.letterOnSolid : theme.letterOnLight}
              outline={p.isTap}
              outlineLabel={p.isTap && showLetters ? p.foot : undefined}
              showLetter={showLetters}
              letterSize={letterSize}
            />
          ))}
          {turns.map((t, i) => (
            <TurnCue key={`t${i}`} at={t.to} turn={t.turn} color={theme.activeArrow} width={Math.max(0.08, 1.8 * unit)} />
          ))}
          {layout.arrows.map((a) => (
            <ArrowGlyph key={a.key} arrow={a} color={theme.activeArrow} theme={theme} showLabel={showLabels} unit={unit} />
          ))}
        </G>
      ) : ghostMode === 'focus' ? (
        // context only: every position barely visible, so the eye goes to the focus layer
        <G>
          {positions.map((p, i) => (
            <FootShape
              key={`g${i}`}
              foot={p.foot}
              pos={p.pos}
              style={footStyle}
              color={theme.ghostRest ?? theme.ghost}
              ghostWidth={Math.max(0.05, 1.2 * unit)}
              outline
            />
          ))}
        </G>
      ) : (
        <G>
          {positions.map((p, i) => (
            <FootShape
              key={`g${i}`}
              foot={p.foot}
              pos={p.pos}
              style={footStyle}
              color={theme.ghost}
              ghostFill={theme.ghostFill}
              outline
            />
          ))}
        </G>
      )}
    </Svg>
  );
});

// --- live layer: animated --------------------------------------------------------------------

interface LiveLayerProps {
  live: LiveLayout;
  timeline: Timeline;
  beat: SharedValue<number>;
  index?: number;
  ghostMode: 'focus' | 'all';
  bounds: Bounds;
  viewBox: string;
  geometry: Geometry;
  theme: RoleTheme;
  footStyle: FootStyle;
  showLetters: boolean;
  letterSize: number;
}

/**
 * Focus ghosts + arrow (under the feet), the two animated feet, and the badge / tap tag (over the
 * feet). Re-renders once per step; the feet are memoised and never re-render during playback.
 */
const LiveLayer = memo(function LiveLayer({
  live,
  timeline,
  beat,
  index: controlled,
  ghostMode,
  bounds,
  viewBox,
  geometry,
  theme,
  footStyle,
  showLetters,
  letterSize,
}: LiveLayerProps) {
  const [own, setOwn] = useState(-1);
  const isControlled = controlled !== undefined;
  useAnimatedReaction(
    () => (isControlled ? -2 : stepIndexAt(timeline.starts, timeline.total, beat.get())),
    (i, prev) => {
      if (i !== -2 && i !== prev) scheduleOnRN(setOwn, i);
    },
    [timeline, isControlled],
  );
  const n = live.steps.length;
  const index = Math.min(n - 1, isControlled ? controlled : own);
  const unit = 1 / geometry.scale;
  const reduced = useReducedMotion();

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Svg width="100%" height="100%" viewBox={viewBox} style={StyleSheet.absoluteFill}>
        <FocusUnder live={live} index={index} theme={theme} footStyle={footStyle} unit={unit} ghostMode={ghostMode} letterSize={letterSize} />
      </Svg>
      {(['L', 'R'] as Foot[]).map((f) => (
        <AnimatedFoot
          key={f}
          foot={f}
          timeline={timeline}
          beat={beat}
          bounds={bounds}
          geometry={geometry}
          theme={theme}
          footStyle={footStyle}
          showLetters={showLetters}
          letterSize={letterSize}
          reduced={reduced}
        />
      ))}
      <Svg width="100%" height="100%" viewBox={viewBox} style={StyleSheet.absoluteFill}>
        <FocusOver live={live} index={index} theme={theme} unit={unit} />
      </Svg>
    </View>
  );
});

/** Next step after `i` that moves a foot (skipping holds), wrapping round; null if none. */
function nextMove(steps: LiveStep[], i: number): LiveStep | null {
  for (let k = 1; k <= steps.length; k++) {
    const s = steps[(i + k + steps.length) % steps.length];
    if (s && s.kind !== 'hold') return s;
  }
  return null;
}

function FocusUnder({
  live,
  index,
  theme,
  footStyle,
  unit,
  ghostMode,
  letterSize,
}: {
  live: LiveLayout;
  index: number;
  theme: RoleTheme;
  footStyle: FootStyle;
  unit: number;
  ghostMode: 'focus' | 'all';
  letterSize: number;
}) {
  const cur = index >= 0 ? live.steps[index] : null;
  const next = live.steps.length ? nextMove(live.steps, index) : null;
  const moving = cur && cur.kind !== 'hold' && !samePos(cur.from, cur.to);
  // the next destination is not worth drawing when the foot is already there (step in place)
  const nextShown = next && !samePos(next.from, next.to) && !(cur && samePos(next.to, cur.to) && next.foot === cur.foot);
  const strongW = Math.max(0.1, 2.4 * unit);
  const faintW = Math.max(0.07, 1.6 * unit);
  const arrowW = Math.max(0.16, 3.4 * unit);
  const focus = ghostMode === 'focus';
  return (
    <G>
      {focus && nextShown && next && (
        <FootShape
          foot={next.foot}
          pos={next.to}
          style={footStyle}
          color={theme.ghostNext ?? theme.label}
          ghostFill={withAlpha(theme.light, 0.12)}
          ghostWidth={faintW}
          outline
          outlineLabel={next.label}
          letterColor={theme.ghostNext ?? theme.label}
          letterSize={letterSize * 0.92}
        />
      )}
      {focus && moving && cur && (
        <FootShape foot={cur.foot} pos={cur.from} style={footStyle} color={theme.ghostOrigin ?? theme.ghost} ghostWidth={faintW} outline />
      )}
      {cur && cur.kind !== 'hold' && !samePos(cur.from, cur.to) && (
        <FootShape
          foot={cur.foot}
          pos={cur.to}
          style={footStyle}
          color={theme.activeArrow}
          ghostFill={withAlpha(theme.light, cur.kind === 'tap' ? 0.18 : 0.38)}
          ghostWidth={strongW}
          outline
        />
      )}
      {cur?.turn ? <TurnCue at={cur.to} turn={cur.turn} color={theme.activeArrow} width={Math.max(0.12, 2.8 * unit)} /> : null}
      {cur?.arrow && <LiveArrowPath step={cur} color={theme.activeArrow} width={arrowW} />}
    </G>
  );
}

function FocusOver({ live, index, theme, unit }: { live: LiveLayout; index: number; theme: RoleTheme; unit: number }) {
  const tapLabel = useT().count.tap.toUpperCase();
  const cur = index >= 0 ? live.steps[index] : null;
  if (!cur?.arrow) return null;
  // legible on small stages, but never so big it dwarfs the feet
  const r = Math.min(0.72, Math.max(LIVE_BADGE_R, 12.5 * unit));
  const { badge } = cur.arrow;
  const fs = cur.label.length > 1 ? r * (cur.label.length > 2 ? 0.7 : 0.95) : r * 1.2;
  let tag: { x: number; y: number; w: number; h: number } | null = null;
  if (cur.kind === 'tap') {
    // the TAP tag sits on the far side of the badge, away from the foot's path
    const c = { x: (cur.from.x + cur.to.x) / 2, y: (cur.from.y + cur.to.y) / 2 };
    let vx = badge.x - c.x;
    let vy = badge.y - c.y;
    const l = Math.hypot(vx, vy) || 1;
    vx /= l;
    vy /= l;
    const h = Math.max(0.62, 17 * unit);
    const w = h * (0.55 + 0.53 * tapLabel.length);
    const d = r + (Math.abs(vx) > Math.abs(vy) ? w / 2 : h / 2) + 0.06;
    tag = { x: badge.x + vx * d, y: badge.y + vy * d, w, h };
  }
  return (
    <G>
      <Circle cx={badge.x} cy={badge.y} r={r} fill={theme.badge} stroke={theme.outline} strokeWidth={Math.max(0.1, 2.2 * unit)} />
      <SvgText x={badge.x} y={badge.y + fs * 0.36} fontSize={fs} fontFamily={SVG_FONT} fill={theme.badgeText} textAnchor="middle">
        {cur.label}
      </SvgText>
      {tag && (
        <G>
          <Rect
            x={tag.x - tag.w / 2}
            y={tag.y - tag.h / 2}
            width={tag.w}
            height={tag.h}
            rx={tag.h / 2}
            fill={theme.outline}
            stroke={theme.activeArrow}
            strokeWidth={Math.max(0.05, 1.4 * unit)}
          />
          <SvgText
            x={tag.x}
            y={tag.y + tag.h * 0.2}
            fontSize={tag.h * 0.56}
            fontFamily={SVG_FONT}
            fill={theme.activeArrow}
            textAnchor="middle"
            letterSpacing={tag.h * 0.04}
          >
            {tapLabel}
          </SvgText>
        </G>
      )}
    </G>
  );
}

function LiveArrowPath({ step, color, width }: { step: LiveStep; color: string; width: number }) {
  const ar = step.arrow!;
  const { a, b } = ar;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const head = Math.max(0.34, width * 2.3);
  const dash = ar.dashed ? `${width * 1.6} ${width * 1.7}` : undefined;
  const hs = { stroke: color, strokeWidth: width, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <G>
      <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
      <Path d={arrowHead(b, u, head)} {...hs} />
      {ar.type === 'inPlace' && <Path d={arrowHead(a, { x: -u.x, y: -u.y }, head)} {...hs} />}
    </G>
  );
}

/** Curved arrow around a foot showing which way (and roughly how far) it turns. */
function TurnCue({ at, turn, color, width }: { at: FootPos; turn: number; color: string; width: number }) {
  const sign = Math.sign(turn) || 1;
  // draw at least 70° of arc so small turns are still noticed; centred on the turn
  const span = Math.max(70, Math.min(160, Math.abs(turn)));
  const midDeg = at.rot - turn / 2;
  const a0 = ((midDeg - (sign * span) / 2) * Math.PI) / 180;
  const a1 = ((midDeg + (sign * span) / 2) * Math.PI) / 180;
  const R = TURN_ARC_R;
  const p = (ang: number) => ({ x: at.x + R * Math.sin(ang), y: at.y - R * Math.cos(ang) });
  const p0 = p(a0);
  const p1 = p(a1);
  const tangent = { x: Math.cos(a1) * sign, y: Math.sin(a1) * sign };
  const d = `M${p0.x},${p0.y} A${R},${R} 0 0 ${sign > 0 ? 1 : 0} ${p1.x},${p1.y}`;
  const hs = { stroke: color, strokeWidth: width, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <G>
      <Path d={d} {...hs} />
      <Path d={arrowHead(p1, tangent, Math.max(0.3, width * 2.3))} {...hs} />
    </G>
  );
}

interface AnimatedFootProps {
  foot: Foot;
  timeline: Timeline;
  beat: SharedValue<number>;
  bounds: Bounds;
  geometry: Geometry;
  theme: RoleTheme;
  footStyle: FootStyle;
  showLetters: boolean;
  letterSize: number;
  reduced: boolean;
}

/**
 * Landing squash / tap ripple length as a fraction of the step. They must finish before the step
 * ends (travel takes 60 %), so a resting pose never shows a half-played effect.
 */
const SQUASH_FRAC = 0.22;
const RIPPLE_FRAC = 0.36;

/**
 * One foot: an Animated.View translated/rotated on the UI thread, containing two static foot
 * SVGs (free/light underneath, weight-bearing/solid on top) whose opacity cross-fades. While the
 * foot travels it lifts a little (scale), on landing it squashes briefly; a tap sends out a dashed
 * ripple instead. Reduced motion: no lift / squash / ripple, only travel and the cross-fade.
 */
const AnimatedFoot = memo(function AnimatedFoot({
  foot,
  timeline,
  beat,
  bounds,
  geometry,
  theme,
  footStyle,
  showLetters,
  letterSize,
  reduced,
}: AnimatedFootProps) {
  const { scale, ox, oy } = geometry;
  const box = FOOT_BOX * scale;
  const minX = bounds.minX;
  const minY = bounds.minY;

  const moveStyle = useAnimatedStyle(() => {
    const b = beat.get();
    const p = footPoseAt(timeline, foot, b);
    let sx = 1;
    let sy = 1;
    if (!reduced) {
      const ph = footPhaseAt(timeline, foot, b);
      if (ph.moving && ph.kind !== KIND_CODE.hold) {
        if (ph.travel < 1) {
          const lift = 0.07 * Math.sin(Math.PI * ph.travel);
          sx = 1 + lift;
          sy = 1 + lift;
        } else if (ph.kind === KIND_CODE.step && ph.since >= 0 && ph.since < SQUASH_FRAC * ph.dur) {
          const q = 1 - ph.since / (SQUASH_FRAC * ph.dur);
          const s = Math.sin(Math.PI * (1 - q)) * q; // quick dip and recover
          sx = 1 + 0.1 * s;
          sy = 1 - 0.12 * s;
        }
      }
    }
    return {
      transform: [
        { translateX: ox + (p.x - minX) * scale - box / 2 },
        { translateY: oy + (p.y - minY) * scale - box / 2 },
        { rotate: `${p.rot}deg` },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  }, [timeline, foot, ox, oy, scale, box, minX, minY, reduced]);

  const solidStyle = useAnimatedStyle(() => ({ opacity: footPoseAt(timeline, foot, beat.get()).solid }), [timeline, foot]);

  const rippleStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: 0 };
    const ph = footPhaseAt(timeline, foot, beat.get());
    if (!ph.moving || ph.kind !== KIND_CODE.tap || ph.since < 0 || ph.since > RIPPLE_FRAC * ph.dur) return { opacity: 0 };
    const k = ph.since / (RIPPLE_FRAC * ph.dur);
    return { opacity: 0.85 * (1 - k), transform: [{ scale: 0.55 + 0.75 * k }] };
  }, [timeline, foot, reduced]);

  const ring = box * 0.92;
  return (
    <Animated.View
      testID={`diagram-foot-${foot}`}
      style={[{ position: 'absolute', left: 0, top: 0, width: box, height: box }, moveStyle]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: (box - ring) / 2,
            top: (box - ring) / 2,
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderWidth: 2.5,
            borderStyle: 'dashed',
            borderColor: theme.activeArrow,
          },
          rippleStyle,
        ]}
      />
      <FootSvg
        foot={foot}
        style={footStyle}
        color={theme.light}
        lip={theme.lightLip}
        stroke={theme.outline}
        letterColor={theme.letterOnLight}
        showLetter={showLetters}
        letterSize={letterSize}
      />
      <Animated.View style={[StyleSheet.absoluteFill, solidStyle]}>
        <FootSvg
          foot={foot}
          style={footStyle}
          color={theme.solid}
          lip={theme.solidLip}
          stroke={theme.outline}
          letterColor={theme.letterOnSolid}
          showLetter={showLetters}
          letterSize={letterSize}
        />
      </Animated.View>
    </Animated.View>
  );
});

const FOOT_VIEWBOX = `${-FOOT_BOX / 2} ${-FOOT_BOX / 2} ${FOOT_BOX} ${FOOT_BOX}`;

const FootSvg = memo(function FootSvg(props: {
  foot: Foot;
  style: FootStyle;
  color: string;
  lip: string;
  stroke: string;
  letterColor: string;
  showLetter: boolean;
  letterSize: number;
}) {
  return (
    <Svg width="100%" height="100%" viewBox={FOOT_VIEWBOX} style={StyleSheet.absoluteFill}>
      <FootShape {...props} />
    </Svg>
  );
});

// --- live layer: fixed pose ------------------------------------------------------------------

/** How many earlier positions a fixed pose (the editor) keeps as a faint trail. */
const TRAIL = 3;

/**
 * A fixed pose (the editor): the same focus hierarchy as playback around step `frame.index`
 * (its arrow beside the foot's path + badge, where the foot came from, the next destination),
 * plus a faint trail of the few positions before it. Later positions stay barely visible.
 */
const StaticPose = memo(function StaticPose({
  live,
  ghostMode,
  viewBox,
  theme,
  footStyle,
  showLetters,
  letterSize,
  unit,
  frame,
}: {
  live: LiveLayout;
  ghostMode: 'focus' | 'all';
  viewBox: string;
  theme: RoleTheme;
  footStyle: FootStyle;
  showLetters: boolean;
  letterSize: number;
  unit: number;
  frame: Frame;
}) {
  const index = Math.min(frame.index, live.steps.length - 1);
  const trail: LiveStep[] = [];
  if (ghostMode === 'focus') {
    for (let k = index - 1; k >= 0 && trail.length < TRAIL; k--) {
      const st = live.steps[k];
      if (st.kind === 'hold') continue;
      const covered = (['L', 'R'] as Foot[]).some((f) => samePos(frame.feet[f], st.to));
      const cur = live.steps[index];
      if (covered || (cur && samePos(cur.from, st.to)) || trail.some((t) => samePos(t.to, st.to))) continue;
      trail.push(st);
    }
  }
  return (
    <Svg width="100%" height="100%" viewBox={viewBox} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {trail.map((t, k) => (
        <FootShape
          key={`t${k}`}
          foot={t.foot}
          pos={t.to}
          style={footStyle}
          color={theme.ghostOrigin ?? theme.ghost}
          ghostWidth={Math.max(0.06, 1.4 * unit)}
          opacity={1 - k * 0.22}
          outline
        />
      ))}
      <FocusUnder live={live} index={index} theme={theme} footStyle={footStyle} unit={unit} ghostMode={ghostMode} letterSize={letterSize} />
      {(['L', 'R'] as Foot[]).map((f) => {
        const solid = frame.weight === null || frame.weight === f;
        return (
          <FootShape
            key={f}
            foot={f}
            pos={frame.feet[f]}
            style={footStyle}
            color={solid ? theme.solid : theme.light}
            lip={solid ? theme.solidLip : theme.lightLip}
            stroke={theme.outline}
            letterColor={solid ? theme.letterOnSolid : theme.letterOnLight}
            showLetter={showLetters}
            letterSize={letterSize}
          />
        );
      })}
      <FocusOver live={live} index={index} theme={theme} unit={unit} />
    </Svg>
  );
});

// --- glyphs ----------------------------------------------------------------------------------

function arrowHead(tip: Vec, dir: Vec, size = 0.32) {
  const n = { x: -dir.y, y: dir.x };
  const l = { x: tip.x - dir.x * size + n.x * size * 0.8, y: tip.y - dir.y * size + n.y * size * 0.8 };
  const r = { x: tip.x - dir.x * size - n.x * size * 0.8, y: tip.y - dir.y * size - n.y * size * 0.8 };
  return `M${l.x},${l.y} L${tip.x},${tip.y} L${r.x},${r.y}`;
}

/**
 * A chart arrow (printed view) or the editor's current-step arrow (`strong`). Chart numbers sit in
 * small white badges with a role-coloured ring so each reads as a sticker attached to its arrow.
 */
function ArrowGlyph({
  arrow,
  color,
  theme,
  strong,
  showLabel,
  unit,
}: {
  arrow: ChartArrow;
  color: string;
  theme: RoleTheme;
  strong?: boolean;
  showLabel: boolean;
  /** units per px (0 = no pixel minimums) */
  unit: number;
}) {
  const { a, b, c } = arrow;
  // a bowed arrow arrives along its control point → tip direction
  const from = c ?? a;
  const len = Math.hypot(b.x - from.x, b.y - from.y) || 1;
  const u = { x: (b.x - from.x) / len, y: (b.y - from.y) / len };
  const sw = strong ? 0.15 : Math.max(0.1, 2.2 * unit);
  const dash = arrow.dashed ? `${Math.max(0.22, sw * 2)} ${Math.max(0.18, sw * 1.8)}` : undefined;
  const head = { stroke: color, strokeWidth: sw, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const r = LABEL_SIZE * 0.5;
  const fs = arrow.label.length > 1 ? (arrow.label.length > 2 ? 0.36 : 0.46) : 0.56;
  return (
    <G>
      {c ? (
        <Path d={`M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`} stroke={color} strokeWidth={sw} strokeDasharray={dash} strokeLinecap="round" fill="none" />
      ) : (
        <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={sw} strokeDasharray={dash} strokeLinecap="round" />
      )}
      <Path d={arrowHead(b, u, Math.max(0.3, sw * 2.6))} {...head} />
      {arrow.type === 'inPlace' && <Path d={arrowHead(a, { x: -u.x, y: -u.y }, Math.max(0.3, sw * 2.6))} {...head} />}
      {showLabel && strong ? (
        <G>
          <Circle cx={arrow.labelAt.x} cy={arrow.labelAt.y} r={0.44} fill={theme.badge} stroke={theme.outline} strokeWidth={0.1} />
          <SvgText
            x={arrow.labelAt.x}
            y={arrow.labelAt.y + 0.19}
            fontSize={arrow.label.length > 1 ? 0.4 : 0.54}
            fontFamily={SVG_FONT}
            fill={theme.badgeText}
            textAnchor="middle"
          >
            {arrow.label}
          </SvgText>
        </G>
      ) : showLabel ? (
        <G>
          <Circle cx={arrow.labelAt.x} cy={arrow.labelAt.y} r={r - 0.02} fill={theme.outline} stroke={theme.label} strokeWidth={0.07} />
          <SvgText
            x={arrow.labelAt.x}
            y={arrow.labelAt.y + fs * 0.36}
            fontSize={fs}
            fontFamily={SVG_FONT_MEDIUM}
            fill={theme.label}
            textAnchor="middle"
          >
            {arrow.label}
          </SvgText>
        </G>
      ) : null}
    </G>
  );
}

const Grid = memo(function Grid({ bounds, theme }: { bounds: Bounds; theme: RoleTheme }) {
  const lines = [];
  for (let x = Math.ceil(bounds.minX); x <= bounds.maxX; x++) {
    lines.push(
      <Line
        key={`x${x}`}
        x1={x}
        y1={bounds.minY}
        x2={x}
        y2={bounds.maxY}
        stroke={x === 0 ? theme.gridAxis : theme.grid}
        strokeWidth={x === 0 ? 0.05 : 0.03}
      />,
    );
  }
  for (let y = Math.ceil(bounds.minY); y <= bounds.maxY; y++) {
    lines.push(
      <Line
        key={`y${y}`}
        x1={bounds.minX}
        y1={y}
        x2={bounds.maxX}
        y2={y}
        stroke={y === 0 ? theme.gridAxis : theme.grid}
        strokeWidth={y === 0 ? 0.05 : 0.03}
      />,
    );
  }
  return <G>{lines}</G>;
});
