import { StyleSheet, View } from 'react-native';

import { Entrance, Header, Screen, Text } from '@/components/ui';
import { OPERATOR } from '@/lib/cloud/config';
import { useT } from '@/lib/i18n';
import { space } from '@/lib/theme';

/**
 * Terms of use / privacy policy. The texts live in `t.legal`; who runs the app comes from
 * `OPERATOR` (src/lib/cloud/config.ts): a line whose value is still empty is simply not shown.
 */
export function LegalPage({ page }: { page: 'terms' | 'privacy' }) {
  const t = useT();
  const doc = t.legal[page];
  const contact = [
    OPERATOR.name.trim() && t.legal.operator(OPERATOR.name.trim()),
    OPERATOR.address.trim(),
    OPERATOR.email.trim() && t.legal.contact(OPERATOR.email.trim()),
  ].filter(Boolean) as string[];
  return (
    <Screen header={<Header />} testID={`legal-${page}`}>
      <Text variant="title" accessibilityRole="header" style={s.title}>
        {doc.title}
      </Text>
      {!!OPERATOR.updated.trim() && (
        <Text variant="caption" color="ink2" style={s.updated}>
          {t.legal.updated(OPERATOR.updated.trim())}
        </Text>
      )}
      {doc.sections.map((sec, i) => (
        <Entrance key={sec.heading} index={i} style={s.section}>
          <Text variant="cardTitle" accessibilityRole="header">
            {sec.heading}
          </Text>
          <Text variant="body" color="ink2" style={s.body}>
            {sec.body}
          </Text>
        </Entrance>
      ))}
      {contact.length > 0 && (
        <View style={s.section} testID="legal-contact">
          {contact.map((line) => (
            <Text key={line} variant="small" color="ink2">
              {line}
            </Text>
          ))}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { marginTop: space.s },
  updated: { marginTop: space.xs },
  section: { marginTop: space.xl },
  body: { marginTop: space.xs },
});
