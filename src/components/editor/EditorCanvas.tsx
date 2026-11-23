import { memo, useLayoutEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StepDiagram, type Bounds } from '@/components/StepDiagram';
import { Icon, IconButton, Stage, Text } from '@/components/ui';
import { computeStates, type Frame } from '@/lib/pattern';
import { colors, lip, radius, roleTheme, space, withAlpha, type ColorSet } from '@/lib/theme';
import type { Foot, FootPos, FootStyle, Pattern, Role } from '@/lib/types';

import { boundsStillFit, clampToBounds, fitBounds, nearestFoot, snap } from './geometry';

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
  onDragStart: (foot: Foot) => void;
  onDragMove: (foot: Foot, x: number, y: number) => void;
  onDragEnd: () => void;
  /** Touch on a hold step (nothing can move) */
  onBlockedTouch?: () => void;
  /** Finger down / up anywhere on the canvas (the page stops scrolling meanwhile) */
  onPressChange?: (down: boolean) => void;
}

/** −15° / +15° buttons for the foot being edited (sits beside the canvas). */
export function RotateTray({ onRotate, disabled }: { onRotate: (delta: number) => void; disabled?: boolean }) {
  return (
    <View style={s.tray}>
      <IconButton
        icon="rotate-left"
        label="Rotate foot 15 degrees left"
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
        label="Rotate foot 15 degrees right"
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

/** Minimum finger travel (diagram units) before a grabbed foot starts to follow. */
const MOVE_THRESHOLD = 0.12;
/** Wall clock for gesture bookkeeping (only called from touch handlers). */
const clock = () => Date.now();

interface Gesture {
  foot: Foot | null;
  /** foot position minus touch point at grab time (keeps the grab offset, no jump) */
  dx: number;
  dy: number;
  x0: number;
  y0: number;
  moved: boolean;
  last: { x: number; y: number } | null;
}

/**
 * The editor's working area: a Stage with the diagram (grid, ghosts of every position) where the
 * foot being edited is dragged directly, or placed with a tap on the floor. Zoom is fixed while
 * a finger is down and re-fits on release only when a foot gets too close to the edge.
 */
export const EditorCanvas = memo(function EditorCanvas(props: EditorCanvasProps) {
  const { tone, height } = props;
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
            Facing
          </Text>
        </View>
      }
    >
      {(area) => area.width > 0 && area.height > 0 && <CanvasDiagram {...props} aspect={area.width / area.height} maxHeight={area.height} />}
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
  maxHeight,
  onDragStart,
  onDragMove,
  onDragEnd,
  onBlockedTouch,
  onPressChange,
}: EditorCanvasProps & { aspect: number; maxHeight: number }) {
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<Bounds | null>(null);
  // Re-fit only when needed and never while a finger is down (adjusting state during render).
  if (!dragging && (!view || !boundsStillFit(view, pattern, aspect))) {
    const fitted = fitBounds(pattern, aspect);
    if (!view || !sameBounds(view, fitted)) setView(fitted);
  }
  const bounds = view ?? fitBounds(pattern, aspect);

  const states = computeStates(pattern);
  const step = sel >= 0 ? pattern.steps[sel] : null;
  const after = states[sel + 1] ?? states[0];
  const frame: Frame = {
    index: sel,
    feet: after.pos,
    // the foot being placed is drawn solid
    weight: sel < 0 ? startFoot : step && step.kind !== 'hold' ? step.foot : after.weight,
    progress: 1,
  };

  // Latest values for the gesture callbacks.
  const live = useRef({ pattern, sel, startFoot, bounds });
  useLayoutEffect(() => {
    live.current = { pattern, sel, startFoot, bounds };
  });
  const gesture = useRef<Gesture | null>(null);

  // StepDiagram reports the first touch point from an async measure(), so after a quick tap it
  // can arrive AFTER onTouchEnd. Remember such an early release and finish that tap right away.
  const releasedEarlyAt = useRef(0);

  const onTouch = (x: number, y: number) => {
    const fresh = !gesture.current;
    handleTouch(x, y);
    if (fresh && releasedEarlyAt.current && clock() - releasedEarlyAt.current < 1000) {
      releasedEarlyAt.current = 0;
      finish();
    }
  };

  const handleTouch = (x: number, y: number) => {
    const { pattern: p, sel: i, startFoot: sf, bounds: b } = live.current;
    let g = gesture.current;
    if (!g) {
      onPressChange?.(true);
      const st = i >= 0 ? p.steps[i] : null;
      if (st?.kind === 'hold') {
        gesture.current = { foot: null, dx: 0, dy: 0, x0: x, y0: y, moved: false, last: null };
        onBlockedTouch?.();
        return;
      }
      const editable: Partial<Record<Foot, FootPos>> = st ? { [st.foot]: st.to } : p.start;
      const hit = nearestFoot(x, y, editable);
      setDragging(true);
      if (hit) {
        const pos = editable[hit]!;
        gesture.current = { foot: hit, dx: pos.x - x, dy: pos.y - y, x0: x, y0: y, moved: false, last: null };
        onDragStart(hit);
        return;
      }
      // a tap on empty floor places the foot being edited right there (then it follows the finger)
      const foot = st ? st.foot : sf;
      g = { foot, dx: 0, dy: 0, x0: x, y0: y, moved: true, last: null };
      gesture.current = g;
      onDragStart(foot);
    }
    if (!g.foot) return;
    if (!g.moved) {
      if (Math.hypot(x - g.x0, y - g.y0) < MOVE_THRESHOLD) return;
      g.moved = true;
    }
    const c = clampToBounds(x + g.dx, y + g.dy, b);
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
    const had = gesture.current;
    gesture.current = null;
    setDragging(false);
    onPressChange?.(false);
    if (had?.foot) onDragEnd();
  };

  return (
    <View testID="editor-diagram" style={s.fill}>
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
    </View>
  );
}

function sameBounds(a: Bounds, b: Bounds) {
  return Math.abs(a.minX - b.minX) < 1e-6 && Math.abs(a.maxX - b.maxX) < 1e-6 && Math.abs(a.minY - b.minY) < 1e-6 && Math.abs(a.maxY - b.maxY) < 1e-6;
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
