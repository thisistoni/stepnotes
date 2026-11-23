import { useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { PanResponder, Platform, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

import { growTo, layoutChart, LABEL_SIZE, type Bounds, type ChartArrow, type ChartLayout, type Vec } from '@/lib/chartLayout';
import { computeStates, type Frame } from '@/lib/pattern';
import { colors, type RoleTheme } from '@/lib/theme';
import type { Foot, FootPos, FootStyle, Pattern } from '@/lib/types';

import { FootShape } from './FootShape';

export type { Bounds };

export const SVG_FONT = Platform.OS === 'web' ? 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' : undefined;

interface Props {
  pattern: Pattern;
  theme: RoleTheme;
  footStyle: FootStyle;
  /** overview = every step numbered (like a printed chart); live = animated current state */
  mode: 'overview' | 'live';
  frame?: Frame;
  showLetters?: boolean;
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

export function StepDiagram({
  pattern,
  theme,
  footStyle,
  mode,
  frame,
  showLetters = true,
  maxHeight = 420,
  bounds: fixedBounds,
  grid,
  onTouch,
  onTouchEnd,
}: Props) {
  const [width, setWidth] = useState(0);
  const layout = useMemo(() => layoutChart(pattern, computeStates(pattern)), [pattern]);
  const bounds = fixedBounds ?? layout.bounds;
  const vbW = bounds.maxX - bounds.minX;
  const vbH = bounds.maxY - bounds.minY;
  const height = width ? Math.min(maxHeight, (width * vbH) / vbW) : 0;

  // --- touch handling (editor) --------------------------------------------------------
  const containerRef = useRef<ComponentRef<typeof View>>(null);
  const origin = useRef({ x: 0, y: 0 });
  const geom = useRef({ width, height, bounds });
  const onTouchRef = useRef(onTouch);
  const onTouchEndRef = useRef(onTouchEnd);
  useLayoutEffect(() => {
    geom.current = { width, height, bounds };
    onTouchRef.current = onTouch;
    onTouchEndRef.current = onTouchEnd;
  });

  // The refs are only read inside the gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => {
    const emit = (pageX: number, pageY: number) => {
      const { width: w, height: h, bounds: b } = geom.current;
      const bw = b.maxX - b.minX;
      const bh = b.maxY - b.minY;
      const scale = Math.min(w / bw, h / bh);
      const ox = (w - bw * scale) / 2;
      const oy = (h - bh * scale) / 2;
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
        containerRef.current?.measure((_x, _y, _w, _h, px, py) => {
          origin.current = { x: px, y: py };
          emit(pageX, pageY);
        });
      },
      onPanResponderMove: (e) => emit(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: () => onTouchEndRef.current?.(),
      onPanResponderTerminate: () => onTouchEndRef.current?.(),
    });
  });

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    containerRef.current?.measure((_x, _y, _w, _h, px, py) => {
      origin.current = { x: px, y: py };
    });
  };

  return (
    <View
      ref={containerRef}
      onLayout={onLayout}
      style={{ width: '100%', height: height || 200 }}
      {...(onTouch ? responder.panHandlers : {})}
    >
      {width > 0 && (
        <Svg width={width} height={height} viewBox={`${bounds.minX} ${bounds.minY} ${vbW} ${vbH}`}>
          {grid && <Grid bounds={bounds} />}
          {mode === 'overview' ? (
            <Overview layout={layout} theme={theme} footStyle={footStyle} showLetters={showLetters} />
          ) : (
            <Live
              layout={layout}
              theme={theme}
              footStyle={footStyle}
              showLetters={showLetters}
              frame={frame ?? { index: -1, feet: pattern.start, weight: null, progress: 1 }}
            />
          )}
        </Svg>
      )}
    </View>
  );
}

interface DrawProps {
  layout: ChartLayout;
  theme: RoleTheme;
  footStyle: FootStyle;
  showLetters: boolean;
}

/** Every position + numbered arrows, like a printed step chart. */
function Overview({ layout, theme, footStyle, showLetters }: DrawProps) {
  return (
    <G>
      {layout.feet.map((p, i) => (
        <FootShape
          key={`f${i}`}
          foot={p.foot}
          pos={p.pos}
          style={footStyle}
          color={p.isStart ? theme.solid : theme.light}
          outline={p.isTap}
          showLetter={showLetters}
        />
      ))}
      {layout.arrows.map((a) => (
        <ArrowGlyph key={a.key} arrow={a} color={colors.arrow} labelColor={theme.label} />
      ))}
    </G>
  );
}

/** Animated feet for the current frame, with ghost outlines of every position. */
function Live({ layout, theme, footStyle, showLetters, frame }: DrawProps & { frame: Frame }) {
  const current = layout.arrows.find((a) => a.index === frame.index);
  return (
    <G>
      {layout.feet.map((p, i) => (
        <FootShape key={`g${i}`} foot={p.foot} pos={p.pos} style={footStyle} color={theme.light} outline opacity={0.55} />
      ))}
      {current && <ArrowGlyph arrow={current} color={theme.label} labelColor={theme.label} strong />}
      {(['L', 'R'] as Foot[]).map((f) => (
        <FootShape
          key={f}
          foot={f}
          pos={frame.feet[f]}
          style={footStyle}
          color={frame.weight === null || frame.weight === f ? theme.solid : theme.light}
          showLetter={showLetters}
        />
      ))}
    </G>
  );
}

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
  strong,
}: {
  arrow: ChartArrow;
  color: string;
  labelColor: string;
  strong?: boolean;
}) {
  const { a, b } = arrow;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const sw = strong ? 0.13 : 0.085;
  const dash = arrow.dashed ? '0.25 0.18' : undefined;
  const head = { stroke: color, strokeWidth: sw, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <G>
      <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={sw} strokeDasharray={dash} strokeLinecap="round" />
      <Path d={arrowHead(b, u)} {...head} />
      {arrow.type === 'inPlace' && <Path d={arrowHead(a, { x: -u.x, y: -u.y })} {...head} />}
      <SvgText
        x={arrow.labelAt.x}
        y={arrow.labelAt.y + LABEL_SIZE * 0.36}
        fontSize={LABEL_SIZE}
        fontWeight="800"
        fontFamily={SVG_FONT}
        fill={labelColor}
        textAnchor="middle"
      >
        {arrow.label}
      </SvgText>
    </G>
  );
}

function Grid({ bounds }: { bounds: Bounds }) {
  const lines = [];
  for (let x = Math.ceil(bounds.minX); x <= bounds.maxX; x++) {
    lines.push(
      <Line
        key={`x${x}`}
        x1={x}
        y1={bounds.minY}
        x2={x}
        y2={bounds.maxY}
        stroke={x === 0 ? '#D6D0C6' : '#ECE8E1'}
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
        stroke={y === 0 ? '#D6D0C6' : '#ECE8E1'}
        strokeWidth={y === 0 ? 0.05 : 0.03}
      />,
    );
  }
  return <G>{lines}</G>;
}
