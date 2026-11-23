import { memo, useEffect, useLayoutEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line } from 'react-native-svg';

import { StepDiagram, type Bounds, type TouchInfo } from '@/components/StepDiagram';
import { hapticSelect, hapticStep, Icon, IconButton, Stage, Text, useReducedMotion } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { computeStates, type Frame } from '@/lib/pattern';
import { colors, lip, radius, ROLE_COLOR, roleTheme, space, withAlpha, type ColorSet } from '@/lib/theme';
import type { Foot, FootPos, FootStyle, Pattern, Role } from '@/lib/types';

import {
  boundsStillFit,
  clampToBounds,
  fitBounds,
  inView,
  keepInView,
  nearestFoot,
  recenterSize,
  rotTowards,
  sameBounds,
  shiftBounds,
  snap,
} from './geometry';

/** What a finger on the canvas is doing (reported to the screen for the coach hint). */
export type CanvasMode = 'drag' | 'rotate' | 'pan' | null;

export interface EditorCanvasProps {
  pattern: Pattern;
  role: Role;
  footStyle: FootStyle;
  /** Dance-style colours (stage tint) */
  tone: ColorSet;
  /** -1 = start position */
  sel: number;
  startFoot: Foot;
  height: number;
  /** A foot was grabbed (drag or hold-to-rotate follows; one undo entry for the whole gesture). */
  onDragStart: (foot: Foot) => void;
  onDragMove: (foot: Foot, x: number, y: number) => void;
  /** Hold-to-rotate: turn the grabbed foot to `rot` degrees. */
  onDragRotate: (foot: Foot, rot: number) => void;
  onDragEnd: () => void;
  /** Touch on a foot of a hold step (nothing can move) */
  onBlockedTouch?: () => void;
  /** Finger down / up anywhere on the canvas (the page stops scrolling meanwhile) */
  onPressChange?: (down: boolean) => void;
  /** The gesture changed between dragging a foot, rotating it and panning the view. */
  onModeChange?: (mode: CanvasMode) => void;
}

/** −15° / +15° buttons for the foot being edited (sits beside the canvas). */
export function RotateTray({ onRotate, disabled }: { onRotate: (delta: number) => void; disabled?: boolean }) {
  const t = useT();
  return (
    <View style={s.tray}>
      <IconButton
        icon="rotate-left"
        label={t.editor.rotateLeft}
        variant="ghost"
        size={44}
        iconSize={21}
        disabled={disabled}
        onPress={() => onRotate(-15)}
        testID="rotate-left"
      />
      <View style={s.trayDivider} />
      <IconButton
        icon="rotate-right"
        label={t.editor.rotateRight}
        variant="ghost"
        size={44}
        iconSize={21}
        disabled={disabled}
        onPress={() => onRotate(15)}
        testID="rotate-right"
      />
    </View>
  );
}

/** Finger travel (px) that turns a press into a drag / pan. Below it a press stays a press. */
const SLOP_PX = 8;
/** Holding a foot this long without moving enters rotate mode. */
export const HOLD_MS = 380;
/** In rotate mode the angle only follows once the finger has travelled this far (px)… */
const ROT_GATE_PX = 10;
/** …and is at least this far from the foot's centre (diagram units), so it cannot spin wildly. */
const ROT_DEAD = 0.55;
/** Radius of the rotate dial (diagram units; a foot is ~2.6 long). */
const DIAL_R = 1.95;
/** While panning, the foot being edited stays at least this far inside the view. */
const PAN_MARGIN = 1.0;
/** After a drag ends near the edge of a panned view, the view slides so the foot has this much room. */
const ROOM = 1.9;
/** The gesture tips step aside after this many foot edits on the canvas. */
const TIP_USES = 5;
/** Wall clock for gesture bookkeeping (only called from touch handlers). */
const clock = () => Date.now();

type Phase = 'press' | 'drag' | 'rotate' | 'pan';

interface Gesture {
  phase: Phase;
  /** grabbed foot (null = empty floor) */
  foot: Foot | null;
  /** foot position minus touch point at grab time (keeps the grab offset, no jump) */
  dx: number;
  dy: number;
  /** first touch, local px */
  px0: number;
  py0: number;
  /** latest touch, local px */
  px: number;
  py: number;
  /** view when the finger went down (panning moves from here) */
  view0: Bounds;
  last: { x: number; y: number } | null;
  /** rotate mode: where the finger was when it started (px), and whether the angle follows yet */
  rx: number;
  ry: number;
  armed: boolean;
  lastRot: number | null;
  timer: ReturnType<typeof setTimeout> | null;
}

interface ViewState {
  b: Bounds;
  /** the user panned it: keep it (only nudged to keep the edited foot reachable) */
  user: boolean;
}

/**
 * The editor's working area: a Stage with the diagram (grid, ghosts of every position).
 *
 *   drag a foot            moves it (grab offset kept, snapped to the grid, kept inside the view)
 *   hold a foot (380 ms)   rotate mode: a dial appears and the toes point towards the finger
 *   drag the empty floor   pans the view; a tap on the floor changes nothing
 *
 * The view fits the whole dance until the user pans; then it stays where they left it, only
 * shifted as far as needed to keep the foot being edited in sight. The crosshair button re-fits.
 */
export const EditorCanvas = memo(function EditorCanvas(props: EditorCanvasProps) {
  const { tone, height } = props;
  const t = useT();
  return (
    <Stage
      tone={tone}
      height={height}
      padding={0}
      topInset={0}
      testID="editor-canvas"
      topLeft={
        <View style={s.tag} pointerEvents="none">
          <Icon name="arrow-up" size={13} color={colors.ink2} strokeWidth={2.8} />
          <Text variant="overline" color="ink2" style={s.tagText}>
            {t.player.facing}
          </Text>
        </View>
      }
    >
      {(area) =>
        area.width > 0 && area.height > 0 && <CanvasDiagram {...props} width={area.width} maxHeight={area.height} aspect={area.width / area.height} />
      }
    </Stage>
  );
});

function CanvasDiagram({
  pattern,
  role,
  footStyle,
  sel,
  startFoot,
  aspect,
  width,
  maxHeight,
  onDragStart,
  onDragMove,
  onDragRotate,
  onDragEnd,
  onBlockedTouch,
  onPressChange,
  onModeChange,
}: EditorCanvasProps & { aspect: number; width: number; maxHeight: number }) {
  const t = useT();
  /** what the finger is doing (drives the overlays); null = no finger down */
  const [phase, setPhase] = useState<{ phase: Phase; foot: Foot | null } | null>(null);
  const [view, setView] = useState<ViewState | null>(null);
  /**
   * Gesture tips in the corner: hold-to-turn and drag-the-floor, each until the user has done it
   * (all gone after a few foot edits); "more room?" after a foot was dragged against the edge.
   */
  const [tips, setTips] = useState({ hold: true, pan: true, edge: false, uses: 0 });

  const states = computeStates(pattern);
  const step = sel >= 0 ? pattern.steps[sel] : null;
  const after = states[sel + 1] ?? states[0];
  /** feet that can be grabbed right now */
  const editable: Partial<Record<Foot, FootPos>> = step ? (step.kind === 'hold' ? {} : { [step.foot]: step.to }) : pattern.start;
  /** feet that must stay reachable (in view) */
  const reach: FootPos[] = step && step.kind !== 'hold' ? [step.to] : [after.pos.L, after.pos.R];

  // The view: fitted to the dance until the user pans, then theirs. Adjusted during render
  // (never while a finger is down) so the edited foot can never end up out of sight.
  if (!phase) {
    let next = view;
    if (!view || !view.user) {
      if (!view || !boundsStillFit(view.b, pattern, aspect)) {
        const fitted = fitBounds(pattern, aspect);
        if (!view || !sameBounds(view.b, fitted)) next = { b: fitted, user: false };
      }
    } else {
      let b = view.b;
      const ba = (b.maxX - b.minX) / (b.maxY - b.minY);
      if (Math.abs(ba - aspect) > 0.02) b = recenterSize(b, fitBounds(pattern, aspect));
      b = keepInView(b, reach, PAN_MARGIN);
      if (!sameBounds(b, view.b)) next = { b, user: true };
    }
    if (next !== view) setView(next);
  }
  const bounds = view?.b ?? fitBounds(pattern, aspect);
  const userView = !!view?.user;

  const frame: Frame = {
    index: sel,
    feet: after.pos,
    // the foot being placed is drawn solid
    weight: sel < 0 ? startFoot : step && step.kind !== 'hold' ? step.foot : after.weight,
    progress: 1,
  };

  // Latest values for the gesture callbacks.
  const live = useRef({ pattern, sel, bounds, editable, after });
  useLayoutEffect(() => {
    live.current = { pattern, sel, bounds, editable, after };
  });
  const gesture = useRef<Gesture | null>(null);
  useEffect(
    () => () => {
      if (gesture.current?.timer) clearTimeout(gesture.current.timer);
    },
    [],
  );

  // Web: the canvas owns every touch (no page scroll / browser zoom, no text selection or the
  // iOS callout on a long press). Native gets the same from the responder + onPressChange.
  const wrapRef = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = wrapRef.current as unknown as {
      style: Record<string, string>;
      addEventListener: (type: string, fn: (e: { preventDefault: () => void }) => void) => void;
      removeEventListener: (type: string, fn: (e: { preventDefault: () => void }) => void) => void;
    } | null;
    if (!el?.style) return;
    el.style.touchAction = 'none';
    el.style.userSelect = 'none';
    el.style.webkitUserSelect = 'none';
    el.style.webkitTouchCallout = 'none';
    const block = (e: { preventDefault: () => void }) => e.preventDefault();
    el.addEventListener('contextmenu', block);
    return () => el.removeEventListener('contextmenu', block);
  }, []);

  const enter = (g: Gesture, p: Phase) => {
    g.phase = p;
    setPhase({ phase: p, foot: g.foot });
    onModeChange?.(p === 'press' ? null : p);
  };

  // StepDiagram reports the first touch point from an async measure(), so after a quick tap it
  // can arrive AFTER onTouchEnd. Remember such an early release and finish that tap right away.
  const releasedEarlyAt = useRef(0);

  const onTouch = (x: number, y: number, info: TouchInfo) => {
    const fresh = !gesture.current;
    handleTouch(x, y, info);
    if (fresh && releasedEarlyAt.current && clock() - releasedEarlyAt.current < 1000) {
      releasedEarlyAt.current = 0;
      finish();
    }
  };

  const startGesture = (x: number, y: number, info: TouchInfo) => {
    const { pattern: p, sel: i, bounds: b, editable: ed, after: af } = live.current;
    onPressChange?.(true);
    const st = i >= 0 ? p.steps[i] : null;
    const hit = nearestFoot(x, y, ed);
    const g: Gesture = {
      phase: 'press',
      foot: hit,
      dx: 0,
      dy: 0,
      px0: info.px,
      py0: info.py,
      px: info.px,
      py: info.py,
      view0: b,
      last: null,
      rx: 0,
      ry: 0,
      armed: false,
      lastRot: null,
      timer: null,
    };
    gesture.current = g;
    setPhase({ phase: 'press', foot: hit });
    if (!hit) {
      // empty floor: nothing happens unless the finger moves (then it pans)
      if (st?.kind === 'hold' && nearestFoot(x, y, af.pos)) onBlockedTouch?.();
      return;
    }
    const pos = ed[hit]!;
    g.dx = pos.x - x;
    g.dy = pos.y - y;
    onDragStart(hit);
    g.timer = setTimeout(() => {
      g.timer = null;
      if (gesture.current !== g || g.phase !== 'press') return;
      g.rx = g.px;
      g.ry = g.py;
      enter(g, 'rotate');
      hapticStep();
    }, HOLD_MS);
  };

  const handleTouch = (x: number, y: number, info: TouchInfo) => {
    const g = gesture.current;
    if (!g) {
      startGesture(x, y, info);
      return;
    }
    // a second finger: ignore (no pinch); the first finger carries on when it is lifted
    if (info.touches > 1) return;
    g.px = info.px;
    g.py = info.py;
    const travel = Math.hypot(info.px - g.px0, info.py - g.py0);

    if (g.phase === 'press') {
      if (travel < SLOP_PX) return;
      if (g.timer) clearTimeout(g.timer);
      g.timer = null;
      enter(g, g.foot ? 'drag' : 'pan');
    }

    if (g.phase === 'pan') {
      const { editable: ed, after: af, pattern: p, sel: i } = live.current;
      const st = i >= 0 ? p.steps[i] : null;
      const keep = st && st.kind !== 'hold' ? Object.values(ed) : [af.pos.L, af.pos.R];
      const moved = shiftBounds(g.view0, -(info.px - g.px0) / info.scale, -(info.py - g.py0) / info.scale);
      const b = keepInView(moved, keep, PAN_MARGIN);
      setView({ b, user: true });
      return;
    }

    if (!g.foot) return;

    if (g.phase === 'rotate') {
      if (!g.armed) {
        if (Math.hypot(info.px - g.rx, info.py - g.ry) < ROT_GATE_PX) return;
        g.armed = true;
      }
      const pos = live.current.editable[g.foot];
      if (!pos) return;
      const vx = x - pos.x;
      const vy = y - pos.y;
      if (Math.hypot(vx, vy) < ROT_DEAD) return;
      const rot = rotTowards(vx, vy);
      if (rot === (g.lastRot ?? pos.rot)) return;
      g.lastRot = rot;
      onDragRotate(g.foot, rot);
      hapticSelect();
      return;
    }

    // drag
    const b = g.view0;
    const rx = x + g.dx;
    const ry = y + g.dy;
    const c = clampToBounds(rx, ry, b);
    if ((Math.abs(c.x - rx) > 0.3 || Math.abs(c.y - ry) > 0.3) && !tips.edge) setTips((v) => ({ ...v, edge: true }));
    const nx = snap(c.x);
    const ny = snap(c.y);
    if (g.last && g.last.x === nx && g.last.y === ny) return;
    g.last = { x: nx, y: ny };
    onDragMove(g.foot, nx, ny);
  };

  const onTouchEnd = () => {
    if (!gesture.current) {
      releasedEarlyAt.current = clock();
      return;
    }
    finish();
  };

  const finish = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g?.timer) clearTimeout(g.timer);
    setPhase(null);
    onPressChange?.(false);
    if (g && g.phase !== 'press') onModeChange?.(null);
    if (!g) return;
    if (g.foot) onDragEnd();
    if (g.phase === 'pan') {
      setTips((v) => ({ ...v, pan: false, edge: false }));
    } else if (g.phase === 'drag' || g.phase === 'rotate') {
      const rotated = g.phase === 'rotate';
      setTips((v) => {
        const uses = v.uses + 1;
        return { ...v, uses, hold: v.hold && !rotated && uses < TIP_USES, pan: v.pan && uses < TIP_USES };
      });
      // a foot left near the edge of a panned view: slide the view so it has room around it
      if (g.phase === 'drag' && g.last && view?.user && !inView(g.view0, g.last.x, g.last.y, ROOM)) {
        setView({ b: keepInView(g.view0, [g.last], ROOM), user: true });
      }
    }
  };

  // --- overlays ---------------------------------------------------------------------------
  const vbW = bounds.maxX - bounds.minX;
  const vbH = bounds.maxY - bounds.minY;
  const scale = Math.min(width / vbW, maxHeight / vbH);
  const ox = (width - vbW * scale) / 2;
  const oy = (maxHeight - vbH * scale) / 2;
  const unit = 1 / scale;
  const viewBox = `${bounds.minX} ${bounds.minY} ${vbW} ${vbH}`;
  const rc = ROLE_COLOR[role];
  const rotating = phase?.phase === 'rotate' && phase.foot ? editable[phase.foot] : undefined;
  const halos = phase ? [] : (Object.values(editable) as FootPos[]);
  const tipLines = tips.edge
    ? [t.coach.edgeTip]
    : [tips.hold && Object.keys(editable).length > 0 && t.coach.holdTip, tips.pan && t.coach.panTip].filter((x): x is string => !!x);

  return (
    <View ref={wrapRef} testID="editor-diagram" style={s.fill}>
      <StepDiagram
        pattern={pattern}
        theme={roleTheme(role)}
        footStyle={footStyle}
        mode="live"
        frame={frame}
        bounds={bounds}
        grid
        maxHeight={maxHeight}
        onTouch={onTouch}
        onTouchEnd={onTouchEnd}
      />
      {halos.length > 0 && <Halos feet={halos} viewBox={viewBox} unit={unit} color={rc.base} />}
      {rotating && (
        <>
          <Svg style={StyleSheet.absoluteFill} viewBox={viewBox} pointerEvents="none">
            <Dial pos={rotating} unit={unit} color={rc.base} deep={rc.deep} />
          </Svg>
          <AngleLabel
            rot={rotating.rot}
            x={ox + (rotating.x - bounds.minX) * scale}
            y={oy + (rotating.y - bounds.minY) * scale}
            r={DIAL_R * scale}
            height={maxHeight}
            color={rc.deep}
            border={rc.base}
          />
        </>
      )}
      {tipLines.length > 0 && !phase && (
        <View style={s.tip} pointerEvents="none" testID="canvas-tip">
          {tipLines.map((line) => (
            <Text key={line} variant="caption" color="ink2" numberOfLines={2}>
              {line}
            </Text>
          ))}
        </View>
      )}
      {userView && (
        <View style={s.recenter} pointerEvents="box-none">
          <IconButton
            icon="recenter"
            label={t.editor.recenter}
            size={40}
            iconSize={20}
            onPress={() => setView(null)}
            testID="canvas-recenter"
          />
        </View>
      )}
    </View>
  );
}

/** Pulsing dashed outlines around the feet that can be dragged ("move me"). */
function Halos({ feet, viewBox, unit, color }: { feet: FootPos[]; viewBox: string; unit: number; color: string }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!reduced) v.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [reduced, v]);
  const st = useAnimatedStyle(() => ({ opacity: 1 - v.get() * 0.5 }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, st]} pointerEvents="none" testID="foot-halo">
      <Svg style={StyleSheet.absoluteFill} viewBox={viewBox} pointerEvents="none">
        {feet.map((f, i) => (
          <Ellipse
            key={i}
            transform={`translate(${f.x} ${f.y}) rotate(${f.rot})`}
            rx={0.74}
            ry={1.66}
            fill="none"
            stroke={color}
            strokeWidth={2.2 * unit}
            strokeDasharray={`${6 * unit} ${5 * unit}`}
            strokeLinecap="round"
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** Rotate mode: a ring around the foot with 15° ticks and a knob where the toes point. */
function Dial({ pos, unit, color, deep }: { pos: FootPos; unit: number; color: string; deep: string }) {
  const ticks = [];
  for (let a = 0; a < 360; a += 15) {
    const major = a % 90 === 0;
    const r = (a * Math.PI) / 180;
    const sx = Math.sin(r);
    const sy = -Math.cos(r);
    const r0 = DIAL_R - (major ? 0.34 : 0.17);
    ticks.push(
      <Line
        key={a}
        x1={sx * r0}
        y1={sy * r0}
        x2={sx * DIAL_R}
        y2={sy * DIAL_R}
        stroke={withAlpha(color, major ? 0.75 : 0.45)}
        strokeWidth={(major ? 2.4 : 1.6) * unit}
        strokeLinecap="round"
      />,
    );
  }
  const r = (pos.rot * Math.PI) / 180;
  const kx = Math.sin(r) * DIAL_R;
  const ky = -Math.cos(r) * DIAL_R;
  const inner = 1.42;
  return (
    <G transform={`translate(${pos.x} ${pos.y})`}>
      <Circle r={DIAL_R} fill={withAlpha(color, 0.1)} stroke={color} strokeWidth={2.4 * unit} />
      {ticks}
      <Line
        x1={Math.sin(r) * inner}
        y1={-Math.cos(r) * inner}
        x2={kx}
        y2={ky}
        stroke={deep}
        strokeWidth={3 * unit}
        strokeLinecap="round"
      />
      <Circle cx={kx} cy={ky} r={9 * unit} fill={color} stroke={colors.card} strokeWidth={2.5 * unit} />
    </G>
  );
}

const LABEL_W = 76;
const LABEL_H = 30;

/** The current angle in a pill above the dial (below it when the dial is near the top). */
function AngleLabel({
  rot,
  x,
  y,
  r,
  height,
  color,
  border,
}: {
  rot: number;
  x: number;
  y: number;
  r: number;
  height: number;
  color: string;
  border: string;
}) {
  // above the dial, clear of the "Facing" tag; below it when there is no room up there
  const above = y - r - 8 - LABEL_H;
  const below = y + r + 8;
  const top = above >= 42 || below + LABEL_H > height - 4 ? Math.max(4, above) : below;
  return (
    <View
      style={[s.angle, { left: x - LABEL_W / 2, top, borderColor: border }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      testID="rotate-angle"
    >
      {rot !== 0 && <Icon name={rot > 0 ? 'rotate-right' : 'rotate-left'} size={14} color={color} strokeWidth={2.8} />}
      <Text variant="smallStrong" style={{ color }}>
        {`${Math.abs(rot)}°`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.card, 0.85),
  },
  tagText: { fontSize: 10.5 },
  tip: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    maxWidth: '78%',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    backgroundColor: withAlpha(colors.card, 0.88),
  },
  recenter: { position: 'absolute', right: 10, top: 10 },
  angle: {
    position: 'absolute',
    width: LABEL_W,
    height: LABEL_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: radius.pill,
    borderWidth: 2,
    backgroundColor: colors.card,
  },
  tray: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderBottomWidth: lip.md,
    borderBottomColor: colors.cardLip,
    paddingHorizontal: 2,
  },
  trayDivider: { width: 2, height: 22, borderRadius: 1, backgroundColor: colors.track, marginHorizontal: space.xxs - 2 },
});
