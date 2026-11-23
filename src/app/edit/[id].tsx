import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';

import { patternBounds, StepDiagram, type Bounds } from '@/components/StepDiagram';
import { Button, Card, Segmented, SectionTitle } from '@/components/ui';
import { computeStates, describeStep, nextCount, otherFoot, toPartner, uid } from '@/lib/pattern';
import { newDance, useDances } from '@/lib/store';
import { DEFAULT_FOOT_STYLE, ROLE_THEME, colors } from '@/lib/theme';
import { ROLE_LABEL, type Dance, type Foot, type FootPos, type FootStyle, type Pattern, type Role, type Step, type StepKind } from '@/lib/types';

const SNAP = 0.2;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const MIN_BOUNDS: Bounds = { minX: -5, minY: -5, maxX: 5, maxY: 5 };

function editorBounds(p: Pattern): Bounds {
  const b = patternBounds(p, 3.5, 10);
  return {
    minX: Math.min(b.minX, MIN_BOUNDS.minX),
    minY: Math.min(b.minY, MIN_BOUNDS.minY),
    maxX: Math.max(b.maxX, MIN_BOUNDS.maxX),
    maxY: Math.max(b.maxY, MIN_BOUNDS.maxY),
  };
}

export default function Editor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { get, save } = useDances();
  const isNew = id === 'new';
  const [draft, setDraft] = useState<Dance>(() => {
    const existing = !isNew ? get(id) : undefined;
    return existing ? JSON.parse(JSON.stringify(existing)) : newDance();
  });
  const [role, setRole] = useState<Role>('leader');
  /** -1 = start position */
  const [sel, setSel] = useState(-1);
  const [startFoot, setStartFoot] = useState<Foot>('L');
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const pattern = draft.roles[role];
  const [bounds, setBounds] = useState<Bounds>(() => editorBounds(draft.roles.leader));
  const changeRole = (r: Role) => {
    setRole(r);
    const p = draft.roles[r];
    if (p) setBounds(editorBounds(p));
    setSel(-1);
  };

  const states = useMemo(() => (pattern ? computeStates(pattern) : []), [pattern]);

  const update = (patch: Partial<Dance>) => setDraft((d) => ({ ...d, ...patch }));
  const setPattern = (fn: (p: Pattern) => Pattern) =>
    setDraft((d) => {
      const p = d.roles[role];
      if (!p) return d;
      return { ...d, roles: { ...d.roles, [role]: fn(p) } };
    });
  const updateStep = (i: number, patch: Partial<Step>) =>
    setPattern((p) => ({ ...p, steps: p.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));

  const selected = pattern && sel >= 0 ? pattern.steps[sel] : null;
  const theme = ROLE_THEME[role];
  const footStyle: FootStyle = draft.footStyle?.[role] ?? DEFAULT_FOOT_STYLE[role];

  // --- canvas interaction ---------------------------------------------------------------
  const onTouch = (x: number, y: number) => {
    if (!pattern) return;
    setScrollEnabled(false);
    const pos = (old: FootPos): FootPos => ({ x: snap(x), y: snap(y), rot: old.rot });
    if (sel < 0) {
      setPattern((p) => ({ ...p, start: { ...p.start, [startFoot]: pos(p.start[startFoot]) } }));
    } else if (selected && selected.kind !== 'hold') {
      updateStep(sel, { to: pos(selected.to) });
    }
  };

  const rotate = (delta: number) => {
    if (!pattern) return;
    if (sel < 0) {
      setPattern((p) => ({
        ...p,
        start: { ...p.start, [startFoot]: { ...p.start[startFoot], rot: p.start[startFoot].rot + delta } },
      }));
    } else if (selected) {
      updateStep(sel, { to: { ...selected.to, rot: selected.to.rot + delta } });
    }
  };

  const addStep = () => {
    if (!pattern) return;
    const insertAt = sel + 1;
    const prevStep = sel >= 0 ? pattern.steps[sel] : null;
    const foot: Foot = prevStep && prevStep.kind !== 'hold' ? otherFoot(prevStep.foot) : prevStep ? prevStep.foot : 'L';
    const before = states[insertAt];
    const step: Step = {
      id: uid('step'),
      count: nextCount(pattern.steps.slice(0, insertAt), draft.beatsPerBar),
      beats: 1,
      foot,
      kind: 'step',
      to: { ...before.pos[foot] },
    };
    setPattern((p) => {
      const steps = [...p.steps];
      steps.splice(insertAt, 0, step);
      return { ...p, steps };
    });
    setSel(insertAt);
  };

  const deleteStep = () => {
    if (sel < 0) return;
    setPattern((p) => ({ ...p, steps: p.steps.filter((_, k) => k !== sel) }));
    setSel((i) => i - 1);
  };

  const moveStep = (dir: -1 | 1) => {
    const j = sel + dir;
    if (!pattern || sel < 0 || j < 0 || j >= pattern.steps.length) return;
    setPattern((p) => {
      const steps = [...p.steps];
      [steps[sel], steps[j]] = [steps[j], steps[sel]];
      return { ...p, steps };
    });
    setSel(j);
  };

  const changeFoot = (foot: Foot) => {
    if (!selected || foot === selected.foot) return;
    // move the other foot instead – start from where that foot currently is
    updateStep(sel, { foot, to: { ...states[sel].pos[foot] } });
  };

  const changeKind = (kind: StepKind) => {
    if (!selected) return;
    updateStep(sel, kind === 'hold' ? { kind, to: { ...states[sel].pos[selected.foot] } } : { kind });
  };

  const createFollower = (mode: 'mirror' | 'empty') => {
    setDraft((d) => ({
      ...d,
      roles: {
        ...d.roles,
        follower: mode === 'mirror' ? toPartner(d.roles.leader) : { start: { ...d.roles.leader.start }, steps: [] },
      },
    }));
    setBounds(editorBounds(mode === 'mirror' ? toPartner(draft.roles.leader) : draft.roles.leader));
    setSel(-1);
  };

  const removeFollower = () => {
    setDraft((d) => ({ ...d, roles: { leader: d.roles.leader } }));
    changeRole('leader');
  };

  const onSave = async () => {
    const final: Dance = { ...draft, name: draft.name.trim() || 'Untitled dance' };
    await save(final);
    if (isNew) router.replace(`/dance/${final.id}`);
    else router.back();
  };

  const frame = pattern
    ? { index: sel, feet: states[sel + 1]?.pos ?? pattern.start, weight: states[sel + 1]?.weight ?? null, progress: 1 }
    : undefined;

  const hint =
    sel < 0
      ? `Start position – tap or drag on the grid to place the ${startFoot === 'L' ? 'left' : 'right'} foot.`
      : selected?.kind === 'hold'
        ? 'Hold – nobody moves on this count.'
        : `Tap or drag on the grid to place the ${selected?.foot === 'L' ? 'left' : 'right'} foot for count “${selected?.count}”.`;

  return (
    <>
      <Stack.Screen
        options={{
          title: isNew ? 'New dance' : 'Edit dance',
          headerRight: () => <Button small variant="primary" label="Save" onPress={onSave} />,
        }}
      />
      <ScrollView contentContainerStyle={s.content} scrollEnabled={scrollEnabled} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label="Name" value={draft.name} onChange={(name) => update({ name })} placeholder="e.g. Salsa Cross Body Lead" />
          <View style={s.fieldRow}>
            <View style={{ flex: 2 }}>
              <Field label="Style" value={draft.style} onChange={(style) => update({ style })} placeholder="Salsa, Tango…" />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="BPM"
                value={String(draft.bpm || '')}
                keyboardType="number-pad"
                onChange={(v) => update({ bpm: Math.max(0, Math.min(300, parseInt(v, 10) || 0)) })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Field
                label="Beats/bar"
                value={String(draft.beatsPerBar || '')}
                keyboardType="number-pad"
                onChange={(v) => update({ beatsPerBar: Math.max(0, Math.min(16, parseInt(v, 10) || 0)) })}
              />
            </View>
          </View>
          <Field
            label="Description / teaching notes"
            value={draft.description}
            onChange={(description) => update({ description })}
            multiline
            placeholder="Technique tips, styling, what the lead should feel…"
          />
          <Field
            label="Reference video link (optional)"
            value={draft.videoUrl ?? ''}
            onChange={(videoUrl) => update({ videoUrl: videoUrl || undefined })}
            placeholder="https://…"
            keyboardType="url"
          />
        </Card>

        <SectionTitle>Steps</SectionTitle>
        <Segmented
          options={[
            { value: 'leader', label: 'Leader' },
            { value: 'follower', label: draft.roles.follower ? 'Follower' : 'Follower +' },
          ]}
          value={role}
          onChange={changeRole}
          color={theme.solid}
        />

        {!pattern ? (
          <Card style={{ marginTop: 12, gap: 10 }}>
            <Text style={s.hint}>
              This dance has no follower part yet. Generate it from the leader&apos;s steps (partners facing each other, the
              follower mirrors the leader), or draw it yourself.
            </Text>
            <Button label="Generate from leader" variant="primary" onPress={() => createFollower('mirror')} />
            <Button label="Start empty" onPress={() => createFollower('empty')} />
          </Card>
        ) : (
          <>
            <Card style={{ marginTop: 12, padding: 6 }}>
              <StepDiagram
                pattern={pattern}
                theme={theme}
                footStyle={footStyle}
                mode="live"
                frame={frame}
                bounds={bounds}
                grid
                maxHeight={380}
                onTouch={onTouch}
                onTouchEnd={() => {
                  setScrollEnabled(true);
                  setBounds(editorBounds(pattern));
                }}
              />
            </Card>
            <Text style={[s.hint, { marginTop: 8 }]}>{hint}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
              <StepChip label="Start" active={sel === -1} color={theme.solid} onPress={() => setSel(-1)} />
              {pattern.steps.map((st, i) => (
                <StepChip
                  key={st.id}
                  label={`${st.count} ${st.kind === 'hold' ? '·' : st.foot}`}
                  active={sel === i}
                  color={theme.solid}
                  onPress={() => setSel(i)}
                />
              ))}
              <StepChip label="+ Add" active={false} color={theme.solid} onPress={addStep} dashed />
            </ScrollView>

            <Card style={{ gap: 12 }}>
              {sel < 0 ? (
                <>
                  <Text style={s.label}>Place which foot?</Text>
                  <Segmented
                    options={[
                      { value: 'L', label: 'Left' },
                      { value: 'R', label: 'Right' },
                    ]}
                    value={startFoot}
                    onChange={setStartFoot}
                    color={theme.solid}
                  />
                  <RotateRow onRotate={rotate} />
                  <Text style={s.label}>Footprint style</Text>
                  <Segmented
                    options={[
                      { value: 'shoe', label: 'Flat shoe' },
                      { value: 'heel', label: 'Heel' },
                    ]}
                    value={footStyle}
                    onChange={(v) => update({ footStyle: { ...draft.footStyle, [role]: v } })}
                    color={theme.solid}
                  />
                  <Button label="+ Add first step" variant="primary" onPress={addStep} />
                </>
              ) : selected ? (
                <>
                  <Text style={s.desc}>{describeStep(selected, states[sel])}</Text>
                  <View style={s.fieldRow}>
                    <View style={{ flex: 1 }}>
                      <Field label="Count" value={selected.count} onChange={(count) => updateStep(sel, { count })} />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={s.label}>Length</Text>
                      <Segmented
                        options={[
                          { value: '0.5', label: '½' },
                          { value: '1', label: '1' },
                          { value: '2', label: '2' },
                        ]}
                        value={String(selected.beats) as '0.5' | '1' | '2'}
                        onChange={(v) => updateStep(sel, { beats: Number(v) })}
                        color={colors.text}
                      />
                    </View>
                  </View>
                  <Text style={s.label}>Foot</Text>
                  <Segmented
                    options={[
                      { value: 'L', label: 'Left' },
                      { value: 'R', label: 'Right' },
                    ]}
                    value={selected.foot}
                    onChange={changeFoot}
                    color={theme.solid}
                  />
                  <Text style={s.label}>Action</Text>
                  <Segmented
                    options={[
                      { value: 'step', label: 'Step' },
                      { value: 'tap', label: 'Tap' },
                      { value: 'hold', label: 'Hold' },
                    ]}
                    value={selected.kind}
                    onChange={changeKind}
                    color={colors.text}
                  />
                  {selected.kind !== 'hold' && <RotateRow onRotate={rotate} />}
                  <Field
                    label="Note (optional)"
                    value={selected.note ?? ''}
                    onChange={(note) => updateStep(sel, { note: note || undefined })}
                    placeholder="e.g. ball of the foot, hip action"
                  />
                  <View style={s.fieldRow}>
                    <Button small label="◀ Move" onPress={() => moveStep(-1)} style={{ flex: 1 }} />
                    <Button small label="Move ▶" onPress={() => moveStep(1)} style={{ flex: 1 }} />
                    <Button small label="Delete" variant="danger" onPress={deleteStep} style={{ flex: 1 }} />
                  </View>
                  <Button label="+ Add next step" variant="primary" onPress={addStep} />
                </>
              ) : null}
            </Card>

            {role === 'follower' && (
              <View style={{ gap: 10, marginTop: 16 }}>
                <Button label="Regenerate follower from leader" onPress={() => createFollower('mirror')} />
                <Button label="Remove follower part" variant="danger" onPress={removeFollower} />
              </View>
            )}
            <Text style={[s.hint, { marginTop: 16 }]}>
              Tip: the dancer faces the top of the screen. {ROLE_LABEL[role]} steps are shown from the dancer&apos;s own point of view.
            </Text>
          </>
        )}
      </ScrollView>
    </>
  );
}

function RotateRow({ onRotate }: { onRotate: (deg: number) => void }) {
  return (
    <View style={s.fieldRow}>
      <Button small label="⟲ 45°" onPress={() => onRotate(-45)} style={{ flex: 1 }} />
      <Button small label="⟲ 15°" onPress={() => onRotate(-15)} style={{ flex: 1 }} />
      <Button small label="15° ⟳" onPress={() => onRotate(15)} style={{ flex: 1 }} />
      <Button small label="45° ⟳" onPress={() => onRotate(45)} style={{ flex: 1 }} />
    </View>
  );
}

function StepChip({
  label,
  active,
  color,
  onPress,
  dashed,
}: {
  label: string;
  active: boolean;
  color: string;
  onPress: () => void;
  dashed?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.chip,
        dashed && { borderStyle: 'dashed', borderColor: color },
        active && { backgroundColor: color, borderColor: color },
      ]}
    >
      <Text style={[s.chipText, active && { color: '#fff' }, dashed && { color }]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'url';
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#A8A29E"
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'url' ? 'none' : 'sentences'}
        style={[s.input, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 60 },
  fieldRow: { flexDirection: 'row', gap: 8 },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#FBFAF8',
  },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  desc: { fontSize: 15, fontWeight: '600', color: colors.text },
  strip: { gap: 8, paddingVertical: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.text },
});
