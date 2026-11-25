import { use, useEffect } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { hapticSelect, Icon, Text, useReducedMotion, type IconName } from '@/components/ui';
import { useT, type Strings } from '@/lib/i18n';
import { colors, layout, motion, radius, space } from '@/lib/theme';

/** The three tabs, by route name. Add a tab-level screen: a file in `src/app/(tabs)/`, a row here and a `<Tabs.Screen>`. */
export const TAB_ITEMS: Record<string, { icon: IconName; label: (t: Strings) => string }> = {
  index: { icon: 'footprints', label: (t) => t.tabs.library },
  classes: { icon: 'people', label: (t) => t.tabs.classes },
  me: { icon: 'person', label: (t) => t.tabs.me },
};

/**
 * Playful Pop tab bar: white bar on a warm border, each tab an icon + label; the selected tab
 * gets a tinted pill that pops in. ≥ 56 pt tall targets, above the home indicator.
 */
export function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const t = useT();
  const onHeight = use(BottomTabBarHeightCallbackContext);
  return (
    <View
      style={[s.bar, { paddingBottom: Math.max(insets.bottom, space.s), paddingLeft: insets.left, paddingRight: insets.right }]}
      onLayout={(e: LayoutChangeEvent) => onHeight?.(Math.round(e.nativeEvent.layout.height))}
      testID="tab-bar"
    >
      <View style={s.row} role="tablist">
        {state.routes.map((route, index) => {
          const item = TAB_ITEMS[route.name];
          if (!item) return null;
          const focused = index === state.index;
          const label = item.label(t);
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              hapticSelect();
              navigateToTab(route.key);
            }
          };
          return (
            <TabButton
              key={route.key}
              icon={item.icon}
              label={label}
              focused={focused}
              onPress={onPress}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              testID={`tab-${route.name === 'index' ? 'library' : route.name}`}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabButton({
  icon,
  label,
  focused,
  onPress,
  onLongPress,
  testID,
}: {
  icon: IconName;
  label: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  testID: string;
}) {
  const reduced = useReducedMotion();
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.set(reduced ? withTiming(focused ? 1 : 0, { duration: motion.fast }) : withSpring(focused ? 1 : 0, motion.pop));
  }, [focused, reduced, on]);
  const pill = useAnimatedStyle(() => ({ opacity: Math.min(1, on.get()), transform: [{ scaleX: 0.6 + 0.4 * on.get() }] }));
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      role="tab"
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      aria-selected={focused}
      accessibilityLabel={label}
      style={s.item}
      testID={testID}
    >
      <View style={s.iconBox}>
        <Animated.View style={[s.pill, pill]} />
        <View style={s.icon}>
          <Icon name={icon} size={24} color={focused ? colors.primaryInk : colors.ink2} strokeWidth={focused ? 2.5 : 2.25} />
        </View>
      </View>
      <Text variant={focused ? 'smallStrong' : 'small'} color={focused ? 'primaryInk' : 'ink2'} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderTopColor: colors.cardBorder,
    paddingTop: space.xs,
  },
  row: { flexDirection: 'row', width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: space.s },
  item: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 2 },
  iconBox: { width: 60, height: 32, alignItems: 'center', justifyContent: 'center' },
  icon: { zIndex: 1 },
  pill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: colors.primaryTint },
});
