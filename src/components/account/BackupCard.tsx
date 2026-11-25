import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { cloudErrorText } from '@/lib/cloud';
import { useSync } from '@/lib/cloud/sync';
import { useT, type Strings } from '@/lib/i18n';
import { colors, space, TONE } from '@/lib/theme';

function lastSyncedText(t: Strings, at: number | null, now: number) {
  if (!at) return t.sync.never;
  const min = Math.floor((Math.max(now, at) - at) / 60000);
  if (min < 1) return t.sync.justNow;
  if (min < 60) return t.sync.minutesAgo(min);
  let when: string;
  try {
    when = new Date(at).toLocaleString(t.code, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    when = new Date(at).toISOString().slice(0, 16).replace('T', ' ');
  }
  return t.sync.at(when);
}

/** Backup status on the Me tab: when, a readable error, "Back up now". */
export function BackupCard() {
  const t = useT();
  const { status, lastSyncedAt, error, syncNow } = useSync();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const failed = status === 'error';
  const syncing = status === 'syncing';
  const tone = failed ? TONE.danger : TONE.primary;
  const title = syncing ? t.sync.syncing : failed ? t.sync.error : lastSyncedText(t, lastSyncedAt, Math.max(now, lastSyncedAt ?? 0));
  return (
    <Card testID="backup-card">
      <View style={s.row}>
        <View style={[s.tile, { backgroundColor: tone.tint }]}>
          <Icon name={failed ? 'cloud-off' : lastSyncedAt ? 'cloud-check' : 'cloud'} size={24} color={tone.deep} />
        </View>
        <View style={s.text} accessibilityLiveRegion="polite">
          <Text variant="label" testID="backup-status">
            {title}
          </Text>
          {failed && error ? (
            <>
              <Text variant="small" color="dangerInk" style={s.line} testID="backup-error">
                {cloudErrorText(error, t)}
              </Text>
              <Text variant="caption" color="ink2" style={s.line}>
                {t.sync.retryHint}
              </Text>
            </>
          ) : (
            <Text variant="caption" color="ink2" style={s.line}>
              {t.sync.explain}
            </Text>
          )}
        </View>
      </View>
      <Button
        label={failed ? t.cloud.retry : t.sync.now}
        variant="secondary"
        size="sm"
        icon="rotate-right"
        loading={syncing}
        onPress={() => void syncNow()}
        style={s.button}
        testID="sync-now"
      />
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.m, alignItems: 'flex-start' },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryTint },
  text: { flex: 1, minWidth: 0, paddingTop: 2 },
  line: { marginTop: 4 },
  button: { marginTop: space.l },
});
