/** Blocked people (Profile → Blocked people): everyone blocked on this device, with Unblock. */
import { StyleSheet, View } from 'react-native';

import { useUnblockPerson } from '@/components/social/BlockedNotice';
import { Button, Card, EmptyState, Header, Icon, Screen, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useBlocked } from '@/lib/social/blocked';
import { colors, space } from '@/lib/theme';

export default function BlockedPeople() {
  const t = useT();
  const { blocked } = useBlocked();
  const unblock = useUnblockPerson();
  return (
    <Screen header={<Header title={t.blocked.listTitle} />} testID="blocked-people">
      {blocked.length === 0 ? (
        <EmptyState
          style={s.mt}
          art={
            <View style={s.emptyTile}>
              <Icon name="shield" size={30} color={colors.primaryInk} />
            </View>
          }
          title={t.blocked.emptyTitle}
          body={t.blocked.emptyBody}
        />
      ) : (
        <>
          <Text variant="small" color="ink2" style={s.intro}>
            {t.blocked.listBody}
          </Text>
          <View style={s.list}>
            {blocked.map((p) => {
              const name = p.name || t.blocked.someone;
              return (
                <Card key={p.id} padding={space.m} contentStyle={s.row} testID={`blocked-${p.id}`}>
                  <View style={s.avatar}>
                    <Text variant="heading" color="ink2">
                      {(p.name.trim().charAt(0) || '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.text}>
                    <Text variant="label" numberOfLines={1}>
                      {name}
                    </Text>
                    {p.at > 0 && (
                      <Text variant="caption" color="ink2" numberOfLines={2}>
                        {t.blocked.since(t.time.ago(p.at))}
                      </Text>
                    )}
                  </View>
                  <Button
                    label={t.blocked.unblock}
                    accessibilityLabel={t.blocked.unblockA11y(name)}
                    variant="secondary"
                    size="sm"
                    inline
                    onPress={() => void unblock(p)}
                    testID={`unblock-${p.id}`}
                  />
                </Card>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  mt: { marginTop: space.l },
  intro: { marginTop: space.xs },
  list: { gap: space.m, marginTop: space.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  emptyTile: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
});
