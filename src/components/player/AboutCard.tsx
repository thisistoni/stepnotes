import { memo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';
import type { Dance } from '@/lib/types';

/** Credit ("Saved from Anna’s link"), description and reference-video button. Renders nothing when the dance has none of them. */
export const AboutCard = memo(function AboutCard({ dance }: { dance: Dance }) {
  const toast = useToast();
  const t = useT();
  const description = dance.description.trim();
  const url = dance.videoUrl?.trim();
  const source = dance.source;
  if (!description && !url && !source) return null;
  const author = source?.author.trim() || t.received.someone;
  const open = async () => {
    try {
      await Linking.openURL(url!);
    } catch {
      toast.show({ message: (tr) => tr.about.videoFailed, icon: 'alert' });
    }
  };
  return (
    <Card testID="about-card">
      <Text variant="cardTitle">{t.about.title}</Text>
      {!!source && (
        <View style={s.credit} testID="about-credit">
          <Icon name={source.kind === 'class' ? 'cap' : 'link'} size={16} color={colors.ink2} />
          <Text variant="small" color="ink2" style={s.creditText}>
            {source.kind === 'class' ? t.received.creditClass(author) : t.received.credit(author)}
          </Text>
        </View>
      )}
      {!!description && (
        <Text variant="body" color="ink2" style={s.desc}>
          {description}
        </Text>
      )}
      {!!url && (
        <Button label={t.about.video} icon="video" variant="secondary" size="sm" inline onPress={open} style={s.video} />
      )}
    </Card>
  );
});

const s = StyleSheet.create({
  credit: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  creditText: { flex: 1 },
  desc: { marginTop: space.xs },
  video: { marginTop: space.m },
});
