import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { StepDiagram } from '@/components/StepDiagram';
import { Button, Card, Segmented, SectionTitle, Toggle } from '@/components/legacyUi';
import { Header, IconButton, Screen } from '@/components/ui';
import { computeStates, describeStep, mirrorPattern, stepStartBeats, totalBeats } from '@/lib/pattern';
import { usePrefs } from '@/lib/prefs';
import { exportJson, useDances } from '@/lib/store';
import { DEFAULT_FOOT_STYLE, ROLE_THEME, colors } from '@/lib/theme';
import { ROLE_LABEL, type Dance, type Pattern, type Role } from '@/lib/types';
import { usePlayback } from '@/lib/usePlayback';

type RoleView = Role | 'both';
const SPEEDS = ['0.5', '0.75', '1', '1.25'] as const;

export default function DancePlayerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get, ready } = useDances();
  const prefsReady = usePrefs().ready;
  const dance = get(id);

  if (!ready || !prefsReady) {
    return <Screen header={<Header />} />;
  }
  if (!dance) {
    return (
      <Screen header={<Header title="Not found" />} contentStyle={{ gap: 12 }}>
        <Text>This dance does not exist anymore.</Text>
        <Button label="Go to library" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  return <DancePlayer dance={dance} />;
}

function DancePlayer({ dance }: { dance: Dance }) {
  const { duplicate, remove } = useDances();
  const { prefs, set } = usePrefs();

  const [roleView, setRoleView] = useState<RoleView>(() =>
    prefs.preferredRole === 'follower' && dance.roles.follower ? 'follower' : 'leader',
  );
  const [mode, setMode] = useState<'live' | 'overview'>('live');
  const [mirror, setMirror] = useState(false);
  const speed = prefs.speed;

  const roles: Role[] = roleView === 'both' ? ['leader', 'follower'] : [roleView];
  const patterns = useMemo(() => {
    const out: Partial<Record<Role, Pattern>> = {};
    (['leader', 'follower'] as Role[]).forEach((r) => {
      const p = dance.roles[r];
      if (p) out[r] = mirror ? mirrorPattern(p) : p;
    });
    return out;
  }, [dance, mirror]);

  const primaryRole: Role = roleView === 'follower' ? 'follower' : 'leader';
  const primary = patterns[primaryRole] ?? dance.roles.leader;
  const total = useMemo(
    () => Math.max(...roles.map((r) => (patterns[r] ? totalBeats(patterns[r]!) : 0)), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patterns, roleView],
  );
  const starts = useMemo(() => stepStartBeats(primary), [primary]);
  const bpm = dance.bpm * speed;
  const primaryStates = useMemo(() => computeStates(primary), [primary]);

  // say the count / vibrate on every new step while playing
  const onStep = (i: number) => {
    const step = primary.steps[i];
    if (!step) return;
    if (prefs.haptics && step.kind !== 'hold' && Platform.OS !== 'web') {
      Haptics.impactAsync(step.kind === 'tap' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
    }
    if (prefs.speakCounts) {
      Speech.stop();
      Speech.speak(step.count === '&' ? 'and' : step.count, { rate: Math.min(2, 0.9 + bpm / 200) });
    }
  };
  const playback = usePlayback({ totalBeats: total, bpm, stepStartBeats: starts, loop: prefs.loop, onStep });
  const index = playback.index;

  useEffect(() => () => void Speech.stop(), []);

  const step = index >= 0 ? primary.steps[index] : null;
  const theme = ROLE_THEME[primaryRole];

  const goTo = playback.seekToStep;
  const prev = () => goTo(Math.max(-1, index - 1));
  const next = () => goTo(index + 1 >= primary.steps.length ? -1 : index + 1);

  const onShare = () => Share.share({ title: dance.name, message: exportJson(dance) });
  const onEditCopy = async () => {
    const copy = await duplicate(dance);
    router.replace(`/edit/${copy.id}`);
  };
  const onDelete = () => {
    const doIt = async () => {
      await remove(dance.id);
      // deep link / web reload: there may be no screen to go back to
      if (router.canGoBack()) router.back();
      else router.replace('/');
    };
    if (Platform.OS === 'web') {
      if (confirm(`Delete “${dance.name}”?`)) doIt();
      return;
    }
    Alert.alert('Delete dance', `Delete “${dance.name}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doIt },
    ]);
  };

  const roleOptions: { value: RoleView; label: string }[] = dance.roles.follower
    ? [
        { value: 'leader', label: 'Leader' },
        { value: 'follower', label: 'Follower' },
        { value: 'both', label: 'Both' },
      ]
    : [{ value: 'leader', label: 'Steps' }];

  return (
    <Screen scroll={false} padded={false}>
      <Header
        title={dance.name || 'Untitled dance'}
        right={
          dance.builtIn ? undefined : (
            <IconButton icon="pencil" label="Edit dance" onPress={() => router.push(`/edit/${dance.id}`)} />
          )
        }
      />
      <ScrollView contentContainerStyle={s.content}>
        {roleOptions.length > 1 && (
          <Segmented options={roleOptions} value={roleView} onChange={setRoleView} color={ROLE_THEME[primaryRole].solid} />
        )}

        <Card style={{ marginTop: 12, paddingHorizontal: 6 }}>
          <View style={s.modeRow}>
            <Segmented
              options={[
                { value: 'live', label: 'Animate' },
                { value: 'overview', label: 'Chart' },
              ]}
              value={mode}
              onChange={setMode}
              color={colors.text}
            />
          </View>
          {roles.map((r) =>
            patterns[r] ? (
              <View key={r}>
                {roles.length > 1 && <Text style={[s.roleTag, { color: ROLE_THEME[r].label }]}>{ROLE_LABEL[r]}</Text>}
                <RoleDiagram
                  pattern={patterns[r]!}
                  role={r}
                  footStyle={dance.footStyle?.[r] ?? DEFAULT_FOOT_STYLE[r]}
                  mode={mode}
                  beat={playback.beat}
                  letters={prefs.showLetters}
                  maxHeight={roles.length > 1 ? 260 : 400}
                />
              </View>
            ) : null,
          )}
          {mirror && <Text style={s.mirrorNote}>Mirrored (left ↔ right)</Text>}
        </Card>

        {mode === 'live' && (
          <>
            <View style={s.countRow}>
              <Text testID="current-count" style={[s.count, { color: theme.label }]}>{step ? step.count : '–'}</Text>
              <Text style={s.countDesc}>
                {step ? describeStep(step, primaryStates[index]) : 'Start position. Press play or step through.'}
              </Text>
            </View>

            <View style={s.controls}>
              <Button label="⏮" onPress={prev} style={s.ctrl} />
              <Button
                label={playback.playing ? '❚❚  Pause' : '▶  Play'}
                variant="primary"
                onPress={playback.toggle}
                style={[s.ctrl, { flex: 2, backgroundColor: theme.solid, borderColor: theme.solid }]}
              />
              <Button label="⏭" onPress={next} style={s.ctrl} />
            </View>

            <SectionTitle>Tempo · {Math.round(bpm)} bpm</SectionTitle>
            <Segmented
              options={SPEEDS.map((v) => ({ value: v, label: `${Math.round(Number(v) * 100)}%` }))}
              value={String(speed) as (typeof SPEEDS)[number]}
              onChange={(v) => set({ speed: Number(v) })}
              color={colors.text}
            />
          </>
        )}

        <View style={s.toggles}>
          {mode === 'live' && <Toggle label="Loop" value={prefs.loop} onChange={(loop) => set({ loop })} />}
          {mode === 'live' && (
            <Toggle label="Say counts" value={prefs.speakCounts} onChange={(speakCounts) => set({ speakCounts })} />
          )}
          {mode === 'live' && Platform.OS !== 'web' && (
            <Toggle label="Vibrate" value={prefs.haptics} onChange={(haptics) => set({ haptics })} />
          )}
          <Toggle label="Mirror" value={mirror} onChange={setMirror} />
          <Toggle label="L / R" value={prefs.showLetters} onChange={(showLetters) => set({ showLetters })} />
        </View>

        <SectionTitle>Steps · {ROLE_LABEL[primaryRole]}</SectionTitle>
        <Card style={{ padding: 0 }}>
          {primary.steps.map((st, i) => (
            <Pressable
              key={st.id}
              onPress={() => {
                setMode('live');
                goTo(i);
              }}
              style={[s.stepRow, i === index && { backgroundColor: theme.light + '55' }, i > 0 && s.stepBorder]}
            >
              <Text style={[s.stepCount, { color: theme.label }]}>{st.count}</Text>
              <Text style={s.stepFoot}>{st.kind === 'hold' ? '·' : st.foot}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.stepText}>{describeStep(st, primaryStates[i])}</Text>
                {!!st.note && <Text style={s.stepNote}>{st.note}</Text>}
              </View>
            </Pressable>
          ))}
          {primary.steps.length === 0 && <Text style={{ padding: 14, color: colors.muted }}>No steps yet.</Text>}
        </Card>

        {(!!dance.description || !!dance.videoUrl) && (
          <>
            <SectionTitle>About</SectionTitle>
            <Card>
              {!!dance.description && <Text style={s.about}>{dance.description}</Text>}
              <Text style={[s.about, { color: colors.muted, marginTop: 6 }]}>
                {[dance.style, `${dance.bpm} bpm`, `${dance.beatsPerBar}/4`].filter(Boolean).join(' · ')}
              </Text>
              {!!dance.videoUrl && (
                <Button small label="Watch reference video" onPress={() => Linking.openURL(dance.videoUrl!)} style={{ marginTop: 10 }} />
              )}
            </Card>
          </>
        )}

        <View style={s.actions}>
          {dance.builtIn ? (
            <Button label="Make my own version" variant="primary" onPress={onEditCopy} />
          ) : (
            <>
              <Button label="Edit steps" variant="primary" onPress={() => router.push(`/edit/${dance.id}`)} />
              <Button label="Duplicate" onPress={onEditCopy} />
            </>
          )}
          <Button label="Share as text" onPress={onShare} />
          {!dance.builtIn && <Button label="Delete" variant="danger" onPress={onDelete} />}
        </View>
      </ScrollView>
    </Screen>
  );
}

function RoleDiagram({
  pattern,
  role,
  footStyle,
  mode,
  beat,
  letters,
  maxHeight,
}: {
  pattern: Pattern;
  role: Role;
  footStyle: 'shoe' | 'heel';
  mode: 'live' | 'overview';
  beat: SharedValue<number>;
  letters: boolean;
  maxHeight: number;
}) {
  return (
    <StepDiagram
      pattern={pattern}
      theme={ROLE_THEME[role]}
      footStyle={footStyle}
      mode={mode}
      beat={beat}
      showLetters={letters}
      maxHeight={maxHeight}
    />
  );
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  modeRow: { paddingHorizontal: 8, marginBottom: 4 },
  roleTag: { fontSize: 13, fontWeight: '800', marginTop: 8, marginLeft: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  mirrorNote: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 4 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14, minHeight: 64 },
  count: { fontSize: 52, fontWeight: '800', minWidth: 56, textAlign: 'center' },
  countDesc: { flex: 1, fontSize: 16, color: colors.text, lineHeight: 22 },
  controls: { flexDirection: 'row', gap: 10, marginTop: 10 },
  ctrl: { flex: 1 },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, gap: 12 },
  stepBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  stepCount: { fontSize: 18, fontWeight: '800', width: 28, textAlign: 'center' },
  stepFoot: { fontSize: 14, fontWeight: '700', color: colors.muted, width: 16 },
  stepText: { fontSize: 15, color: colors.text },
  stepNote: { fontSize: 13, color: colors.muted, marginTop: 2 },
  about: { fontSize: 15, color: colors.text, lineHeight: 21 },
  actions: { gap: 10, marginTop: 24 },
});
