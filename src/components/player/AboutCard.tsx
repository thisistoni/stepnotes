import { memo } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { Button, Card, Text, useToast } from '@/components/ui';
import { space } from '@/lib/theme';
import type { Dance } from '@/lib/types';

/** Description and reference-video button. Renders nothing when the dance has neither. */
export const AboutCard = memo(function AboutCard({ dance }: { dance: Dance }) {
  const toast = useToast();
  const description = dance.description.trim();
  const url = dance.videoUrl?.trim();
  if (!description && !url) return null;
  const open = async () => {
    try {
      await Linking.openURL(url!);
    } catch {
      toast.show({ message: 'Could not open that video link.', icon: 'alert' });
    }
  };
  return (
    <Card testID="about-card">
      <Text variant="cardTitle">About</Text>
      {!!description && (
        <Text variant="body" color="ink2" style={s.desc}>
          {description}
        </Text>
      )}
      {!!url && (
        <Button label="Watch reference video" icon="video" variant="secondary" size="sm" inline onPress={open} style={s.video} />
      )}
    </Card>
  );
});

const s = StyleSheet.create({
  desc: { marginTop: space.xs },
  video: { marginTop: space.m },
});
