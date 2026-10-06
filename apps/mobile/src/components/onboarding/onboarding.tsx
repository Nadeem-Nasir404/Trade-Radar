import { useRef, useState } from "react";
import { View, Pressable, StyleSheet, Modal, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { withAlpha } from "@/lib/color";
import { haptics } from "@/lib/haptics";
import { requestNotificationPermission } from "@/lib/safe-notifications";

interface Step {
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  title: string;
  body: string;
  bullets: { icon: keyof typeof Ionicons.glyphMap; text: string }[];
  action?: { label: string; onPress: () => Promise<void> | void };
}

const STEPS: Step[] = [
  {
    icon: "pulse",
    eyebrow: "WELCOME",
    title: "Never miss a price move",
    body: "CoinRadar watches live crypto and gold prices, and tells you the moment your levels are hit.",
    bullets: [
      { icon: "flash-outline", text: "Live prices, updated in real time" },
      { icon: "notifications-outline", text: "Instant push and email alerts" },
      { icon: "shield-checkmark-outline", text: "Free plan, no credit card" },
    ],
  },
  {
    icon: "add-circle-outline",
    eyebrow: "ALERTS",
    title: "Set a level in seconds",
    body: "Tap the + button or any market, pick a condition, and enter a price. Alerts fire the moment price crosses it.",
    bullets: [
      { icon: "trending-up-outline", text: "Crosses above, below, or hits exactly" },
      { icon: "swap-horizontal-outline", text: "Range and percent-change alerts" },
      { icon: "list-outline", text: "Up to 50 active alerts on the free plan" },
    ],
  },
  {
    icon: "notifications-circle-outline",
    eyebrow: "NOTIFICATIONS",
    title: "Get alerts even when closed",
    body: "Allow notifications so push alerts reach you instantly. Email alerts are on by default.",
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
    icon: "analytics-outline",
    eyebrow: "CHARTS",
    title: "Read the chart like a pro",
    body: "Switch timeframes from 1m to 1d, draw trend lines and levels, and hold a price to set an alert right there.",
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

  const next = () => (isLast ? finish() : goTo(index + 1));
  const finish = () => {
    haptics.success();
    setIndex(0);
    onDone();
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={finish}>
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <AmbientOrbs />

        <View style={styles.topBar}>
          <View style={styles.progress}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i <= index ? colors.brand : colors.glassBorderStrong },
                  i === index && { width: 22 },
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

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={styles.flex}
        >
          {STEPS.map((step, i) => (
            <View key={i} style={[styles.page, { width }]}>
              <View style={styles.hero}>
                <LinearGradient
                  colors={[colors.brand, colors.brandGradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroIcon}
                >
                  <Ionicons name={step.icon} size={44} color={colors.brandForeground} />
                </LinearGradient>
                <View style={[styles.halo, { backgroundColor: colors.brandGlow }]} />
              </View>

              <Surface style={styles.card}>
                <ThemedText variant="label" style={[styles.eyebrow, { color: colors.brand }]}>
                  {step.eyebrow}
                </ThemedText>
                <ThemedText style={styles.title}>{step.title}</ThemedText>
                <ThemedText variant="muted" style={styles.body}>
                  {step.body}
                </ThemedText>

                <View style={styles.bullets}>
                  {step.bullets.map((b) => (
                    <View key={b.text} style={styles.bullet}>
                      <View style={[styles.bulletIcon, { backgroundColor: withAlpha(colors.brand, 0.14) }]}>
                        <Ionicons name={b.icon} size={16} color={colors.brand} />
                      </View>
                      <ThemedText style={styles.bulletText}>{b.text}</ThemedText>
                    </View>
                  ))}
                </View>

                {step.action && (
                  <Pressable
                    onPress={() => {
                      haptics.light();
                      step.action?.onPress();
                    }}
                    style={[styles.secondary, { borderColor: colors.brand, backgroundColor: withAlpha(colors.brand, 0.12) }]}
                  >
                    <Ionicons name="notifications" size={16} color={colors.brand} />
                    <ThemedText style={{ color: colors.brand, fontWeight: "600" }}>{step.action.label}</ThemedText>
                  </Pressable>
                )}
              </Surface>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={() => (index > 0 ? goTo(index - 1) : undefined)} disabled={index === 0} style={[styles.backBtn, { opacity: index === 0 ? 0 : 1 }]}>
            <Ionicons name="chevron-back" size={18} color={colors.foregroundMuted} />
            <ThemedText style={{ color: colors.foregroundMuted, fontWeight: "600" }}>Back</ThemedText>
          </Pressable>

          <Pressable onPress={next} style={styles.nextWrap}>
            <LinearGradient
              colors={[colors.brand, colors.brandGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextBtn}
            >
              <ThemedText style={{ color: colors.brandForeground, fontWeight: "700", fontSize: 15 }}>
                {isLast ? "Get started" : "Next"}
              </ThemedText>
              <Ionicons name={isLast ? "checkmark" : "arrow-forward"} size={18} color={colors.brandForeground} />
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12 },
  progress: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  skip: { paddingHorizontal: 16, height: 36, borderRadius: radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  page: { paddingHorizontal: 22, paddingTop: 12, gap: 22, justifyContent: "center" },
  hero: { alignItems: "center", justifyContent: "center", height: 150 },
  heroIcon: { width: 96, height: 96, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 220, height: 220, borderRadius: radius.full, opacity: 0.35, zIndex: -1 },
  card: { padding: 22, gap: 12 },
  eyebrow: { fontSize: 11, letterSpacing: 1 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 22 },
  bullets: { gap: 12, marginTop: 6 },
  bullet: { flexDirection: "row", alignItems: "center", gap: 12 },
  bulletIcon: { width: 32, height: 32, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  bulletText: { flex: 1, fontSize: 14 },
  secondary: { marginTop: 8, height: 46, borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, height: 48, paddingHorizontal: 8 },
  nextWrap: { borderRadius: radius.lg, overflow: "hidden", flex: 1, maxWidth: 220, marginLeft: 16 },
  nextBtn: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.lg },
});
