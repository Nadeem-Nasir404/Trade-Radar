import { Redirect } from "expo-router";

// Not a real screen - the tab bar intercepts presses on this slot to open the create-alert
// modal instead of navigating here (see (tabs)/_layout.tsx's tabBarButton override). This
// exists only because Expo Router requires a route file for every Tabs.Screen name.
export default function FabPlaceholder() {
  return <Redirect href="/(tabs)" />;
}
