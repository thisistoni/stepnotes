import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, ChoiceRow, Sheet, Text, TextField, useScrollToEndOnFocus, useToast } from '@/components/ui';
import { cloud, cloudErrorText, type ReportKind, type ReportReason } from '@/lib/cloud';
import { useT } from '@/lib/i18n';
import { space, TONE } from '@/lib/theme';

const REASONS: { value: ReportReason; icon: 'alert' | 'mail' | 'copy' | 'more' }[] = [
  { value: 'offensive', icon: 'alert' },
  { value: 'spam', icon: 'mail' },
  { value: 'copyright', icon: 'copy' },
  { value: 'other', icon: 'more' },
];
const DETAILS_MAX = 500;

export interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  /** what is reported: a shared dance, a class, a class post or a person */
  kind: ReportKind;
  /** share id · class code · "<code>/<postId>" · user id */
  reportRef: string;
}

/** Report something: one of four reasons, optional details, a thank-you toast. Works without an account. */
export function ReportSheet({ visible, onClose, kind, reportRef }: ReportSheetProps) {
  const t = useT();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { scrollRef: endRef, onFocus: showEnd } = useScrollToEndOnFocus();
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setReason(null);
      setDetails('');
      setError(null);
    }
  }

  const send = async () => {
    if (!reason) return setError(t.report.pickFirst);
    setBusy(true);
    try {
      await cloud.report(kind, reportRef, reason, details.trim() || undefined);
      onClose();
      toast.show({ message: (tr) => tr.report.thanks, icon: 'check' });
    } catch (e) {
      setError(cloudErrorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t.report.title[kind]} testID="report-sheet">
      <ScrollView ref={endRef} style={s.scroll} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text variant="small" color="ink2">
          {t.report.body}
        </Text>
        <View style={s.reasons} accessibilityRole="radiogroup">
          {REASONS.map((r) => (
            <ChoiceRow
              key={r.value}
              title={t.report.reasons[r.value].title}
              subtitle={t.report.reasons[r.value].subtitle}
              icon={r.icon}
              tone={TONE.danger}
              selected={reason === r.value}
              onPress={() => {
                setReason(r.value);
                setError(null);
              }}
              testID={`report-reason-${r.value}`}
            />
          ))}
        </View>
        <TextField
          label={t.report.detailsLabel}
          value={details}
          onChangeText={setDetails}
          placeholder={t.report.detailsPlaceholder}
          multiline
          minHeight={88}
          maxLength={DETAILS_MAX}
          onFocus={showEnd}
          testID="report-details"
        />
        {!!error && (
          <Text variant="small" color="dangerInk" testID="report-error">
            {error}
          </Text>
        )}
        <Button label={t.report.send} icon="flag" variant="danger" loading={busy} onPress={send} testID="report-send" />
      </ScrollView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: space.m, paddingTop: space.xs, paddingBottom: space.xs },
  reasons: { gap: space.s },
});
