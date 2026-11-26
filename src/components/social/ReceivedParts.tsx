/**
 * Pieces of the pages that show someone else's dance (a shared link, a class post): the pinned
 * Save / Open footer, the first-visit lesson card, the "Open in the Waltzy app" link (web), a
 * full-page loading skeleton and the problem states (not found, offline, unreadable).
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { LessonCard } from '@/components/library/LessonCard';
import { Button, Card, EmptyState, FootSticker, Header, Icon, IconButton, Screen, Skeleton, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { usePrefs } from '@/lib/prefs';
import { colors, lip, radius, space, TONE } from '@/lib/theme';

/** Height of `ReceivedFooter` without the bottom safe area (padding 12 + button 56 + lip 5 + 16). */
export const RECEIVED_FOOTER_H = 89;

/** Primary action under a received dance: save a copy, or open the copy saved before. */
export function ReceivedFooter({
  savedId,
  onSave,
  saving,
}: {
  /** id of the copy in the library, if this dance was saved before */
  savedId?: string;
  onSave: () => void;
  saving: boolean;
}) {
  const t = useT();
  return savedId ? (
    <Button
      label={t.received.openSaved}
      icon="footprints"
      variant="secondary"
      onPress={() => router.push(`/dance/${savedId}`)}
      accessibilityHint={t.received.savedHint}
      testID="open-saved"
    />
  ) : (
    <Button label={t.received.save} icon="library-add" loading={saving} onPress={onSave} testID="save-copy" />
  );
}

/** The footprint lesson, offered to people who have never opened Waltzy before. */
export function FirstVisitLesson() {
  const { prefs } = usePrefs();
  if (prefs.onboardingDone) return null;
  return <LessonCard onPress={() => router.push('/intro?lesson=1')} />;
}

/** A small "Open in the Waltzy app" link (web only: the app's own scheme). */
export function OpenInApp({ url }: { url: string }) {
  const t = useT();
  if (Platform.OS !== 'web') return null;
  return (
    <Button
      label={t.received.openInApp}
      icon="arrow-right"
      variant="ghost"
      size="sm"
      inline
      onPress={() => void Linking.openURL(url).catch(() => {})}
      style={s.openInApp}
      testID="open-in-app"
    />
  );
}

/** A tinted strip with an icon and one or two lines (e.g. "You shared this dance"). */
export function InfoStrip({
  icon,
  title,
  body,
  action,
  muted,
  testID,
}: {
  icon: 'link' | 'cap' | 'cloud-off' | 'info' | 'lock' | 'people';
  title: string;
  body?: string;
  action?: ReactNode;
  /** neutral colours (offline, problems) instead of the green tint */
  muted?: boolean;
  testID?: string;
}) {
  const ink = muted ? colors.ink : TONE.primary.deep;
  // small phones: the action goes under the text instead of squeezing it
  const narrow = useWindowDimensions().width < 360;
  const stacked = !!action && narrow && !!body;
  return (
    <View style={[s.strip, muted && s.stripMuted, stacked && s.stripStacked]} testID={testID}>
      <View style={s.stripTile}>
        <Icon name={icon} size={20} color={muted ? colors.ink2 : ink} />
      </View>
      <View style={s.stripText}>
        <Text variant="label" color={ink}>
          {title}
        </Text>
        {!!body && (
          <Text variant="caption" color="ink2" style={s.stripBody}>
            {body}
          </Text>
        )}
      </View>
      {stacked ? <View style={s.stripAction}>{action}</View> : action}
    </View>
  );
}

/** Placeholder with the player's outline while a received dance loads. */
export function ReceivedSkeleton({ label, testID }: { label: string; testID?: string }) {
  return (
    <Screen header={<Header />} testID={testID}>
      <View accessible accessibilityLabel={label} style={s.skel}>
        <Skeleton width="60%" height={22} />
        <Skeleton width="35%" height={14} />
        <Skeleton height={300} radius={radius.xl} style={s.skelStage} />
        <Skeleton height={96} radius={radius.lg} />
        <View style={s.skelRow}>
          <Skeleton width={56} height={56} radius={28} />
          <Skeleton width={72} height={72} radius={36} />
          <Skeleton width={56} height={56} radius={28} />
        </View>
      </View>
    </Screen>
  );
}

/** A full page for "not found", "offline" and "unreadable": art, title, body, one action. */
export function ProblemPage({
  title,
  body,
  action,
  secondary,
  offline,
  right,
  testID,
}: {
  title: string;
  body: string;
  action: { label: string; onPress: () => void; icon?: 'refresh' | 'back' | 'footprints' | 'people'; testID?: string };
  secondary?: ReactNode;
  offline?: boolean;
  right?: ReactNode;
  testID?: string;
}) {
  return (
    <Screen header={<Header right={right} />} testID={testID} contentStyle={s.problem}>
      <EmptyState
        art={
          offline ? (
            <View style={s.offlineTile}>
              <Icon name="cloud-off" size={34} color={colors.ink2} />
            </View>
          ) : (
            <>
              <FootSticker size={40} tone={TONE.neutral} rotate={-10} />
              <FootSticker size={40} foot="R" tone={TONE.neutral} rotate={10} />
            </>
          )
        }
        title={title}
        body={body}
        action={action}
      />
      {secondary}
    </Screen>
  );
}

/** Header "…" button for the pages of other people's content. */
export function MoreButton({ onPress, label }: { onPress: () => void; label: string }) {
  return <IconButton icon="more" label={label} onPress={onPress} testID="more-button" />;
}

/** A card with the teacher's note on a class post. */
export function NoteCard({ title, note }: { title: string; note: string }) {
  return (
    <Card testID="post-note" colors={{ base: colors.card, lip: colors.cardLip, border: colors.cardBorder }}>
      <Text variant="overline" color="ink2">
        {title}
      </Text>
      <Text variant="body" style={s.note}>
        {note}
      </Text>
    </Card>
  );
}

const s = StyleSheet.create({
  openInApp: { alignSelf: 'center' },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    padding: space.m,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
    borderBottomWidth: lip.sm,
    borderBottomColor: colors.primaryBorder,
  },
  stripStacked: { flexWrap: 'wrap' },
  stripAction: { width: '100%', alignItems: 'flex-end' },
  stripMuted: { backgroundColor: colors.track, borderBottomColor: colors.cardLip },
  stripTile: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  stripText: { flex: 1, minWidth: 0 },
  stripBody: { marginTop: 2 },
  skel: { gap: space.m, paddingTop: space.s },
  skelStage: { marginTop: space.s },
  skelRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xl, marginTop: space.s },
  problem: { paddingTop: space.xl, gap: space.l },
  offlineTile: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: space.xxs },
});
