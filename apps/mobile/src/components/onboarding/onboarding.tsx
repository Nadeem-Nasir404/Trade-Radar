import { useRef, useState } from "react";
import { View, Pressable, StyleSheet, Modal, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/themed-text";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { Icon3D } from "@/components/ui/icon-3d";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { withAlpha } from "@/lib/color";
import { haptics } from "@/lib/haptics";
import { requestNotificationPermission } from "@/lib/safe-notifications";

type StepKind = "welcome" | "alerts" | "notify" | "charts";

interface Step {
  kind: StepKind;
  accent: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: { icon: keyof typeof Ionicons.glyphMap; text: string }[];
  action?: { label: string; onPress: () => Promise<void> | void };
}

const STEPS: Step[] = [
  {
    kind: "welcome",
    accent: "#7C3AED",
    eyebrow: "WELCOME",
    title: "Never miss a price move",
    body: "Live crypto and gold prices, and an instant ping the moment your level is hit.",
    bullets: [
      { icon: "flash-outline", text: "Live prices, updated in real time" },
      { icon: "notifications-outline", text: "Instant push and email alerts" },
      { icon: "shield-checkmark-outline", text: "Free plan, no credit card" },
    ],
  },
  {
    kind: "alerts",
    accent: "#2563EB",
    eyebrow: "ALERTS",
    title: "Set a level in seconds",
    body: "Pick a market, choose a condition, and enter a price. We watch it for you.",
    bullets: [
      { icon: "trending-up-outline", text: "Crosses above, below, or hits exactly" },
      { icon: "swap-horizontal-outline", text: "Range and percent-change alerts" },
      { icon: "list-outline", text: "Up to 50 active alerts on the free plan" },
    ],
  },
  {
    kind: "notify",
    accent: "#F59E0B",
    eyebrow: "NOTIFICATIONS",
    title: "Alerts that reach you closed",
    body: "Allow notifications so push alerts arrive instantly, even when the app is closed.",
    bullets: [
      { icon: "phone-portrait-outline", text: "Push works with the app fully closed" },
      { icon: "mail-outline", text: "Email goes to your account address" },
      { icon: "options-outline", text: "Change channels per alert, anytime" },
    ],
    action: {
      label: "Allow notifications",
      onPress: async () => {
        await requestNotificationPermission();
      },
    },
  },
  {
    kind: "charts",
    accent: "#16A34A",
    eyebrow: "CHARTS",
    title: "Read the chart like a pro",
    body: "Switch timeframes from 1m to 1d, draw levels and trend lines, and hold a price to set an alert.",
    bullets: [
      { icon: "pencil-outline", text: "Trend lines, levels, and zones" },
      { icon: "hand-left-outline", text: "Hold a price to add an alert" },
      { icon: "expand-outline", text: "Full-screen charts with live candles" },
    ],
  },
];

export function Onboarding({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = index === STEPS.length - 1;

  const goTo = (i: number) => {
    haptics.selection();
    setIndex(i);
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
  };

  const finish = () => {
    haptics.success();
    setIndex(0);
    onDone();
  };

  const next = () => (isLast ? finish() : goTo(index + 1));

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={finish}>
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <AmbientOrbs />

        <View style={styles.topBar}>
          <View style={styles.progress}>
            {STEPS.map((step, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i <= index ? step.accent : colors.glassBorderStrong },
                  i === index && { width: 26 },
                ]}
              />
            ))}
          </View>
          {!isLast && (
            <Pressable hitSlop={12} onPress={finish} style={[styles.skip, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
              <ThemedText style={{ color: colors.foregroundMuted, fontWeight: "600" }}>Skip</ThemedText>
            </Pressable>
          )}
        </View>

        <ScrollView ref={scrollRef} horizontal pagingEnabled scrollEnabled={false} showsHorizontalScrollIndicator={false} style={styles.flex}>
          {STEPS.map((step, i) => (
            <StepPage key={i} step={step} width={width} />
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={() => goTo(index - 1)} disabled={index === 0} style={[styles.backBtn, { opacity: index === 0 ? 0 : 1 }]}>
            <Ionicons name="chevron-back" size={18} color={colors.foregroundMuted} />
            <ThemedText style={{ color: colors.foregroundMuted, fontWeight: "600" }}>Back</ThemedText>
          </Pressable>

          <Pressable onPress={next} style={styles.nextWrap}>
            <LinearGradient
              colors={[STEPS[index].accent, withAlpha(STEPS[index].accent, 0.7)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextBtn}
            >
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>{isLast ? "Get started" : "Next"}</ThemedText>
              <Ionicons name={isLast ? "checkmark" : "arrow-forward"} size={18} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function StepPage({ step, width }: { step: Step; width: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.page, { width }]}>
      <View style={styles.visualArea}>
        <StepVisual kind={step.kind} accent={step.accent} />
      </View>

      <View style={styles.copy}>
        <ThemedText style={[styles.eyebrow, { color: step.accent }]}>{step.eyebrow}</ThemedText>
        <ThemedText style={styles.title}>{step.title}</ThemedText>
        <ThemedText variant="muted" style={styles.body}>
          {step.body}
        </ThemedText>

        <View style={styles.bullets}>
          {step.bullets.map((b) => (
            <View key={b.text} style={[styles.bulletPill, { backgroundColor: withAlpha(step.accent, 0.1), borderColor: withAlpha(step.accent, 0.25) }]}>
              <Ionicons name={b.icon} size={15} color={step.accent} />
              <ThemedText style={{ color: colors.foreground, fontSize: 13 }}>{b.text}</ThemedText>
            </View>
          ))}
        </View>

        {step.action && (
          <Pressable
            onPress={() => {
              haptics.light();
              step.action?.onPress();
            }}
            style={[styles.secondary, { borderColor: step.accent, backgroundColor: withAlpha(step.accent, 0.12) }]}
          >
            <Ionicons name="notifications" size={16} color={step.accent} />
            <ThemedText style={{ color: step.accent, fontWeight: "700" }}>{step.action.label}</ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Each step gets its own visual, so the four pages never look alike. */
function StepVisual({ kind, accent }: { kind: StepKind; accent: string }) {
  const { colors } = useTheme();

  if (kind === "welcome") {
    return (
      <View style={styles.cluster}>
        <View style={styles.clusterBack} />
        <View style={[styles.clusterA]}>
          <Icon3D icon="pulse" color="#7C3AED" size={92} />
        </View>
        <View style={styles.clusterB}>
          <Icon3D icon="notifications" color="#F59E0B" size={62} />
        </View>
        <View style={styles.clusterC}>
          <Icon3D icon="analytics" color="#16A34A" size={58} />
        </View>
      </View>
    );
  }

  if (kind === "alerts") {
    return (
      <View style={[styles.previewCard, { backgroundColor: colors.backgroundElevated, borderColor: colors.glassBorderStrong }]}>
        <View style={styles.previewRow}>
          <View style={[styles.coin, { backgroundColor: "#F59E0B" }]}>
            <ThemedText style={styles.coinText}>B</ThemedText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText style={{ fontWeight: "700" }}>BTC/USDT</ThemedText>
            <ThemedText variant="subtle">Crosses above</ThemedText>
          </View>
          <ThemedText variant="mono" style={{ fontWeight: "700" }}>$68,200</ThemedText>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />
        <View style={styles.previewRow}>
          <Icon3D icon="alarm" color={accent} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText style={{ fontWeight: "700" }}>Alert set</ThemedText>
            <ThemedText variant="subtle">Push + email</ThemedText>
          </View>
          <View style={[styles.toggle, { backgroundColor: accent }]}>
            <View style={styles.knob} />
          </View>
        </View>
      </View>
    );
  }

  if (kind === "notify") {
    return (
      <View style={styles.notifyWrap}>
        <View style={[styles.banner, { backgroundColor: colors.backgroundElevated, borderColor: colors.glassBorderStrong }]}>
          <Icon3D icon="notifications" color={accent} size={38} />
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText style={{ fontWeight: "700" }}>AAVE/USDT crossed above 184.50</ThemedText>
            <ThemedText variant="subtle">Observed price 184.62 · now</ThemedText>
          </View>
        </View>
        <View style={[styles.banner, styles.bannerBehind, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <Icon3D icon="mail" color="#2563EB" size={34} />
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText style={{ fontWeight: "600" }}>Email sent to you</ThemedText>
            <ThemedText variant="subtle">Delivered in seconds</ThemedText>
          </View>
        </View>
      </View>
    );
  }

  const heights = [40, 62, 48, 88, 70, 104, 82, 118, 96, 60, 74, 50];
  return (
    <View style={[styles.chartCard, { backgroundColor: colors.backgroundElevated, borderColor: colors.glassBorderStrong }]}>
      <View style={styles.chipRow}>
        {["1m", "5m", "1h"].map((tf, i) => (
          <View key={tf} style={[styles.chip, i === 0 && { backgroundColor: accent }]}>
            <ThemedText style={{ color: i === 0 ? "#FFFFFF" : colors.foregroundMuted, fontSize: 11, fontWeight: "700" }}>{tf}</ThemedText>
          </View>
        ))}
      </View>
      <View style={styles.candles}>
        {heights.map((h, i) => {
          const up = i % 3 !== 1;
          const c = up ? "#16A34A" : "#DC2626";
          return (
            <View key={i} style={styles.candleCol}>
              <View style={{ width: 1.5, height: h + 10, backgroundColor: c }} />
              <View style={[styles.candleBody, { height: h * 0.55, backgroundColor: c }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12 },
  progress: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  skip: { paddingHorizontal: 16, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  page: { paddingHorizontal: 24, paddingTop: 8, justifyContent: "space-between", flex: 1 },
  visualArea: { height: 260, alignItems: "center", justifyContent: "center" },
  copy: { gap: 12, paddingBottom: 8 },
  eyebrow: { fontSize: 12, letterSpacing: 1.2, fontWeight: "700" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.6 },
  body: { fontSize: 15, lineHeight: 22 },
  bullets: { gap: 8, marginTop: 4 },
  bulletPill: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 40, borderRadius: radius.full, borderWidth: 1, alignSelf: "flex-start" },
  secondary: { marginTop: 6, height: 50, borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },

  cluster: { width: 260, height: 240, alignItems: "center", justifyContent: "center" },
  clusterBack: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(124,58,237,0.12)" },
  clusterA: { position: "absolute", top: 40, left: 60 },
  clusterB: { position: "absolute", top: 0, right: 10 },
  clusterC: { position: "absolute", bottom: 10, left: 10 },

  previewCard: { width: "100%", borderRadius: radius.xl, borderWidth: 1, padding: 16, gap: 14, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  coin: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  coinText: { color: "#FFFFFF", fontWeight: "800" },
  divider: { height: StyleSheet.hairlineWidth },
  toggle: { width: 46, height: 26, borderRadius: 13, justifyContent: "center", paddingHorizontal: 3, alignItems: "flex-end" },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFFFFF" },

  notifyWrap: { width: "100%", gap: 12 },
  banner: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: radius.xl, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  bannerBehind: { marginLeft: 24, transform: [{ scale: 0.96 }] },

  chartCard: { width: "100%", borderRadius: radius.xl, borderWidth: 1, padding: 16, gap: 14 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { paddingHorizontal: 10, height: 24, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  candles: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 130 },
  candleCol: { alignItems: "center", justifyContent: "flex-end" },
  candleBody: { width: 8, borderRadius: 2 },

  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 48, paddingHorizontal: 8 },
  nextWrap: { borderRadius: radius.lg, overflow: "hidden", flex: 1, maxWidth: 230, marginLeft: 16 },
  nextBtn: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.lg },
});
