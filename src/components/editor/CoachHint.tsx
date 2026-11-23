import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { ROLE_COLOR } from '@/lib/theme';
import type { Foot, Role, Step } from '@/lib/types';

const FOOT: Record<Foot, string> = { L: 'left', R: 'right' };

/** The one-line coach hint under the canvas: what to do next, for the current selection. */
export function coachHint({
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
}): string {
  if (sel < 0) {
    if (dragging) return `Let go where the ${FOOT[startFoot]} foot starts.`;
    if (stepCount === 0) return 'Drag the feet into place, then add step 1.';
    return 'Drag either foot to change the start.';
  }
  if (!step) return '';
  if (step.kind === 'hold') {
    return blocked ? 'Holds can’t move. Switch to Step to place a foot.' : 'A hold: nobody moves on this count.';
  }
  if (dragging) return `Let go where the ${FOOT[step.foot]} foot lands.`;
  if (step.kind === 'tap') return `Drag the ${FOOT[step.foot]} foot, or tap where it touches.`;
  return `Drag the ${FOOT[step.foot]} foot, or tap where it lands.`;
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
