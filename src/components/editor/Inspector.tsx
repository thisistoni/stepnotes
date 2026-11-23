import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, Card, IconButton, PressableLip, Segmented, Text, hapticSelect, type SegmentedOption } from '@/components/ui';
import { describeStep, type FeetState } from '@/lib/pattern';
import { colors, lip, radius, ROLE_COLOR, space, TONE } from '@/lib/theme';
import type { Foot, Role, Step, StepKind } from '@/lib/types';

import { Field } from './DetailsCard';

const QUICK_COUNTS = ['1', '2', '3', '4', '&', 'a'];
const KIND_HELP: Record<StepKind, string> = {
  step: 'The foot moves and takes your weight.',
  tap: 'The foot touches the floor without taking weight.',
  hold: 'Nobody moves: a pause on this count.',
};
const BEAT_LABEL: Record<string, string> = { '0.5': '½', '1': '1', '2': '2' };
const fmtBeats = (b: number) => BEAT_LABEL[String(b)] ?? String(Math.round(b * 100) / 100);

/** The ink-coloured thumb used for neutral (non-role) choices. */
const INK = { ...TONE.ink };

export interface InspectorProps {
  role: Role;
  steps: Step[];
  /** -1 = start position */
  sel: number;
  /** feet before the selected step */
  before: FeetState;
  startFoot: Foot;
  onStartFoot: (f: Foot) => void;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<Step>, group?: string) => void;
  onCountBlur: (index: number) => void;
  onFoot: (index: number, f: Foot) => void;
  onKind: (index: number, k: StepKind) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onDelete: (index: number) => void;
  onSeal: () => void;
}

/** Card for the selected step (or the start position): what it does and every property of it. */
export const Inspector = memo(function Inspector(props: InspectorProps) {
  const { role, steps, sel, startFoot, onStartFoot, onAdd } = props;
  const c = ROLE_COLOR[role];
  const footOptions: SegmentedOption<Foot>[] = [
    { value: 'L', label: 'Left', accessibilityLabel: 'Left foot' },
    { value: 'R', label: 'Right', accessibilityLabel: 'Right foot' },
  ];

  if (sel < 0) {
    return (
      <View testID="inspector">
        <Card padding={16} contentStyle={s.body}>
          <View>
            <Text variant="overline" color={c.deep}>
              Start position
            </Text>
            <Text variant="cardTitle" style={s.title}>
              Where both feet are before count 1
            </Text>
          </View>
          <View>
            <Label>Placing</Label>
            <Segmented label="Foot to place" options={footOptions} value={startFoot} onChange={onStartFoot} color={c} testID="start-foot" />
          </View>
          {steps.length === 0 && <Button label="Add step 1" icon="plus" tone={c} onPress={onAdd} testID="add-first-step" />}
        </Card>
      </View>
    );
  }
  const step = steps[sel];
  if (!step) return null;
  return <StepInspector {...props} step={step} />;
});

function StepInspector({
  role,
  steps,
  sel,
  step,
  before,
  onUpdate,
  onCountBlur,
  onFoot,
  onKind,
  onMove,
  onDelete,
  onSeal,
}: InspectorProps & { step: Step }) {
  const c = ROLE_COLOR[role];
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const beatValues = ['0.5', '1', '2'];
  const beats = String(step.beats);
  const beatOptions = (beatValues.includes(beats) ? beatValues : [...beatValues, beats].sort((a, b) => Number(a) - Number(b))).map((v) => ({
    value: v,
    label: fmtBeats(Number(v)),
    accessibilityLabel: `${fmtBeats(Number(v))} beat${v === '1' || v === '0.5' ? '' : 's'}`,
  }));

  return (
    <View testID="inspector">
      <Card padding={16} contentStyle={s.body}>
        <View>
          <Text variant="overline" color={c.deep}>
            Step {sel + 1} of {steps.length}
          </Text>
          <Text variant="cardTitle" style={s.title} testID="inspector-title">
            {describeStep(step, before)}
          </Text>
        </View>

        <View>
          <View style={s.countRow}>
            <Field
              label="Count"
              value={step.count}
              onChangeText={(v) => onUpdate(sel, { count: v }, `count-${step.id}`)}
              onBlur={() => {
                onSeal();
                onCountBlur(sel);
              }}
              maxLength={8}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              selectTextOnFocus
              style={s.countField}
              testID="field-count"
            />
            <View style={s.flex}>
              <Label>Length in beats</Label>
              <Segmented
                label="Length in beats"
                options={beatOptions}
                value={beats}
                onChange={(v) => onUpdate(sel, { beats: Number(v) })}
                color={INK}
                testID="step-length"
              />
            </View>
          </View>
          <View style={s.quick}>
            {QUICK_COUNTS.map((q) => (
              <QuickCount key={q} value={q} selected={step.count.trim() === q} onPress={() => onUpdate(sel, { count: q })} />
            ))}
          </View>
        </View>

        {step.kind !== 'hold' && (
          <View>
            <Label>Foot</Label>
            <Segmented
              label="Foot"
              options={[
                { value: 'L', label: 'Left', accessibilityLabel: 'Left foot' },
                { value: 'R', label: 'Right', accessibilityLabel: 'Right foot' },
              ]}
              value={step.foot}
              onChange={(f) => onFoot(sel, f)}
              color={c}
              testID="step-foot"
            />
          </View>
        )}

        <View>
          <Label>Action</Label>
          <Segmented
            label="Action"
            options={[
              { value: 'step', label: 'Step' },
              { value: 'tap', label: 'Tap' },
              { value: 'hold', label: 'Hold' },
            ]}
            value={step.kind}
            onChange={(k) => onKind(sel, k)}
            color={INK}
            testID="step-kind"
          />
          <Text variant="small" color="ink2" style={s.help}>
            {KIND_HELP[step.kind]}
          </Text>
        </View>

        <Field
          label="Note"
          value={step.note ?? ''}
          onChangeText={(v) => onUpdate(sel, { note: v || undefined }, `note-${step.id}`)}
          onBlur={onSeal}
          placeholder="Optional, e.g. ball of the foot"
          maxLength={500}
          testID="field-note"
        />

        <View style={s.actions}>
          <Button
            label={narrow ? 'Earlier' : 'Move earlier'}
            accessibilityLabel="Move step earlier"
            variant="secondary"
            size="sm"
            disabled={sel === 0}
            onPress={() => onMove(sel, -1)}
            style={s.flex}
            testID="move-earlier"
          />
          <Button
            label={narrow ? 'Later' : 'Move later'}
            accessibilityLabel="Move step later"
            variant="secondary"
            size="sm"
            disabled={sel === steps.length - 1}
            onPress={() => onMove(sel, 1)}
            style={s.flex}
            testID="move-later"
          />
          <IconButton
            icon="trash"
            label="Delete step"
            variant="tinted"
            tone={TONE.danger}
            size={40}
            iconSize={20}
            onPress={() => onDelete(sel)}
            testID="delete-step"
          />
        </View>
      </Card>
    </View>
  );
}

function QuickCount({ value, selected, onPress }: { value: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableLip
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      haptic={false}
      selected={selected}
      accessibilityLabel={`Count ${value === '&' ? 'and' : value}`}
      colors={selected ? { base: colors.ink, lip: colors.inkLip, border: colors.ink } : undefined}
      radius={radius.chip - 2}
      lipDepth={lip.sm}
      hitSlop={4}
      style={s.quickItem}
      faceStyle={s.quickFace}
      testID={`quick-count-${value}`}
    >
      <Text variant="numeralSm" color={selected ? colors.onColor : colors.ink}>
        {value}
      </Text>
    </PressableLip>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text variant="smallStrong" color="ink2" style={s.label}>
      {children}
    </Text>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: space.l },
  title: { marginTop: 4 },
  label: { marginBottom: 6, marginLeft: 4 },
  countRow: { flexDirection: 'row', gap: space.m, alignItems: 'flex-start' },
  countField: { width: 96 },
  quick: { flexDirection: 'row', gap: 6, marginTop: space.m },
  quickItem: { flex: 1 },
  quickFace: { height: 38, alignItems: 'center', justifyContent: 'center' },
  help: { marginTop: space.s, marginLeft: 4 },
  actions: { flexDirection: 'row', gap: space.s, alignItems: 'center' },
});
