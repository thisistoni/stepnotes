import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import type { Strings } from '@/lib/i18n';
import { ROLE_COLOR } from '@/lib/theme';
import type { Foot, Role, Step } from '@/lib/types';

/** The one-line coach hint under the canvas: what to do next, for the current selection. */
export function coachHint(
  {
    sel,
    step,
    stepCount,
    startFoot,
    dragging,
    blocked,
  }: {
    sel: number;
    step: Step | null;
    stepCount: number;
    startFoot: Foot;
    dragging: boolean;
    blocked: boolean;
  },
  t: Strings,
): string {
  const c = t.coach;
  if (sel < 0) {
    if (dragging) return c.startDragging(startFoot);
    if (stepCount === 0) return c.startEmpty;
    return c.startChange;
  }
  if (!step) return '';
  if (step.kind === 'hold') return blocked ? c.holdBlocked : c.hold;
  if (dragging) return c.dragging(step.foot);
  if (step.kind === 'tap') return c.tap(step.foot);
  return c.step(step.foot);
}

export function CoachHint({ text, role }: { text: string; role: Role }) {
  return (
    <View style={s.row} accessibilityLiveRegion="polite">
      <Icon name="info" size={18} color={ROLE_COLOR[role].deep} strokeWidth={2.4} />
      <Text variant="small" color="ink2" style={s.text} numberOfLines={3} testID="coach-hint">
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 4 },
  text: { flex: 1, marginTop: -0.5 },
});
