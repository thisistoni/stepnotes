import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import type { ClassSummary } from '@/lib/cloud';
import { useT } from '@/lib/i18n';
import { colors, radius, ROLE_COLOR, space } from '@/lib/theme';

/**
 * One class in "My classes": name, teacher (or "You teach"), number of dances, last activity.
 * The teacher also sees how many people are in and how many are asking; someone who asked to join
 * sees that they are waiting.
 */
export const ClassCard = memo(function ClassCard({ cls, onOpen }: { cls: ClassSummary; onOpen: (code: string) => void }) {
  const t = useT();
  const tone = cls.mine ? ROLE_COLOR.leader : ROLE_COLOR.follower;
  const teacher = cls.mine ? t.classes.youTeach : t.classes.with(cls.owner.name.trim() || t.received.someone);
  const dances = t.classes.dances(cls.postCount);
  const when = t.classes.activity(t.time.ago(Date.parse(cls.updatedAt)));
  const waiting = !cls.mine && cls.membership === 'pending';
  const requests = cls.mine && cls.requestCount > 0 ? t.classes.requestsCount(cls.requestCount) : '';
  const meta = waiting ? t.classes.pendingTitle : cls.mine ? `${t.classes.membersCount(cls.memberCount)} · ${dances}` : `${dances} · ${when}`;
  return (
    <Card
      onPress={() => onOpen(cls.code)}
      accessibilityLabel={[t.classes.cardA11y(cls.name, teacher, waiting ? t.classes.pendingTitle : dances, when), cls.mine && t.classes.membersCount(cls.memberCount), requests].filter(Boolean).join(', ')}
      contentStyle={s.row}
      padding={space.m}
      testID={`class-card-${cls.code}`}
    >
      <View style={[s.tile, { backgroundColor: tone.tint }]}>
        <Icon name={cls.mine ? 'cap' : waiting ? 'lock' : 'people'} size={26} color={tone.deep} />
      </View>
      <View style={s.text}>
        <Text variant="cardTitle" numberOfLines={2}>
          {cls.name}
        </Text>
        <View style={s.teacherRow}>
          {cls.mine ? (
            <>
              <View style={[s.badge, { backgroundColor: tone.tint }]}>
                <Text variant="caption" color={tone.deep}>
                  {teacher}
                </Text>
              </View>
              {!!requests && (
                <View style={[s.badge, s.requests]} testID={`class-requests-${cls.code}`}>
                  <Text variant="caption" color="onColor">
                    {requests}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text variant="small" color="ink2" numberOfLines={1}>
              {teacher}
            </Text>
          )}
        </View>
        <Text variant="caption" color="ink2" numberOfLines={2} style={s.meta}>
          {meta}
        </Text>
      </View>
      <Icon name="chevron-right" size={22} color={colors.ink3} />
    </Card>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  tile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  teacherRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: 3 },
  requests: { backgroundColor: colors.primary },
  badge: { paddingHorizontal: space.s, paddingVertical: 2, borderRadius: radius.xs },
  meta: { marginTop: 3 },
});
