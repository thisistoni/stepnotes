import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text, useConfirm, useToast } from '@/components/ui';
import type { Author } from '@/lib/cloud';
import { useT } from '@/lib/i18n';
import { useBlocked } from '@/lib/social/blocked';
import { colors, space } from '@/lib/theme';

/** "You blocked Anna" with Unblock, shown instead of a blocked person's link or class. */
export function BlockedNotice({ person }: { person: Author }) {
  const t = useT();
  const unblock = useUnblockPerson();
  const name = person.name || t.blocked.someone;
  return (
    <Card padding={space.xl} testID="blocked-notice">
      <View style={s.center}>
        <View style={s.tile}>
          <Icon name="block" size={30} color={colors.ink2} />
        </View>
        <Text variant="cardTitle" align="center" style={s.title}>
          {t.blocked.noticeTitle(name)}
        </Text>
        <Text variant="small" color="ink2" align="center" style={s.body}>
          {t.blocked.noticeBody}
        </Text>
        <Button
          label={t.blocked.unblock}
          accessibilityLabel={t.blocked.unblockA11y(name)}
          variant="secondary"
          size="md"
          inline
          onPress={() => unblock(person)}
          style={s.button}
          testID="unblock"
        />
      </View>
    </Card>
  );
}

/** Confirm, block on this device and say so. Resolves true when blocked. */
export function useBlockPerson() {
  const { block } = useBlocked();
  const confirm = useConfirm();
  const toast = useToast();
  return useCallback(
    async (person: Author) => {
      const ok = await confirm({
        title: (tr) => tr.blocked.blockTitle(person.name || tr.blocked.someone),
        message: (tr) => tr.blocked.blockMessage(person.name || tr.blocked.someone),
        confirmLabel: (tr) => tr.blocked.blockConfirm,
        destructive: true,
        icon: 'block',
      });
      if (!ok) return false;
      try {
        await block(person);
        toast.show({ message: (tr) => tr.blocked.blockedToast(person.name || tr.blocked.someone), icon: 'block' });
        return true;
      } catch {
        toast.show({ message: (tr) => tr.persist.writeFailed, icon: 'alert' });
        return false;
      }
    },
    [block, confirm, toast],
  );
}

export function useUnblockPerson() {
  const { unblock } = useBlocked();
  const toast = useToast();
  return useCallback(
    async (person: Author) => {
      try {
        await unblock(person.id);
        toast.show({ message: (tr) => tr.blocked.unblocked(person.name || tr.blocked.someone), icon: 'check' });
      } catch {
        toast.show({ message: (tr) => tr.persist.writeFailed, icon: 'alert' });
      }
    },
    [unblock, toast],
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center' },
  tile: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: space.l },
  body: { marginTop: space.xxs, maxWidth: 300 },
  button: { marginTop: space.l },
});
