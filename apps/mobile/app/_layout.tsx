import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
// Per-weight entry points, so only the weights below are bundled (the package roots pull in every weight).
import { SpaceGrotesk_500Medium } from "@expo-google-fonts/space-grotesk/500Medium";
import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk/600SemiBold";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk/700Bold";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { EncodeSansExpanded_500Medium } from "@expo-google-fonts/encode-sans-expanded/500Medium";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, StyleSheet } from "react-native";
import { useTheme } from "@/lib/use-theme";
import { useAuthStore } from "@/lib/stores/auth-store";
import { bootstrapAuth } from "@/lib/api/hooks/use-auth";
import { persistQueryCache, restoreQueryCache } from "@/lib/api/query-persistence";
import { useProtectedRoute } from "@/lib/hooks/use-protected-route";
import { setupNotificationHandler, subscribeNotificationTaps } from "@/lib/safe-notifications";
import { SectionErrorBoundary } from "@/components/ui/error-boundary";

/** Notification data can carry numbers or strings; route params must be strings. */
function toParam(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}
import { ToastHost } from "@/components/ui/toast-host";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
setupNotificationHandler();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});
persistQueryCache(queryClient);

export default function RootLayout() {
  const { colors } = useTheme();
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    EncodeSansExpanded_500Medium,
  });

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
            <AuthGate fontsLoaded={fontsLoaded} />
            <ToastHost />
          </View>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { colors } = useTheme();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated);
  const [authReady, setAuthReady] = useState(false);
  const ready = authReady && fontsLoaded;

  useEffect(() => {
    bootstrapAuth()
      .then(async (user) => {
        if (!user) return setUnauthenticated();
        // Before the first screen mounts, so lists open with the last data instead of a spinner.
        await restoreQueryCache(queryClient, user.id);
        setAuthenticated(user);
      })
      .finally(() => setAuthReady(true));
  }, [setAuthenticated, setUnauthenticated]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let unsubscribe: (() => void) | undefined;
    subscribeNotificationTaps((data) => {
      const symbol = typeof data.symbol === "string" ? data.symbol : undefined;
      if (!symbol) return;
      // A tap that launched the app arrives before the navigator has mounted; defer the push so
      // it doesn't throw inside the notification callback, and never let a failed push kill the app.
      const go = () => {
        try {
          router.push({
            pathname: "/alert-triggered",
            params: {
              symbol,
              instrumentId: typeof data.instrumentId === "string" ? data.instrumentId : "",
              price: toParam(data.price),
              condition: typeof data.condition === "string" ? data.condition : "",
              target: toParam(data.target),
            },
          });
        } catch (err) {
          console.error("[notification tap]", err);
        }
      };
      setTimeout(go, 300);
    }).then((unsub) => {
      unsubscribe = unsub;
    });
    return () => unsubscribe?.();
  }, [ready]);

  useProtectedRoute();

  if (!ready) return null;

  return (
    <SectionErrorBoundary label="CoinRadar">
    {/* Same motion on both platforms: pushed screens slide in from the right (iOS-style, with the
        edge swipe back), sheets rise from the bottom, the fullscreen chart fades in. */}
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "ios_from_right" }}>
      <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
      <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
      <Stack.Screen name="create-alert" options={{ presentation: "modal", headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="alert-triggered" options={{ presentation: "modal", headerShown: false, animation: "slide_from_bottom" }} />
      <Stack.Screen name="fullscreen-chart" options={{ presentation: "fullScreenModal", headerShown: false, animation: "fade" }} />
      <Stack.Screen name="trades" options={{ headerShown: false }} />
      <Stack.Screen name="trade/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="new-trade" options={{ presentation: "modal", headerShown: false, animation: "slide_from_bottom" }} />
    </Stack>
    </SectionErrorBoundary>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
