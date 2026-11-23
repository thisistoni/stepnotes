import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { space } from '@/lib/theme';

import { Button, type ButtonProps } from './Button';
import { Card } from './Card';
import { Text } from './Text';

export interface EmptyStateProps {
  /** Sticker illustration (e.g. a few <FootSticker>s) */
  art?: ReactNode;
  title: string;
  body?: string;
  /** Primary action button */
  action?: Pick<ButtonProps, 'label' | 'onPress' | 'icon' | 'variant' | 'testID'>;
  /** White card around it (default) or plain on the page */
  card?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Friendly empty / no-results block: illustration, title, one line, one action. */
export function EmptyState({ art, title, body, action, card = true, style }: EmptyStateProps) {
  const inner = (
    <View style={s.inner}>
      {art && <View style={s.art}>{art}</View>}
      <Text variant="cardTitle" align="center">
        {title}
      </Text>
      {!!body && (
        <Text variant="small" color="ink2" align="center" style={s.body}>
          {body}
        </Text>
      )}
      {action && <Button size="md" inline {...action} style={s.action} />}
    </View>
  );
  return card ? (
    <Card style={style} padding={space.xl}>
      {inner}
    </Card>
  ) : (
    <View style={[s.plain, style]}>{inner}</View>
  );
}

const s = StyleSheet.create({
  inner: { alignItems: 'center' },
  art: { marginBottom: space.m, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  body: { marginTop: 4, maxWidth: 300 },
  action: { marginTop: space.l, alignSelf: 'center' },
  plain: { paddingVertical: space.xl },
});
