import { useState, type ComponentRef, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';

import { useT } from '@/lib/i18n';
import { colors, fonts, lip, radius } from '@/lib/theme';

import { Icon, type IconName } from '../Icon';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label?: string;
  /** Shown under the field in red; also turns the border red */
  error?: string | null;
  /** Shown under the field when there is no error */
  hint?: string;
  icon?: IconName;
  /** Show a clear (×) button while there is text; calls `onChangeText('')` */
  clearable?: boolean;
  /** Minimum height for multiline fields (default 120) */
  minHeight?: number;
  /** Monospace text (pasted JSON) */
  mono?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
  /** Outer box */
  style?: StyleProp<ViewStyle>;
}

// react-native-web draws the browser focus outline on the <input>; our border is the focus ring.
const WEB_NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle) : null;

/** Labelled text input with a lip, primary focus ring, leading icon, clear button and error text. */
export function TextField({
  label,
  error,
  hint,
  icon,
  clearable,
  multiline,
  minHeight = 120,
  mono,
  value,
  onChangeText,
  onFocus,
  onBlur,
  editable = true,
  ref,
  style,
  accessibilityLabel,
  ...rest
}: TextFieldProps) {
  const t = useT();
  const [focused, setFocused] = useState(false);
  const showClear = clearable && !!value && editable;
  const border = error ? colors.danger : focused ? colors.primary : colors.cardBorder;
  const bottom = error ? colors.dangerLip : focused ? colors.primaryLip : colors.cardLip;
  return (
    <View style={style}>
      {!!label && (
        <Text variant="smallStrong" color="ink2" style={s.label}>
          {label}
        </Text>
      )}
      <View
        style={[
          s.box,
          multiline ? { minHeight, alignItems: 'flex-start', paddingTop: 12 } : s.single,
          { borderColor: border, borderBottomColor: bottom },
          !editable && s.disabled,
        ]}
      >
        {icon && (
          <Icon name={icon} size={22} color={focused ? colors.primaryInk : colors.ink3} style={multiline ? s.iconTop : undefined} />
        )}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          multiline={multiline}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          accessibilityLabel={accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          maxFontSizeMultiplier={1.35}
          style={[
            s.input,
            mono && s.mono,
            multiline && { minHeight: minHeight - 26, textAlignVertical: 'top', paddingTop: 0 },
            WEB_NO_OUTLINE,
          ]}
          {...rest}
        />
        {showClear && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.common.clearText}
            hitSlop={10}
            onPress={() => onChangeText?.('')}
            style={s.clear}
          >
            <Icon name="x-circle" size={22} color={colors.ink3} />
          </Pressable>
        )}
      </View>
      {error ? (
        <View style={s.msgRow} accessibilityLiveRegion="polite">
          <Icon name="alert" size={16} color={colors.dangerInk} />
          <Text variant="small" color="dangerInk" style={s.msg}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" color="ink2" style={s.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Search box: magnifier, clear button, "search" return key. */
export function SearchField({ placeholder, ...rest }: Omit<TextFieldProps, 'icon' | 'clearable' | 'multiline'>) {
  const t = useT();
  return (
    <TextField
      icon="search"
      clearable
      placeholder={placeholder ?? t.common.search}
      returnKeyType="search"
      autoCorrect={false}
      autoCapitalize="none"
      accessibilityRole="search"
      {...rest}
    />
  );
}

const s = StyleSheet.create({
  label: { marginBottom: 6, marginLeft: 4 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderBottomWidth: lip.md,
  },
  single: { height: 52 },
  disabled: { backgroundColor: colors.track },
  iconTop: { marginTop: 1 },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    fontFamily: fonts.body700,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: 0,
  },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 13 },
  clear: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginRight: -4 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, marginLeft: 4 },
  msg: { flex: 1 },
  hint: { marginTop: 6, marginLeft: 4 },
});
