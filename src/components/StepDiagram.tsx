/**
 * The footprint diagram: printed-style chart, animated player view and editor canvas.
 *
 * Layers (bottom → top):
 *   1. StaticLayer  – grid, ghost outlines / chart feet, chart arrows + labels. Memoised SVG that
 *                     only re-renders when the pattern, theme or size changes, never during playback.
 *   2. Live layer   – the current step's arrow and the two feet.
 *        • with `beat` (a Reanimated SharedValue from usePlayback): each foot is an absolutely
 *          positioned Animated.View holding a small static foot SVG; position/rotation are
 *          transform styles and the weight change is an opacity cross-fade, all computed on the
 *          UI thread from a precomputed timeline (no React renders per frame). The arrow layer
 *          re-renders once per step.
 *        • with `frame` (a fixed pose, e.g. the editor) or nothing: drawn statically.
 *
 * Height is reserved from the first frame via `aspectRatio` (from the bounds), so there is no
 * layout jump when the width becomes known. All colours come from `theme`.
 */
import { memo, useDeferredValue, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { growTo, layoutChart, LABEL_SIZE, type Bounds, type ChartArrow, type ChartLayout, type Vec } from '@/lib/chartLayout';
import { buildTimeline, computeStates, footPoseAt, stepIndexAt, type Frame, type Timeline } from '@/lib/pattern';
import type { RoleTheme } from '@/lib/theme';
import type { Foot, FootPos, FootStyle, Pattern } from '@/lib/types';

import { FOOT_BOX, FootShape, SVG_FONT } from './FootShape';

export type { Bounds };
export { SVG_FONT };

/** Labels smaller than this (on screen) are hidden when `showLabels="auto"` (tiny thumbnails). */
export const MIN_LABEL_PX = 11;

export interface StepDiagramProps {
  pattern: Pattern;
  theme: RoleTheme;
  footStyle: FootStyle;
  /** overview = every step numbered (like a printed chart); live = current state of the feet */
  mode: 'overview' | 'live';
  /** live mode: animate from this beat clock (`usePlayback().beat`) */
  beat?: SharedValue<number>;
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

/** How the viewBox maps into the view (SVG default preserveAspectRatio="xMidYMid meet"). */
function fit(size: Size, b: Bounds) {
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const scale = Math.min(size.width / bw, size.height / bh);
  return { scale, ox: (size.width - bw * scale) / 2, oy: (size.height - bh * scale) / 2 };
}

export const StepDiagram = memo(function StepDiagram({
  pattern,
  theme,
  footStyle,
  mode,
  beat,
  frame,
  showLetters = true,
  showLabels = 'auto',
  maxHeight = 420,
  bounds: fixedBounds,
  grid,
  onTouch,
  onTouchEnd,
}: StepDiagramProps) {
  const [size, setSize] = useState<Size | null>(null);

  // While dragging in the editor the pattern changes on every snapped move; the chart layout
  // (ghosts + arrows) may lag a frame behind so the dragged foot itself stays responsive.
  const layoutPattern = useDeferredValue(pattern);
  // The live editor canvas (fixed bounds) never shows labels: skip placing them.
  const needLabels = !(mode === 'live' && fixedBounds);
  const layout = useMemo(
    () => layoutChart(layoutPattern, computeStates(layoutPattern), { labels: needLabels }),
    [layoutPattern, needLabels],
  );
  const timeline = useMemo(() => (beat ? buildTimeline(pattern) : null), [beat, pattern]);

  const bounds = fixedBounds ?? layout.bounds;
  const vbW = bounds.maxX - bounds.minX;
  const vbH = bounds.maxY - bounds.minY;
  const viewBox = `${bounds.minX} ${bounds.minY} ${vbW} ${vbH}`;
  const geometry = size ? fit(size, bounds) : null;
  const labelsVisible =
    mode === 'overview' &&
    (showLabels === true || (showLabels === 'auto' && !!geometry && LABEL_SIZE * geometry.scale >= MIN_LABEL_PX));

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
      style={{ width: '100%', aspectRatio: vbW / vbH, maxHeight }}
      {...(onTouch ? responder.panHandlers : {})}
    >
      <StaticLayer
        layout={layout}
        viewBox={viewBox}
        bounds={bounds}
        theme={theme}
        footStyle={footStyle}
        mode={mode}
        grid={!!grid}
        showLetters={showLetters}
        showLabels={labelsVisible}
      />
      {mode === 'live' &&
        (beat && timeline ? (
          geometry && (
            <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
              <LiveArrow layout={layout} timeline={timeline} beat={beat} viewBox={viewBox} theme={theme} showLabel={needLabels} />
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
                />
              ))}
            </View>
          )
        ) : (
          <StaticPose
            layout={layout}
            viewBox={viewBox}
            theme={theme}
            footStyle={footStyle}
            showLetters={showLetters}
            showLabel={needLabels}
            frame={frame ?? { index: -1, feet: pattern.start, weight: null, progress: 1 }}
          />
        ))}
    </View>
  );
});

// --- static layer --------------------------------------------------------------------------

interface StaticLayerProps {
  layout: ChartLayout;
  viewBox: string;
  bounds: Bounds;
  theme: RoleTheme;
  footStyle: FootStyle;
  mode: 'overview' | 'live';
  grid: boolean;
  showLetters: boolean;
  showLabels: boolean;
}

const StaticLayer = memo(function StaticLayer({
  layout,
  viewBox,
  bounds,
  theme,
  footStyle,
  mode,
  grid,
  showLetters,
  showLabels,
}: StaticLayerProps) {
  return (
    <Svg width="100%" height="100%" viewBox={viewBox} style={StyleSheet.absoluteFill}>
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
              ghostFill={theme.ghostFill}
              ghostWidth={0.09}
              letterColor={p.isStart ? theme.letterOnSolid : theme.letterOnLight}
              outline={p.isTap}
              showLetter={showLetters}
            />
          ))}
          {layout.arrows.map((a) => (
            <ArrowGlyph key={a.key} arrow={a} color={theme.arrow} labelColor={theme.label} showLabel={showLabels} />
          ))}
        </G>
      ) : (
        <G>
          {layout.feet.map((p, i) => (
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

/** The current step's arrow. Re-renders only when the step index changes. */
const LiveArrow = memo(function LiveArrow({
  layout,
  timeline,
  beat,
  viewBox,
  theme,
  showLabel,
}: {
  layout: ChartLayout;
  timeline: Timeline;
  beat: SharedValue<number>;
  viewBox: string;
  theme: RoleTheme;
  showLabel: boolean;
}) {
  const [index, setIndex] = useState(-1);
  useAnimatedReaction(
    () => stepIndexAt(timeline.starts, timeline.total, beat.get()),
    (i, prev) => {
      if (i !== prev) scheduleOnRN(setIndex, i);
    },
    [timeline],
  );
  const current = layout.arrows.find((a) => a.index === index);
  if (!current) return null;
  return (
    <Svg width="100%" height="100%" viewBox={viewBox} style={StyleSheet.absoluteFill}>
      <ArrowGlyph arrow={current} color={theme.activeArrow} labelColor={theme.label} theme={theme} strong showLabel={showLabel} />
    </Svg>
  );
});

interface AnimatedFootProps {
  foot: Foot;
  timeline: Timeline;
  beat: SharedValue<number>;
  bounds: Bounds;
  geometry: { scale: number; ox: number; oy: number };
  theme: RoleTheme;
  footStyle: FootStyle;
  showLetters: boolean;
}

/**
 * One foot: an Animated.View translated/rotated on the UI thread, containing two static foot
 * SVGs (free/light underneath, weight-bearing/solid on top) whose opacity cross-fades.
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
}: AnimatedFootProps) {
  const { scale, ox, oy } = geometry;
  const box = FOOT_BOX * scale;
  const minX = bounds.minX;
  const minY = bounds.minY;

  const moveStyle = useAnimatedStyle(() => {
    const p = footPoseAt(timeline, foot, beat.get());
    return {
      transform: [
        { translateX: ox + (p.x - minX) * scale - box / 2 },
        { translateY: oy + (p.y - minY) * scale - box / 2 },
        { rotate: `${p.rot}deg` },
      ],
    };
  }, [timeline, foot, ox, oy, scale, box, minX, minY]);

  const solidStyle = useAnimatedStyle(
    () => ({ opacity: footPoseAt(timeline, foot, beat.get()).solid }),
    [timeline, foot],
  );

  return (
    <Animated.View
      testID={`diagram-foot-${foot}`}
      style={[{ position: 'absolute', left: 0, top: 0, width: box, height: box }, moveStyle]}
    >
      <FootSvg
        foot={foot}
        style={footStyle}
        color={theme.light}
        lip={theme.lightLip}
        stroke={theme.outline}
        letterColor={theme.letterOnLight}
        showLetter={showLetters}
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
}) {
  return (
    <Svg width="100%" height="100%" viewBox={FOOT_VIEWBOX} style={StyleSheet.absoluteFill}>
      <FootShape {...props} />
    </Svg>
  );
});

// --- live layer: fixed pose ------------------------------------------------------------------

const StaticPose = memo(function StaticPose({
  layout,
  viewBox,
  theme,
  footStyle,
  showLetters,
  showLabel,
  frame,
}: {
  layout: ChartLayout;
  viewBox: string;
  theme: RoleTheme;
  footStyle: FootStyle;
  showLetters: boolean;
  showLabel: boolean;
  frame: Frame;
}) {
  const current = layout.arrows.find((a) => a.index === frame.index);
  return (
    <Svg width="100%" height="100%" viewBox={viewBox} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {current && (
        <ArrowGlyph arrow={current} color={theme.activeArrow} labelColor={theme.label} theme={theme} strong showLabel={showLabel} />
      )}
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
          />
        );
      })}
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

function ArrowGlyph({
  arrow,
  color,
  labelColor,
  theme,
  strong,
  showLabel,
}: {
  arrow: ChartArrow;
  color: string;
  labelColor: string;
  /** strong arrows draw their number in a round badge in the role colour */
  theme?: RoleTheme;
  strong?: boolean;
  showLabel: boolean;
}) {
  const { a, b } = arrow;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const sw = strong ? 0.15 : 0.09;
  const dash = arrow.dashed ? '0.25 0.18' : undefined;
  const head = { stroke: color, strokeWidth: sw, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <G>
      <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={sw} strokeDasharray={dash} strokeLinecap="round" />
      <Path d={arrowHead(b, u)} {...head} />
      {arrow.type === 'inPlace' && <Path d={arrowHead(a, { x: -u.x, y: -u.y })} {...head} />}
      {showLabel && strong && theme ? (
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
        <SvgText
          x={arrow.labelAt.x}
          y={arrow.labelAt.y + LABEL_SIZE * 0.36}
          fontSize={LABEL_SIZE}
          fontFamily={SVG_FONT}
          fill={labelColor}
          textAnchor="middle"
        >
          {arrow.label}
        </SvgText>
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
