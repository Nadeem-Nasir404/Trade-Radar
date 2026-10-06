import { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Switch, Pressable, Alert as RNAlert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLogout } from "@/lib/api/hooks/use-auth";
import { useSubscription } from "@/lib/api/hooks/use-subscription";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { useNotificationChannels, useToggleEmailChannel, useRegisterExpoPushToken } from "@/lib/api/hooks/use-notifications";
import { api } from "@/lib/api/client";
import { getNotificationPermissionGranted, requestNotificationPermission, getExpoPushToken } from "@/lib/safe-notifications";
import { isExpoGo } from "@/lib/is-expo-go";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { withAlpha } from "@/lib/color";
import { useToastStore } from "@/lib/stores/toast-store";
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
  const { data: activeAlerts } = useAlerts({ status: "ACTIVE" });
  const { data: channels } = useNotificationChannels();
  const toggleEmail = useToggleEmailChannel();
  const registerPushToken = useRegisterExpoPushToken();
  const showToast = useToastStore((s) => s.show);

  const [pushGranted, setPushGranted] = useState(false);
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    getNotificationPermissionGranted().then((granted) => {
      setPushGranted(granted);
      if (granted) getExpoPushToken().then((token) => token && registerPushToken.mutate(token));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailChannel = channels?.find((c) => c.type === "EMAIL");
  const emailEnabled = emailChannel?.isEnabled ?? true;

  const used = activeAlerts?.length ?? 0;
  const limit = subscription?.maxActiveAlerts ?? 0;
  const usage = limit > 0 ? Math.min(used / limit, 1) : 0;

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

  const sendTest = async () => {
    haptics.light();
    setTesting(true);
    try {
      await Promise.all([
        api.post("/notifications/test", { channelType: "EMAIL" }),
        pushGranted ? api.post("/notifications/test", { channelType: "EXPO_PUSH" }).catch(() => null) : Promise.resolve(null),
      ]);
      showToast("Test sent", pushGranted ? "Check your inbox and notifications." : "Check your inbox. Enable push to test it too.", "success");
    } catch {
      showToast("Test failed", "Couldn't send a test right now. Try again in a moment.", "error");
    } finally {
      setTesting(false);
    }
  };

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <AmbientOrbs />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText variant="title" style={styles.pageTitle}>
          Profile
        </ThemedText>

        <Surface style={styles.hero}>
          <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
            <ThemedText style={[styles.avatarText, { color: colors.brandForeground }]}>
              {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
            </ThemedText>
          </View>
          <View style={styles.heroText}>
            <ThemedText style={styles.heroName}>{user?.name || "Trader"}</ThemedText>
            <ThemedText variant="subtle" numberOfLines={1}>
              {user?.email}
            </ThemedText>
          </View>
          <View style={[styles.planPill, { backgroundColor: withAlpha(colors.brand, 0.16) }]}>
            <ThemedText style={[styles.planText, { color: colors.brand }]}>{subscription?.plan ?? "FREE"}</ThemedText>
          </View>
        </Surface>

        <Surface style={styles.usageCard}>
          <View style={styles.rowBetween}>
            <ThemedText variant="label">Active alerts</ThemedText>
            <ThemedText variant="mono">
              {used} / {limit || "--"}
            </ThemedText>
          </View>
          <View style={[styles.track, { backgroundColor: colors.glassHover }]}>
            <View style={[styles.fill, { width: `${usage * 100}%`, backgroundColor: colors.brand }]} />
          </View>
          <ThemedText variant="subtle">
            {limit > 0 && used >= limit ? "You've reached your limit. Remove an alert to add another." : "Plenty of room for new levels."}
          </ThemedText>
        </Surface>

        <SectionTitle>Notifications</SectionTitle>
        <Surface style={styles.group}>
          <SettingRow icon="notifications-outline" label="Push notifications" hint="Reach you even when closed">
            <Switch value={pushGranted} onValueChange={handlePushToggle} trackColor={{ true: colors.brand }} />
          </SettingRow>
          <Divider />
          <SettingRow icon="mail-outline" label="Email alerts" hint="Sent to your account email">
            <Switch
              value={emailEnabled}
              onValueChange={(next) => {
                haptics.light();
                toggleEmail.mutate(next);
              }}
              disabled={toggleEmail.isPending}
              trackColor={{ true: colors.brand }}
            />
          </SettingRow>
          <Divider />
          <Pressable onPress={sendTest} disabled={testing} style={styles.rowPress}>
            <SettingRow icon="paper-plane-outline" label={testing ? "Sending test…" : "Send test notification"} hint="Checks email and push delivery">
              <Ionicons name="chevron-forward" size={18} color={colors.foregroundSubtle} />
            </SettingRow>
          </Pressable>
        </Surface>

        <SectionTitle>Appearance</SectionTitle>
        <Surface style={styles.group}>
          <View style={styles.themePad}>
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
          </View>
        </Surface>

        <SectionTitle>About</SectionTitle>
        <Surface style={styles.group}>
          <SettingRow icon="information-circle-outline" label="Version" hint="CoinRadar">
            <ThemedText variant="mono" style={{ color: colors.foregroundMuted }}>
              {version}
            </ThemedText>
          </SettingRow>
        </Surface>

        <Pressable
          onPress={() => {
            haptics.warning();
            logout.mutate();
          }}
          disabled={logout.isPending}
          style={[styles.logout, { borderColor: withAlpha(colors.negative, 0.4), backgroundColor: withAlpha(colors.negative, 0.1) }]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.negative} />
          <ThemedText style={[styles.logoutText, { color: colors.negative }]}>Log out</ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <ThemedText variant="label" style={styles.sectionTitle}>{children.toUpperCase()}</ThemedText>;
}

function SettingRow({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: withAlpha(colors.brand, 0.12) }]}>
        <Ionicons name={icon} size={16} color={colors.brand} />
      </View>
      <View style={styles.rowText}>
        <ThemedText>{label}</ThemedText>
        {hint && <ThemedText variant="subtle">{hint}</ThemedText>}
      </View>
      {children}
    </View>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 120 },
  pageTitle: { fontSize: 28, marginBottom: 4 },
  hero: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18 },
  avatar: { width: 52, height: 52, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "700" },
  heroText: { flex: 1, gap: 2 },
  heroName: { fontSize: 17, fontWeight: "600" },
  planPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  planText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  usageCard: { padding: 18, gap: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  track: { height: 6, borderRadius: radius.full, overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.full },
  sectionTitle: { marginTop: 10, marginLeft: 4, fontSize: 11, letterSpacing: 0.8 },
  group: { padding: 0, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowPress: {},
  rowIcon: { width: 32, height: 32, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  themePad: { padding: 12 },
  segmented: { flexDirection: "row", borderRadius: radius.md, borderWidth: 1, padding: 4, gap: 4 },
  segment: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: radius.sm },
  segmentText: { fontSize: 13, fontWeight: "600" },
  logout: {
    marginTop: 8,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: { fontSize: 15, fontWeight: "600" },
});
