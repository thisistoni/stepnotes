import { StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { radius, ROLE_COLOR, space, TONE } from '@/lib/theme';

const F = ROLE_COLOR.follower;

/** Shown on the Follower tab while the dance has no follower part. */
export function FollowerSetupCard({ onCreate }: { onCreate: (mode: 'mirror' | 'empty') => void }) {
  return (
    <Card padding={20} contentStyle={s.setup}>
      <View style={[s.tile, { backgroundColor: F.tint }]}>
        <Icon name="heel" size={30} color={F.base} />
      </View>
      <View style={s.text}>
        <Text variant="heading" align="center" accessibilityRole="header">
          Add the follower part
        </Text>
        <Text variant="body" color="ink2" align="center" style={s.body}>
          Partners face each other, so the follower usually mirrors the leader: left becomes right, forward becomes back.
        </Text>
      </View>
      <View style={s.buttons}>
        <View>
          <Button label="Mirror from leader" icon="mirror" tone={F} onPress={() => onCreate('mirror')} testID="follower-mirror" />
          <Text variant="caption" color={F.deep} align="center" style={s.reco}>
            Recommended: you can adjust any step afterwards
          </Text>
        </View>
        <Button label="Start empty" variant="secondary" onPress={() => onCreate('empty')} testID="follower-empty" />
      </View>
    </Card>
  );
}

/** Regenerate / remove the follower part (both ask first, both undoable). */
export function FollowerToolsCard({ onRegenerate, onRemove }: { onRegenerate: () => void; onRemove: () => void }) {
  return (
    <Card padding={16} contentStyle={s.tools}>
      <View>
        <Text variant="overline" color={F.deep}>
          Follower part
        </Text>
        <Text variant="small" color="ink2" style={s.toolsBody}>
          Changed the leader&apos;s steps? Mirror them again, or remove this part.
        </Text>
      </View>
      <View style={s.toolsRow}>
        <Button label="Mirror again" icon="mirror" variant="secondary" size="sm" onPress={onRegenerate} style={s.flex} testID="follower-regenerate" />
        <Button label="Remove" icon="trash" variant="tinted" tone={TONE.danger} size="sm" onPress={onRemove} style={s.flex} testID="follower-remove" />
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
