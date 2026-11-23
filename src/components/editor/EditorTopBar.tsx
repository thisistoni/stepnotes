import { StyleSheet, View } from 'react-native';

import { Button, Icon, IconButton, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';

export interface EditorTopBarProps {
  title: string;
  onClose: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onSave?: () => void;
  saving?: boolean;
}

/** Close ✕ · title · Undo · Save. Same insets as the kit Header (never flush to the edge). */
export function EditorTopBar({ title, onClose, onUndo, canUndo, onSave, saving }: EditorTopBarProps) {
  const t = useT();
  return (
    <View style={s.bar}>
      <IconButton icon="close" label={t.editor.close} onPress={onClose} testID="header-back" />
      <View style={s.center}>
        <Text variant="heading" numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {onUndo && (
        <IconButton
          icon="undo"
          label={t.editor.undo}
          onPress={onUndo}
          disabled={!canUndo}
          testID="undo"
        >
          <Icon name="undo" size={22} color={canUndo ? colors.ink : colors.ink3} strokeWidth={2.4} />
        </IconButton>
      )}
      {onSave && <Button label={t.editor.save} size="sm" inline loading={saving} onPress={onSave} style={s.save} testID="save" />}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: 20, paddingTop: space.s, paddingBottom: space.s },
  center: { flex: 1, minWidth: 0, paddingLeft: space.xxs },
  save: { alignSelf: 'center' },
});
