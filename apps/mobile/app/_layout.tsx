import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@/lib/use-theme";
import { useAuthStore } from "@/lib/stores/auth-store";
import { bootstrapAuth } from "@/lib/api/hooks/use-auth";
import { useProtectedRoute } from "@/lib/hooks/use-protected-route";
import { setupNotificationHandler } from "@/lib/safe-notifications";
import { ToastHost } from "@/components/ui/toast-host";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
setupNotificationHandler();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});

export default function RootLayout() {
  const { colors } = useTheme();

  useEffect(() => {
    // Android runs edge-to-edge, so the status bar itself is always transparent - it shows
    // whatever the native window's own background is. That background is otherwise a static
    // value from app.json and never updates when the in-app theme toggles at runtime, which is
    // what left a stale dark bar behind the (correctly dark-styled, now invisible) icons in
    // light mode. Sync it explicitly every time the theme changes.
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <View style={[styles.flex, { backgroundColor: colors.background }]}>
            <StatusBar style={colors.statusBarStyle} />
            <AuthGate />
            <ToastHost />
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate() {
  const { colors } = useTheme();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bootstrapAuth()
      .then((user) => (user ? setAuthenticated(user) : setUnauthenticated()))
      .finally(() => setReady(true));
  }, [setAuthenticated, setUnauthenticated]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  useProtectedRoute();

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="create-alert" options={{ presentation: "modal", headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
