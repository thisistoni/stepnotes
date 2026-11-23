import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, CountBadge, FootBadge, Segmented, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { computeStates, describeStep, stepBeats } from '@/lib/pattern';
import { colors, radius, ROLE_COLOR, space, TONE } from '@/lib/theme';
import { type Pattern, type Role, type Step } from '@/lib/types';

interface Props {
  role: Role;
  pattern: Pattern;
  /** highlighted row (-1 = none) */
  index: number;
  onJump: (i: number) => void;
  /** Both view: the Leader / Follower switch */
  roleSwitch?: { value: Role; onChange: (r: Role) => void };
  /** "Edit steps" / "Make my own" link in the header */
  action?: { label: string; onPress: () => void };
}


const Row = memo(function Row({
  i,
  step,
  text,
  role,
  current,
  onJump,
}: {
  i: number;
  step: Step;
  text: string;
  role: Role;
  current: boolean;
  onJump: (i: number) => void;
}) {
  const c = ROLE_COLOR[role];
  const t = useT();
  const b = stepBeats(step);
  const len = b === 1 ? '' : t.units.beats(b);
  const kind = step.kind !== 'step' ? (step.kind === 'tap' ? t.steps.tap : t.steps.hold) : '';
  return (
    <Pressable
      onPress={() => onJump(i)}
      accessibilityRole="button"
      accessibilityLabel={t.steps.row(step.count, text, step.note)}
      accessibilityState={{ selected: current }}
      aria-selected={current}
      accessibilityHint={t.steps.rowHint}
      testID={`step-row-${i}`}
      style={({ pressed }) => [s.row, current && { backgroundColor: c.wash, borderColor: c.border }, pressed && !current && s.pressed]}
    >
      <View style={[s.n, current && { backgroundColor: c.base }]}>
        <Text variant="numeralSm" color={current ? c.on : colors.ink2} numberOfLines={1} maxFontSizeMultiplier={1} style={step.count.length > 2 && s.nSmall}>
          {step.count}
        </Text>
      </View>
      <FootBadge foot={step.kind === 'hold' ? null : step.foot} role={role} weight={step.kind === 'step'} />
      <View style={s.body}>
        <Text variant="bodyStrong" style={s.desc}>
          {text}
        </Text>
        {!!step.note && (
          <Text variant="caption" color="ink2" style={s.note}>
            {step.note}
          </Text>
        )}
      </View>
      {(!!kind || !!len) && (
        <View style={s.meta}>
          {!!kind && (
            <Text variant="overline" color={c.deep} style={s.kind}>
              {kind}
            </Text>
          )}
          {!!len && (
            <Text variant="caption" color="ink2">
              {len}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
});

/** "All steps" card: every step with count, foot, description and note; tap a row to show it. */
export const StepList = memo(function StepList({ role, pattern, index, onJump, roleSwitch, action }: Props) {
  const t = useT();
  const states = useMemo(() => computeStates(pattern), [pattern]);
  const texts = useMemo(() => pattern.steps.map((st, i) => describeStep(st, states[i], t)), [pattern, states, t]);
  return (
    <Card padding={0} testID="step-list">
      <View style={s.head}>
        <View style={s.title}>
          <Text variant="cardTitle">{t.steps.title}</Text>
          <CountBadge value={pattern.steps.length} />
        </View>
        {roleSwitch ? (
          <Segmented
            variant="compact"
            itemWidth={78}
            label={t.steps.of}
            value={roleSwitch.value}
            onChange={roleSwitch.onChange}
            options={[
              { value: 'leader', label: t.roles.leader, tone: TONE.primary },
              { value: 'follower', label: t.roles.follower, tone: TONE.follower },
            ]}
            style={s.switch}
            testID="steps-role"
          />
        ) : action ? (
          <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button" style={s.link} testID="steps-action">
            <Text variant="smallStrong" color="primaryInk">
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {pattern.steps.length === 0 ? (
        <Text variant="small" color="ink2" style={s.empty}>
          {t.steps.empty}
        </Text>
      ) : (
        <View style={s.list}>
          {pattern.steps.map((st, i) => (
            <Row key={st.id} i={i} step={st} text={texts[i]} role={role} current={i === index} onJump={onJump} />
          ))}
        </View>
      )}
    </Card>
  );
});

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.l, paddingTop: space.l, paddingBottom: space.s, gap: space.s, flexWrap: 'wrap' },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  switch: { alignSelf: 'center' },
  link: { minHeight: 32, justifyContent: 'center' },
  list: { paddingHorizontal: space.s, paddingBottom: space.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pressed: { backgroundColor: colors.track },
  n: { minWidth: 30, height: 30, paddingHorizontal: 3, borderRadius: 11, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  nSmall: { fontSize: 11 },
  body: { flex: 1, minWidth: 0 },
  desc: { fontSize: 15, lineHeight: 20 },
  note: { marginTop: 2 },
  meta: { alignItems: 'flex-end', gap: 2 },
  kind: { fontSize: 10, letterSpacing: 0.8 },
  empty: { paddingHorizontal: space.l, paddingBottom: space.l },
});
