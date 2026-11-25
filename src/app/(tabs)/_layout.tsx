import { Tabs } from 'expo-router/js-tabs';

import { ErrorScreen } from '@/components/ErrorScreen';
import { TabBar } from '@/components/TabBar';
import { colors } from '@/lib/theme';

/**
 * Library · Classes · Me. URLs: `/`, `/classes`, `/me`. Screens above the tabs (player, editor,
 * import, sign-in, legal pages) live in the root stack, so the tab bar is not shown there.
 * A new tab-level screen: add a file here, a `<Tabs.Screen>` below and a row in `TAB_ITEMS`
 * (src/components/TabBar.tsx).
 */
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      unstable_screenErrorBoundary={ErrorScreen}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="classes" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
