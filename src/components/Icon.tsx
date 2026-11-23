import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

/**
 * App icon: SF Symbols on iOS, Material Symbols on Android and web (font bundled with
 * expo-symbols, loaded at runtime via expo-font; works in Expo Go). Give both names:
 *   <Icon ios="play.fill" material="play_arrow" size={24} color={colors.text} />
 * SF Symbols: Apple's SF Symbols app. Material: https://fonts.google.com/icons
 */
export function Icon({
  ios,
  material,
  size = 24,
  color,
  style,
}: {
  ios: Extract<SymbolViewProps['name'], string>;
  material: Exclude<SymbolViewProps['name'], string>['android'];
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
}) {
  return <SymbolView name={{ ios, android: material, web: material }} size={size} tintColor={color} style={style} />;
}
