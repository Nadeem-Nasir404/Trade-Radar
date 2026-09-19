import { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Switch, Pressable, Alert as RNAlert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLogout } from "@/lib/api/hooks/use-auth";
import { useSubscription } from "@/lib/api/hooks/use-subscription";
import { useNotificationChannels, useToggleEmailChannel, useRegisterExpoPushToken } from "@/lib/api/hooks/use-notifications";
import { getNotificationPermissionGranted, requestNotificationPermission, getExpoPushToken } from "@/lib/safe-notifications";
import { isExpoGo } from "@/lib/is-expo-go";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import type { ThemeMode } from "@/lib/stores/theme-store";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
  { value: "system", label: "System", icon: "phone-portrait-outline" },
];

export default function ProfileScreen() {
  const { colors, mode, setMode } = useTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const { data: subscription } = useSubscription();
  const { data: channels } = useNotificationChannels();
  const toggleEmail = useToggleEmailChannel();
  const registerPushToken = useRegisterExpoPushToken();

  const [pushGranted, setPushGranted] = useState(false);
  useEffect(() => {
    getNotificationPermissionGranted().then((granted) => {
      setPushGranted(granted);
      if (granted) getExpoPushToken().then((token) => token && registerPushToken.mutate(token));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailChannel = channels?.find((c) => c.type === "EMAIL");
  const emailEnabled = emailChannel?.isEnabled ?? true;

  const handlePushToggle = async () => {
    haptics.light();
    if (pushGranted) {
      RNAlert.alert("Notifications are on", "To turn them off, disable notifications for CoinRadar in your device Settings.");
      return;
    }
    const granted = await requestNotificationPermission();
    setPushGranted(granted);
    if (granted) {
      const token = await getExpoPushToken();
      if (token) registerPushToken.mutate(token);
    }
    if (!granted && isExpoGo) {
      RNAlert.alert(
        "Not available in Expo Go",
        "Device push notifications need a development build. In Expo Go, alerts that fire while the app is open still show up as an in-app alert.",
      );
    } else if (!granted) {
      RNAlert.alert("Permission denied", "Enable notifications for CoinRadar in your device Settings to receive alerts.");
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText variant="title">Profile</ThemedText>

        <Surface style={[styles.card, styles.profileCard]}>
          <View style={[styles.avatar, { backgroundColor: colors.glassHover }]}>
            <ThemedText variant="subtitle">{(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}</ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText variant="subtitle">{user?.name || "Trader"}</ThemedText>
            <ThemedText variant="subtle">{user?.email}</ThemedText>
          </View>
        </Surface>

        <Surface style={styles.card}>
          <View style={styles.rowBetween}>
            <ThemedText variant="label">Plan</ThemedText>
            <ThemedText style={{ color: colors.brand, fontWeight: "600" }}>{subscription?.plan ?? "--"}</ThemedText>
          </View>
          <View style={[styles.rowBetween, { marginTop: 12 }]}>
            <ThemedText variant="label">Active alert limit</ThemedText>
            <ThemedText variant="mono">{subscription?.maxActiveAlerts ?? "--"}</ThemedText>
          </View>
        </Surface>

        <Surface style={styles.card}>
          <ThemedText variant="label" style={{ marginBottom: 12 }}>
            Appearance
          </ThemedText>
          <View style={[styles.segmented, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
            {THEME_OPTIONS.map((opt) => {
              const active = opt.value === mode;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    haptics.selection();
                    setMode(opt.value);
                  }}
                  style={[styles.segment, active && { backgroundColor: colors.brand }]}
                >
                  <Ionicons name={opt.icon} size={14} color={active ? colors.brandForeground : colors.foregroundMuted} />
                  <ThemedText style={[styles.segmentText, { color: active ? colors.brandForeground : colors.foregroundMuted }]}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Surface>

        <Surface style={styles.card}>
          <ThemedText variant="label" style={{ marginBottom: 12 }}>
            Notifications
          </ThemedText>
          <View style={styles.rowBetween}>
            <View style={styles.rowIcon}>
              <Ionicons name="notifications-outline" size={16} color={colors.foregroundMuted} />
              <ThemedText>Push notifications</ThemedText>
            </View>
            <Switch value={pushGranted} onValueChange={handlePushToggle} trackColor={{ true: colors.brand }} />
          </View>
          <View style={[styles.rowBetween, { marginTop: 14 }]}>
            <View style={styles.rowIcon}>
              <Ionicons name="mail-outline" size={16} color={colors.foregroundMuted} />
              <ThemedText>Email alerts</ThemedText>
            </View>
            <Switch
              value={emailEnabled}
              onValueChange={(next) => {
                haptics.light();
                toggleEmail.mutate(next);
              }}
              disabled={toggleEmail.isPending}
              trackColor={{ true: colors.brand }}
            />
          </View>
        </Surface>

        <Button title="Log out" variant="glass" onPress={() => logout.mutate()} loading={logout.isPending} style={styles.logout} />

        <ThemedText variant="subtle" style={styles.footnote}>
          Push notifications reach you even when CoinRadar is fully closed, plus email alerts if you&apos;ve turned those on.
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 110 },
  card: { padding: 16 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowIcon: { flexDirection: "row", alignItems: "center", gap: 8 },
  segmented: {
    flexDirection: "row",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  segmentText: { fontSize: 13, fontWeight: "600" },
  logout: { marginTop: 8 },
  footnote: { textAlign: "center", marginTop: 4, lineHeight: 18 },
});
