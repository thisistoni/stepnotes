/**
 * Player — the heart of the app: the stage (animated diagram or chart), the count block, the
 * transport, tempo, practice toggles and the list of all steps.
 *
 * Render budget: the screen re-renders once per step at most (usePlayback's `index`); the feet,
 * the ring and the arrow glide run on the UI thread from the shared `beat`.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DanceNotFound } from '@/components/DanceNotFound';
import { AboutCard } from '@/components/player/AboutCard';
import { ChartControls, chartControlsHeight } from '@/components/player/ChartControls';
import { CountBlock, countBlockHeight, type CountLine } from '@/components/player/CountBlock';
import { PLAYER_HEADER_H, PlayerHeader } from '@/components/player/PlayerHeader';
import { PlayerStage, type ChartBar, type StageMode, type StageRole } from '@/components/player/PlayerStage';
import { PlayerToggles } from '@/components/player/PlayerToggles';
import { shareDance } from '@/components/player/shareDance';
import { StepList } from '@/components/player/StepList';
import { TempoControl } from '@/components/player/TempoControl';
import { Transport, transportHeight } from '@/components/player/Transport';
import { usePauseSilence, usePlayerCues } from '@/components/player/usePlayerCues';
import {
  goBackOrHome,
  Header,
  IconButton,
  Menu,
  Screen,
  Segmented,
  useConfirm,
  useReducedMotion,
  useToast,
  type MenuItem,
} from '@/components/ui';
import { analyzeStep, barRanges, computeStates, describeStep, mirrorPattern, stepStartBeats, totalBeats } from '@/lib/pattern';
import { errorText, useT } from '@/lib/i18n';
import { usePrefs } from '@/lib/prefs';
import { useDances } from '@/lib/store';
import { DEFAULT_FOOT_STYLE, ROLE_COLOR, space, styleColor, TONE } from '@/lib/theme';
import type { Dance, Pattern, Role } from '@/lib/types';
import { usePlayback } from '@/lib/usePlayback';

type RoleView = Role | 'both';

export default function DancePlayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get, ready } = useDances();
  const prefsReady = usePrefs().ready;
  // while a delete is in flight the dance vanishes from the store before the screen has left:
  // keep drawing it instead of flashing "not found"
  const [leaving, setLeaving] = useState<Dance | null>(null);
  const dance = get(id) ?? leaving ?? undefined;

  if (!ready || !prefsReady) return <Screen header={<Header />} testID="player-loading" />;
  if (!dance) return <DanceNotFound testID="player-not-found" />;
  return <DancePlayer key={dance.id} dance={dance} onLeaving={setLeaving} />;
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

function DancePlayer({ dance, onLeaving }: { dance: Dance; onLeaving: (d: Dance | null) => void }) {
  const { duplicate, remove, restore, isBuiltIn } = useDances();
  const { prefs, set } = usePrefs();
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  const narrow = winW < 360;
  // short screens (iPhone SE and the like) get a smaller count tile and transport
  const compact = narrow || winH - insets.top - insets.bottom < 700;

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

  const progress = useDerivedValue(() => {
    const b = pb.beat.get();
    return total > 0 && b > 0 ? Math.min(1, b / total) : 0;
  });

  const bars = useMemo(() => barRanges(primary, dance.beatsPerBar), [primary, dance.beatsPerBar]);
  const [chartBar, setChartBar] = useState<ChartBar>(0);
  const effectiveBar: ChartBar = bars.length <= 1 ? 'all' : chartBar === 'all' || bars.some((b) => b.bar === chartBar) ? chartBar : bars[0].bar;

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
  const { stepTo, stepBy, pause } = pb;
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

  const builtIn = !!dance.builtIn || isBuiltIn(dance.id);
  const makeOwn = useCallback(() => {
    pause();
    router.push(`/edit/new?from=${encodeURIComponent(dance.id)}`);
  }, [pause, dance.id]);
  const edit = useCallback(() => {
    pause();
    router.push(`/edit/${dance.id}`);
  }, [pause, dance.id]);

  const [menuOpen, setMenuOpen] = useState(false);
  const name = dance.name.trim() || t.common.untitled;
  const onDuplicate = async () => {
    try {
      const copy = await duplicate(dance);
      toast.show({ message: (tr) => tr.player.copied, icon: 'copy', action: { label: (tr) => tr.common.open, onPress: () => router.push(`/dance/${copy.id}`) } });
    } catch (e) {
      toast.show({ message: (tr) => errorText(e, tr, tr.player.copyFailed), icon: 'alert' });
    }
  };
  const onDelete = async () => {
    pause();
    const ok = await confirm({
      title: (tr) => tr.player.deleteTitle(name),
      message: (tr) => tr.player.deleteMessage,
      confirmLabel: (tr) => tr.player.delete,
      destructive: true,
      icon: 'trash',
    });
    if (!ok) return;
    onLeaving(dance);
    try {
      const removed = await remove(dance.id);
      goBackOrHome();
      if (removed) {
        toast.show({
          message: (tr) => tr.player.deleted(name),
          icon: 'trash',
          action: {
            label: (tr) => tr.common.undo,
            onPress: () => restore(removed).catch(() => toast.show({ message: (tr) => tr.player.restoreFailed, icon: 'alert' })),
          },
        });
      }
    } catch (e) {
      onLeaving(null);
      toast.show({ message: (tr) => errorText(e, tr, tr.player.deleteFailed), icon: 'alert' });
    }
  };
  const menuItems: MenuItem[] = [
    builtIn
      ? { key: 'own', label: t.player.makeOwn, hint: t.player.makeOwnHint, icon: 'pencil', onPress: makeOwn }
      : { key: 'edit', label: t.player.editSteps, icon: 'pencil', onPress: edit },
    { key: 'dup', label: t.player.duplicate, hint: t.player.duplicateHint, icon: 'copy', onPress: onDuplicate },
    { key: 'share', label: t.player.share, hint: t.player.shareHint, icon: 'share', onPress: () => void shareDance(dance, t, toast.show) },
    ...(builtIn ? [] : [{ key: 'del', label: t.player.delete, icon: 'trash' as const, destructive: true, onPress: onDelete }]),
  ];

  // --- layout -------------------------------------------------------------------------------
  // The practice controls (stage, count block, transport) must fit one screen: the stage takes
  // whatever height is left, within limits. Computed up front, so nothing jumps on first layout.
  const practiceH = COUNT_MT + countBlockHeight(compact) + TRANSPORT_MT + transportHeight(compact);
  const fixed = HEADER_H + (hasFollower ? ROLE_SEG_H : 0) + STAGE_MT + practiceH + BOTTOM_GAP;
  const stageH = Math.round(Math.min(STAGE_MAX, Math.max(STAGE_MIN, winH - insets.top - insets.bottom - fixed)));
  // Chart mode has no count block / transport: the stage takes their room (the page below stays put)
  const chartH = chartControlsHeight(bars.length > 1);
  const stageChartH = stageH + practiceH - (CHART_MT + chartH);

  const meta = [narrow ? '' : t.units.meter(dance.beatsPerBar), t.units.bpm(dance.bpm)].filter(Boolean).join(' · ');
  const tone = styleColor(dance.style);
  const role = ROLE_COLOR[primaryRole];
  const listPatternRole: Role = view === 'both' ? listRole : primaryRole;

  return (
    <Screen
      testID="player"
      header={
        <PlayerHeader
          title={name}
          style={dance.style.trim()}
          meta={meta}
          dot={tone.base}
          right={
            <>
              {!narrow && (
                <IconButton
                  icon="pencil"
                  label={builtIn ? t.player.makeOwn : t.player.edit}
                  onPress={builtIn ? makeOwn : edit}
                  testID="edit-button"
                />
              )}
              <IconButton icon="more" label={t.player.more} onPress={() => setMenuOpen(true)} testID="more-button" />
            </>
          }
        />
      }
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
          action={builtIn ? { label: t.player.makeOwnShort, onPress: makeOwn } : { label: t.player.editSteps, onPress: edit }}
        />
        <AboutCard dance={dance} />
      </View>

      <Menu visible={menuOpen} onClose={() => setMenuOpen(false)} title={name} items={menuItems} />
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
