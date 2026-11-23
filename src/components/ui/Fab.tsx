import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, lip, TONE, typography, withAlpha, type ColorSet } from '@/lib/theme';

import { Icon, type IconName } from '../Icon';
import { PressableLip } from './PressableLip';
import { Text } from './Text';

export interface FabProps {
  /** Accessible label, and the visible text when `extended` */
  label: string;
  onPress?: () => void;
  icon?: IconName;
  /** Show the label next to the icon (default true) */
  extended?: boolean;
  tone?: ColorSet;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Floating action button (green, lip, soft warm shadow). Place it with `<Screen fab={<Fab … />}>`
 * so it sits bottom-right above the home indicator and never covers the last content.
 */
export function Fab({ label, onPress, icon = 'plus', extended = true, tone = TONE.primary, testID, style }: FabProps) {
  return (
    <View style={[s.shadow, style]}>
      <PressableLip
        onPress={onPress}
        colors={{ base: tone.base, lip: tone.lip }}
        radius={22}
        lipDepth={lip.lg}
        accessibilityLabel={label}
        testID={testID}
        faceStyle={[s.face, extended ? s.extended : s.round]}
      >
        <Icon name={icon} size={26} color={tone.on} strokeWidth={3.2} />
        {extended && (
          <Text style={[typography.button, s.label]} color={tone.on} numberOfLines={1}>
            {label}
          </Text>
        )}
      </PressableLip>
    </View>
  );
}

export const FAB_HEIGHT = 60 + lip.lg;

const s = StyleSheet.create({
  shadow: {
    borderRadius: 22,
    // soft warm shadow under floating things (RN ≥ 0.76 boxShadow; see report for native notes)
    boxShadow: [{ offsetX: 0, offsetY: 10, blurRadius: 22, spreadDistance: -6, color: withAlpha(colors.shadow, 0.28) }],
  },
  face: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  extended: { paddingLeft: 18, paddingRight: 22 },
  round: { width: 60 },
  label: { fontSize: 18 },
});
