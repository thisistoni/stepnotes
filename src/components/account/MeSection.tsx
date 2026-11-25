import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Icon, PressableLip, Text, type IconName } from '@/components/ui';
import { colors, space, TONE, type ColorSet } from '@/lib/theme';

/**
 * A titled group of rows on the Me tab (one white card, rows separated by hairlines):
 *
 *   <MeSection title={t.account.sectionApp}>
 *     <MeRow icon="globe" label={t.account.language} value="Deutsch" onPress={…} testID="me-language" />
 *   </MeSection>
 */
export function MeSection({ title, children, testID }: { title?: string; children: ReactNode; testID?: string }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={s.section} testID={testID}>
      {!!title && (
        <Text variant="overline" color="ink2" style={s.title} accessibilityRole="header">
          {title}
        </Text>
      )}
      <Card padding={0}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 && <View style={s.divider} />}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

export interface MeRowProps {
  icon: IconName;
  label: string;
  /** Small text under the label */
  hint?: string;
  /** Text on the right (current value) */
  value?: string;
  onPress?: () => void;
  /** Red label and icon (destructive action) */
  danger?: boolean;
  tone?: ColorSet;
  testID?: string;
}

/** One row: icon tile, label (+ hint), value, chevron. A plain row when there is no `onPress`. */
export function MeRow({ icon, label, hint, value, onPress, danger, tone = TONE.primary, testID }: MeRowProps) {
  const c = danger ? TONE.danger : tone;
  const content = (
    <>
      <View style={[s.tile, { backgroundColor: c.tint }]}>
        <Icon name={icon} size={20} color={c.deep} />
      </View>
      <View style={s.text}>
        <Text variant="label" color={danger ? 'dangerInk' : 'ink'} numberOfLines={2}>
          {label}
        </Text>
        {!!hint && (
          <Text variant="caption" color="ink2" style={s.hint}>
            {hint}
          </Text>
        )}
      </View>
      {!!value && (
        <Text variant="small" color="ink2" numberOfLines={1} style={s.value}>
          {value}
        </Text>
      )}
      {onPress && <Icon name="chevron-right" size={20} color={colors.ink3} />}
    </>
  );
  if (!onPress) {
    return (
      <View style={s.row} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <PressableLip
      onPress={onPress}
      lipDepth={0}
      colors={{ base: 'transparent', lip: 'transparent' }}
      accessibilityLabel={[label, value, hint].filter(Boolean).join('. ')}
      testID={testID}
      faceStyle={s.row}
    >
      {content}
    </PressableLip>
  );
}

const s = StyleSheet.create({
  section: { marginTop: space.xl },
  title: { marginBottom: space.s, marginLeft: space.xs },
  divider: { height: 2, backgroundColor: colors.cardBorder, marginLeft: 58 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingVertical: space.s, paddingLeft: space.m, paddingRight: space.s },
  tile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  hint: { marginTop: 2 },
  value: { maxWidth: '40%', flexShrink: 1 },
});
