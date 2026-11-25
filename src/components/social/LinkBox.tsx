import { StyleSheet, View } from 'react-native';

import { Button, Icon, Text, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { displayUrl } from '@/lib/social/links';
import { colors, radius, space } from '@/lib/theme';

import { copyLink } from './linkActions';

/** A link in a well, with a "Copy link" button underneath. `testID` → `<id>-url`, `<id>-copy`. */
export function LinkBox({ url, testID = 'link' }: { url: string; testID?: string }) {
  const t = useT();
  const toast = useToast();
  return (
    <View style={s.box}>
      <View style={s.well}>
        <Icon name="link" size={18} color={colors.ink2} />
        <Text variant="smallStrong" numberOfLines={1} ellipsizeMode="middle" selectable style={s.url} testID={`${testID}-url`}>
          {displayUrl(url)}
        </Text>
      </View>
      <Button label={t.share.copyLink} icon="copy" variant="secondary" size="md" onPress={() => void copyLink(url, toast.show)} testID={`${testID}-copy`} />
    </View>
  );
}

const s = StyleSheet.create({
  box: { gap: space.s },
  well: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    minHeight: 48,
    paddingHorizontal: space.m,
    borderRadius: radius.md,
    backgroundColor: colors.track,
  },
  url: { flex: 1, minWidth: 0 },
});
