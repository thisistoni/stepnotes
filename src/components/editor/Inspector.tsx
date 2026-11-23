import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, Card, IconButton, PressableLip, Segmented, Text, hapticSelect, type SegmentedOption } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { describeStep, type FeetState } from '@/lib/pattern';
import { colors, lip, radius, ROLE_COLOR, space, TONE } from '@/lib/theme';
import type { Foot, Role, Step, StepKind } from '@/lib/types';

import { Field } from './DetailsCard';

const QUICK_COUNTS = ['1', '2', '3', '4', '&', 'a'];
const BEAT_LABEL: Record<string, string> = { '0.5': '½', '1': '1', '2': '2' };

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
  const t = useT();
  const c = ROLE_COLOR[role];
  const footOptions: SegmentedOption<Foot>[] = [
    { value: 'L', label: t.feet.left, accessibilityLabel: t.feet.leftFoot },
    { value: 'R', label: t.feet.right, accessibilityLabel: t.feet.rightFoot },
  ];

  if (sel < 0) {
    return (
      <View testID="inspector">
        <Card padding={16} contentStyle={s.body}>
          <View>
            <Text variant="overline" color={c.deep}>
              {t.inspector.startOverline}
            </Text>
            <Text variant="cardTitle" style={s.title}>
              {t.inspector.startTitle}
            </Text>
          </View>
          <View>
            <Label>{t.inspector.placing}</Label>
            <Segmented label={t.inspector.footToPlace} options={footOptions} value={startFoot} onChange={onStartFoot} color={c} testID="start-foot" />
          </View>
          {steps.length === 0 && <Button label={t.inspector.addFirst} icon="plus" tone={c} onPress={onAdd} testID="add-first-step" />}
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
  const t = useT();
  const { width } = useWindowDimensions();
  const narrow = width < 360;
  const beatValues = ['0.5', '1', '2'];
  const beats = String(step.beats);
  const beatOptions = (beatValues.includes(beats) ? beatValues : [...beatValues, beats].sort((a, b) => Number(a) - Number(b))).map((v) => ({
    value: v,
    label: BEAT_LABEL[v] ?? t.units.number(Number(v)),
    accessibilityLabel: t.inspector.lengthA11y(Number(v)),
  }));
  const kinds: StepKind[] = ['step', 'tap', 'hold'];

  return (
    <View testID="inspector">
      <Card padding={16} contentStyle={s.body}>
        <View>
          <Text variant="overline" color={c.deep}>
            {t.inspector.stepOf(sel + 1, steps.length)}
          </Text>
          <Text variant="cardTitle" style={s.title} testID="inspector-title">
            {describeStep(step, before, t)}
          </Text>
        </View>

        <View>
          <View style={s.countRow}>
            <Field
              label={t.inspector.count}
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
              <Label>{t.inspector.length}</Label>
              <Segmented
                label={t.inspector.length}
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
            <Label>{t.inspector.foot}</Label>
            <Segmented
              label={t.inspector.foot}
              options={[
                { value: 'L', label: t.feet.left, accessibilityLabel: t.feet.leftFoot },
                { value: 'R', label: t.feet.right, accessibilityLabel: t.feet.rightFoot },
              ]}
              value={step.foot}
              onChange={(f) => onFoot(sel, f)}
              color={c}
              testID="step-foot"
            />
          </View>
        )}

        <View>
          <Label>{t.inspector.action}</Label>
          <Segmented
            label={t.inspector.action}
            options={kinds.map((k) => ({ value: k, label: t.inspector.kinds[k] }))}
            value={step.kind}
            onChange={(k) => onKind(sel, k)}
            color={INK}
            testID="step-kind"
          />
          <Text variant="small" color="ink2" style={s.help}>
            {t.inspector.kindHelp[step.kind]}
          </Text>
        </View>

        <Field
          label={t.inspector.note}
          value={step.note ?? ''}
          onChangeText={(v) => onUpdate(sel, { note: v || undefined }, `note-${step.id}`)}
          onBlur={onSeal}
          placeholder={t.inspector.notePlaceholder}
          maxLength={500}
          testID="field-note"
        />

        <View style={s.actions}>
          <Button
            label={narrow ? t.inspector.earlierShort : t.inspector.earlier}
            accessibilityLabel={t.inspector.earlierA11y}
            variant="secondary"
            size="sm"
            disabled={sel === 0}
            onPress={() => onMove(sel, -1)}
            style={s.flex}
            testID="move-earlier"
          />
          <Button
            label={narrow ? t.inspector.laterShort : t.inspector.later}
            accessibilityLabel={t.inspector.laterA11y}
            variant="secondary"
            size="sm"
            disabled={sel === steps.length - 1}
            onPress={() => onMove(sel, 1)}
            style={s.flex}
            testID="move-later"
          />
          <IconButton
            icon="trash"
            label={t.inspector.delete}
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
  const t = useT();
  return (
    <PressableLip
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      haptic={false}
      selected={selected}
      accessibilityLabel={t.inspector.quickCount(value)}
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
