import { useFocusEffect } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { use, useCallback, useState, type ComponentRef, type ReactElement, type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, space } from '@/lib/theme';

import { EntranceScope } from './Entrance';
import { FAB_HEIGHT } from './Fab';
import { useKeyboardOpen } from './keyboard';
import { useToastInset } from './Toast';

export interface ScreenProps {
  children?: ReactNode;
  /** Pinned at the top (a `<Header>`); stays put while the content scrolls */
  header?: ReactNode;
  /** Scroll the content (default true). false = fixed layout filling the screen. */
  scroll?: boolean;
  /** Pinned at the bottom above the home indicator and the keyboard (primary actions) */
  footer?: ReactNode;
  /** Floating action button, bottom-right of the content column */
  fab?: ReactNode;
  /** Horizontal 24px gutter on the content (default true) */
  padded?: boolean;
  /** Extra style for the content container */
  contentStyle?: StyleProp<ViewStyle>;
  /** Respect the top safe area (default true; modals on iOS may pass false) */
  topInset?: boolean;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  /** Pull-to-refresh (`<RefreshControl refreshing onRefresh />`) for a scrolling screen */
  refreshControl?: ReactElement<RefreshControlProps>;
  testID?: string;
}

/**
 * Screen scaffold: cream page, safe areas, centred 480px column on wide screens, optional scroll
 * with keyboard avoidance, optional pinned footer and FAB (toasts are lifted above both).
 * Use inside a route (it registers its bottom chrome with the toast host on focus).
 */
export function Screen({
  children,
  header,
  scroll = true,
  footer,
  fab,
  padded = true,
  contentStyle,
  topInset = true,
  scrollRef,
  refreshControl,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardOpen();
  const [footerH, setFooterH] = useState(0);
  const registerInset = useToastInset();
  // inside the tab bar: it already keeps clear of the home indicator, and toasts go above it
  const tabBarH = use(BottomTabBarHeightContext);
  const inTabs = tabBarH !== undefined;
  // (the toast host adds the bottom safe area itself; the tab bar's height includes it)
  const chrome = (footer ? footerH : fab ? FAB_HEIGHT + space.l : 0) + (tabBarH ? Math.max(0, tabBarH - insets.bottom) : 0);
  useFocusEffect(
    useCallback(() => registerInset?.(chrome), [chrome, registerInset]),
  );

  const bottomSafe = kb ? space.m : inTabs ? space.l : Math.max(insets.bottom, space.l);
  const gutter = padded ? space.gutter : 0;
  const scrollBottom = footer ? space.xl : bottomSafe + space.xl + (fab ? FAB_HEIGHT + space.l : 0);

  return (
    <View style={s.page} testID={testID}>
      <EntranceScope>
        <KeyboardAvoidingView behavior="padding" style={s.flex} enabled={Platform.OS !== 'web'}>
          <View style={[s.column, { paddingTop: topInset ? insets.top : 0 }]}>
            {header}
            {scroll ? (
              <ScrollView
                ref={scrollRef}
                refreshControl={refreshControl}
                style={s.flex}
                contentContainerStyle={[{ paddingHorizontal: gutter, paddingBottom: scrollBottom }, contentStyle]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[s.flex, { paddingHorizontal: gutter }, contentStyle]}>{children}</View>
            )}
            {footer && (
              <View
                onLayout={(e: LayoutChangeEvent) => setFooterH(Math.round(e.nativeEvent.layout.height))}
                style={[s.footer, { paddingBottom: bottomSafe }]}
              >
                {footer}
              </View>
            )}
            {fab && <View style={[s.fab, { bottom: bottomSafe + space.s }]}>{fab}</View>}
          </View>
        </KeyboardAvoidingView>
      </EntranceScope>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  column: { flex: 1, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.m, backgroundColor: colors.bg },
  fab: { position: 'absolute', right: space.gutter },
});
