/**
 * The player without the library around it: the stage (animated diagram or chart), the count
 * block, the transport, tempo, practice toggles, the list of all steps and the about card.
 * Used by the library route (`/dance/[id]`), a shared link (`/s/[id]`) and a class post
 * (`/c/[code]/[postId]`); each route brings its own header actions, menus and footer.
 *
 *   <PlayerView dance={d} ref={player} headerRight={(narrow) => <IconButton … />} />
 *   player.current?.pause();   // before navigating away (edit, make my own)
 *
 * Render budget: the screen re-renders once per step at most (usePlayback's `index`); the feet,
 * the ring and the arrow glide run on the UI thread from the shared `beat`.
 */
import { useCallback, useImperativeHandle, useMemo, useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AboutCard } from '@/components/player/AboutCard';
import { chartAllAllowed, ChartControls, chartControlsHeight } from '@/components/player/ChartControls';
import { CountBlock, countBlockHeight, type CountLine } from '@/components/player/CountBlock';
import { PLAYER_HEADER_H, PlayerHeader } from '@/components/player/PlayerHeader';
import { PlayerStage, type ChartBar, type StageMode, type StageRole } from '@/components/player/PlayerStage';
import { PlayerToggles } from '@/components/player/PlayerToggles';
import { StepList } from '@/components/player/StepList';
import { TempoControl } from '@/components/player/TempoControl';
import { Transport, transportHeight } from '@/components/player/Transport';
import { usePauseSilence, usePlayerCues } from '@/components/player/usePlayerCues';
import { Screen, Segmented, useReducedMotion } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { analyzeStep, barRanges, computeStates, describeStep, mirrorPattern, stepStartBeats, totalBeats } from '@/lib/pattern';
import { usePrefs } from '@/lib/prefs';
import { DEFAULT_FOOT_STYLE, ROLE_COLOR, space, styleColor, TONE } from '@/lib/theme';
import type { Dance, Pattern, Role } from '@/lib/types';
import { usePlayback } from '@/lib/usePlayback';

type RoleView = Role | 'both';

export interface PlayerHandle {
  /** Stop playback (before opening the editor, a sheet that navigates, …) */
  pause: () => void;
}

export interface PlayerViewProps {
  dance: Dance;
  /** Header actions on the right; `narrow` is true below 360 px (room for one button only) */
  headerRight: (narrow: boolean) => ReactNode;
  /** Replaces the dance style in the header's second line (e.g. "by Anna" on a shared dance) */
  byline?: string;
  /** "Edit steps" / "Make my own" link in the header of the step list */
  listAction?: { label: string; onPress: () => void };
  /** Cards shown first under the practice controls (e.g. the footprint lesson for a first visit) */
  belowStart?: ReactNode;
  /** Cards after the about card */
  belowEnd?: ReactNode;
  /** Pinned bar at the bottom (Save to my library) */
  footer?: ReactNode;
  /** Height of `footer` (without the safe area), so the practice controls still fit one screen */
  footerHeight?: number;
  /** Menus and sheets of the route */
  children?: ReactNode;
  ref?: Ref<PlayerHandle>;
  testID?: string;
}

const HEADER_H = PLAYER_HEADER_H;
const ROLE_SEG_H = 46 + space.xs;
const STAGE_MT = space.m;
const COUNT_MT = 14;
const TRANSPORT_MT = 6;
const BOTTOM_GAP = space.m;
const STAGE_MIN = 168;
const STAGE_MAX = 410;
const CHART_MT = space.l;

export function PlayerView({
  dance,
  headerRight,
  byline,
  listAction,
  belowStart,
  belowEnd,
  footer,
  footerHeight = 0,
  children,
  ref,
  testID = 'player',
}: PlayerViewProps) {
  const { prefs, set } = usePrefs();
  const t = useT();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  const narrow = winW < 360;
  // short screens (iPhone SE and the like) get a smaller count tile and transport
  const compact = narrow || winH - insets.top - insets.bottom - footerHeight < 700;

  const hasFollower = !!dance.roles.follower;
  const [roleView, setRoleView] = useState<RoleView>(() => (prefs.preferredRole === 'follower' && hasFollower ? 'follower' : 'leader'));
  const view: RoleView = hasFollower ? roleView : 'leader';
  const [mode, setMode] = useState<StageMode>('live');
  const [mirror, setMirror] = useState(false);
  const [listRole, setListRole] = useState<Role>('leader');
  // live tempo while dragging; persisted on release
  const [dragSpeed, setDragSpeed] = useState<number | null>(null);
  const speed = dragSpeed ?? Math.min(1.25, Math.max(0.5, prefs.speed));

  const patterns = useMemo(() => {
    const out: Partial<Record<Role, Pattern>> = {};
    (['leader', 'follower'] as Role[]).forEach((r) => {
      const p = dance.roles[r];
      if (p) out[r] = mirror ? mirrorPattern(p) : p;
    });
    return out;
  }, [dance, mirror]);

  const primaryRole: Role = view === 'follower' ? 'follower' : 'leader';
  const primary = patterns[primaryRole] ?? patterns.leader!;
  const shownRoles: Role[] = view === 'both' ? ['leader', 'follower'] : [primaryRole];
  const starts = useMemo(() => stepStartBeats(primary), [primary]);
  const total = useMemo(
    () => Math.max(0, ...shownRoles.map((r) => (patterns[r] ? totalBeats(patterns[r]!) : 0))),
    // shownRoles is derived from `view`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patterns, view],
  );
  const bpm = dance.bpm * speed;
  const steps = primary.steps;
  const canPlay = steps.length > 0;

  const onStep = usePlayerCues({ steps, speak: prefs.speakCounts, vibrate: prefs.haptics, bpm, t });
  const pb = usePlayback({ totalBeats: total, bpm, stepStartBeats: starts, loop: prefs.loop, onStep });
  usePauseSilence(pb.playing);
  const index = Math.min(pb.index, steps.length - 1);
  const { stepTo, stepBy, pause } = pb;
  useImperativeHandle(ref, () => ({ pause }), [pause]);

  const progress = useDerivedValue(() => {
    const b = pb.beat.get();
    return total > 0 && b > 0 ? Math.min(1, b / total) : 0;
  });

  const bars = useMemo(() => barRanges(primary, dance.beatsPerBar), [primary, dance.beatsPerBar]);
  const [chartBar, setChartBar] = useState<ChartBar>(0);
  const effectiveBar: ChartBar =
    bars.length <= 1
      ? 'all'
      : (chartBar === 'all' ? chartAllAllowed(bars.length) : bars.some((b) => b.bar === chartBar))
        ? chartBar
        : bars[0].bar;

  const states = useMemo(() => {
    const out: Partial<Record<Role, ReturnType<typeof computeStates>>> = {};
    shownRoles.forEach((r) => patterns[r] && (out[r] = computeStates(patterns[r]!)));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patterns, view]);

  const lines: CountLine[] = shownRoles.map((r) => {
    const p = patterns[r]!;
    const st = index >= 0 ? (p.steps[index] ?? null) : null;
    // the Both view has one short line per role: its turn goes in a chip of its own ("↺ 90°")
    // so it is never the part an ellipsis cuts off
    const info = st && shownRoles.length > 1 ? analyzeStep(st, states[r]![index]) : null;
    const turn = info && info.kind !== 'hold' ? info.turn : 0;
    const text = st
      ? info
        ? t.step.short(turn && info.kind !== 'hold' ? { ...info, turn: 0 } : info)
        : describeStep(st, states[r]![index], t)
      : p.steps.length === 0
        ? t.player.nothingToPlay
        : shownRoles.length > 1
          ? t.player.startPosition
          : t.player.startPositionHint;
    return { role: r, step: st, text, turn };
  });

  const stageRoles: StageRole[] = shownRoles.map((r) => ({
    role: r,
    pattern: patterns[r]!,
    footStyle: dance.footStyle?.[r] ?? DEFAULT_FOOT_STYLE[r],
    synced: r === primaryRole || sameStarts(stepStartBeats(patterns[r]!), starts),
  }));

  // --- actions ------------------------------------------------------------------------------
  const go = useCallback((i: number) => stepTo(i, { glide: !reduced }), [reduced, stepTo]);
  const onPrev = useCallback(() => stepBy(-1, { glide: !reduced }), [reduced, stepBy]);
  const onNext = useCallback(() => stepBy(1, { glide: !reduced }), [reduced, stepBy]);
  const onJump = useCallback(
    (i: number) => {
      setMode('live');
      go(i);
    },
    [go],
  );
  const onModeChange = (m: StageMode) => {
    if (m === 'overview') {
      pause();
      // open the chart on the bar being practised
      const cur = bars.find((b) => index >= b.from && index < b.to);
      if (cur && bars.length > 1) setChartBar(cur.bar);
    }
    setMode(m);
  };
  const setPref = useCallback((patch: Parameters<typeof set>[0]) => void set(patch), [set]);
  const onTempo = useCallback((v: number) => setDragSpeed(v), []);
  const onTempoCommit = useCallback(
    (v: number) => {
      setDragSpeed(null);
      void set({ speed: v });
    },
    [set],
  );

  // --- layout -------------------------------------------------------------------------------
  // The practice controls (stage, count block, transport) must fit one screen: the stage takes
  // whatever height is left, within limits. Computed up front, so nothing jumps on first layout.
  const practiceH = COUNT_MT + countBlockHeight(compact) + TRANSPORT_MT + transportHeight(compact);
  const fixed = HEADER_H + (hasFollower ? ROLE_SEG_H : 0) + STAGE_MT + practiceH + BOTTOM_GAP + footerHeight;
  const stageH = Math.round(Math.min(STAGE_MAX, Math.max(STAGE_MIN, winH - insets.top - insets.bottom - fixed)));
  // Chart mode has no count block / transport: the stage takes their room (the page below stays put)
  const chartH = chartControlsHeight(bars.length > 1);
  const stageChartH = stageH + practiceH - (CHART_MT + chartH);

  const name = dance.name.trim() || t.common.untitled;
  const meta = [narrow ? '' : t.units.meter(dance.beatsPerBar), t.units.bpm(dance.bpm)].filter(Boolean).join(' · ');
  const tone = styleColor(dance.style);
  const role = ROLE_COLOR[primaryRole];
  const listPatternRole: Role = view === 'both' ? listRole : primaryRole;

  return (
    <Screen
      testID={testID}
      footer={footer}
      header={<PlayerHeader title={name} style={byline ?? dance.style.trim()} meta={meta} dot={tone.base} right={headerRight(narrow)} />}
    >
      {hasFollower && (
        <Segmented
          value={view}
          onChange={setRoleView}
          label={t.roles.part}
          testID="role-switch"
          options={[
            { value: 'leader', label: t.roles.leader, icon: narrow ? undefined : 'flat-shoe', tone: TONE.primary },
            { value: 'follower', label: t.roles.follower, icon: narrow ? undefined : 'heel', tone: TONE.follower },
            { value: 'both', label: t.roles.both, tone: TONE.ink },
          ]}
          style={s.roleSeg}
        />
      )}

      <View style={s.stage}>
        <PlayerStage
          roles={stageRoles}
          tone={tone}
          mode={mode}
          onModeChange={onModeChange}
          beat={pb.beat}
          index={index}
          letters={prefs.showLetters}
          mirrored={mirror}
          chartBar={effectiveBar}
          beatsPerBar={dance.beatsPerBar}
          height={mode === 'live' ? stageH : stageChartH}
        />
      </View>

      {mode === 'live' ? (
        <>
          <View style={s.count}>
            <CountBlock role={primaryRole} steps={steps} bars={bars} index={index} lines={lines} onJump={onJump} compact={compact} />
          </View>
          <View style={s.transport}>
            <Transport
              playing={pb.playing}
              progress={progress}
              tone={role}
              canPlay={canPlay}
              canPrev={index >= 0}
              onToggle={pb.toggle}
              onPrev={onPrev}
              onNext={onNext}
              compact={compact}
            />
          </View>
        </>
      ) : (
        <View style={s.chart}>
          <ChartControls bars={bars} value={effectiveBar} onChange={setChartBar} role={primaryRole} />
        </View>
      )}

      <View style={s.below}>
        {belowStart}
        <TempoControl speed={speed} bpm={dance.bpm} tone={role} onChange={onTempo} onCommit={onTempoCommit} />
        <PlayerToggles
          loop={prefs.loop}
          speak={prefs.speakCounts}
          mirror={mirror}
          letters={prefs.showLetters}
          vibrate={prefs.haptics}
          setPref={setPref}
          setMirror={setMirror}
        />
        <StepList
          role={listPatternRole}
          pattern={patterns[listPatternRole]!}
          index={listPatternRole === primaryRole || stageRoles.every((r) => r.synced) ? index : -1}
          onJump={onJump}
          roleSwitch={view === 'both' ? { value: listRole, onChange: setListRole } : undefined}
          action={listAction}
        />
        <AboutCard dance={dance} />
        {belowEnd}
      </View>

      {children}
    </Screen>
  );
}

function sameStarts(a: number[], b: number[]) {
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
}

const s = StyleSheet.create({
  roleSeg: { marginTop: space.xs },
  stage: { marginTop: STAGE_MT },
  count: { marginTop: COUNT_MT },
  transport: { marginTop: TRANSPORT_MT },
  chart: { marginTop: CHART_MT },
  below: { marginTop: space.l, gap: space.l },
});
