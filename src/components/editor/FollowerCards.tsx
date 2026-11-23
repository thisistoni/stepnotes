import { StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { radius, ROLE_COLOR, space, TONE } from '@/lib/theme';

const F = ROLE_COLOR.follower;

/** Shown on the Follower tab while the dance has no follower part. */
export function FollowerSetupCard({ onCreate }: { onCreate: (mode: 'mirror' | 'empty') => void }) {
  const t = useT();
  return (
    <Card padding={20} contentStyle={s.setup}>
      <View style={[s.tile, { backgroundColor: F.tint }]}>
        <Icon name="heel" size={30} color={F.base} />
      </View>
      <View style={s.text}>
        <Text variant="heading" align="center" accessibilityRole="header">
          {t.follower.addTitle}
        </Text>
        <Text variant="body" color="ink2" align="center" style={s.body}>
          {t.follower.addBody}
        </Text>
      </View>
      <View style={s.buttons}>
        <View>
          <Button label={t.follower.mirror} icon="mirror" tone={F} onPress={() => onCreate('mirror')} testID="follower-mirror" />
          <Text variant="caption" color="ink2" align="center" style={s.reco}>
            {t.follower.recommended}
          </Text>
        </View>
        <Button label={t.follower.empty} variant="secondary" onPress={() => onCreate('empty')} testID="follower-empty" />
      </View>
    </Card>
  );
}

/** Regenerate / remove the follower part (both ask first, both undoable). */
export function FollowerToolsCard({ onRegenerate, onRemove }: { onRegenerate: () => void; onRemove: () => void }) {
  const t = useT();
  return (
    <Card padding={16} contentStyle={s.tools}>
      <View>
        <Text variant="overline" color={F.deep}>
          {t.follower.toolsTitle}
        </Text>
        <Text variant="small" color="ink2" style={s.toolsBody}>
          {t.follower.toolsBody}
        </Text>
      </View>
      <View style={s.toolsRow}>
        <Button label={t.follower.mirrorAgain} icon="mirror" variant="secondary" size="sm" onPress={onRegenerate} style={s.flex} testID="follower-regenerate" />
        <Button label={t.follower.remove} icon="trash" variant="tinted" tone={TONE.danger} size="sm" onPress={onRemove} style={s.flex} testID="follower-remove" />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  setup: { alignItems: 'center', gap: space.l },
  tile: { width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  text: { alignItems: 'center' },
  body: { marginTop: space.s, maxWidth: 320 },
  buttons: { alignSelf: 'stretch', gap: space.m },
  reco: { marginTop: space.s },
  tools: { gap: space.m },
  toolsBody: { marginTop: 4 },
  toolsRow: { flexDirection: 'row', gap: space.s },
});
