import { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateAlert } from "@/lib/api/hooks/use-alerts";
import { formatCompactPrice } from "@/lib/format";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { useToastStore } from "@/lib/stores/toast-store";
import { haptics } from "@/lib/haptics";
import type { ConditionType, NotificationChannelType } from "@levelpulse/shared-types";

const CONDITION_OPTIONS: { value: ConditionType; label: string; icon: keyof typeof Ionicons.glyphMap; needsSecondary?: boolean }[] = [
  { value: "CROSSES_ABOVE", label: "Crosses above", icon: "arrow-up" },
  { value: "CROSSES_BELOW", label: "Crosses below", icon: "arrow-down" },
  { value: "ABOVE", label: "Above", icon: "trending-up" },
  { value: "BELOW", label: "Below", icon: "trending-down" },
  { value: "EQUALS", label: "Hits exactly", icon: "remove" },
  { value: "PCT_CHANGE", label: "% change", icon: "pulse" },
  { value: "ENTERS_RANGE", label: "Enters range", icon: "swap-horizontal", needsSecondary: true },
  { value: "EXITS_RANGE", label: "Exits range", icon: "swap-horizontal", needsSecondary: true },
];

const CHANNELS: { value: NotificationChannelType; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "EXPO_PUSH", label: "Push", hint: "Instant, even when closed", icon: "notifications-outline" },
  { value: "EMAIL", label: "Email", hint: "Sent to your account email", icon: "mail-outline" },
  { value: "TELEGRAM", label: "Telegram", hint: "Needs a linked bot", icon: "paper-plane-outline" },
  { value: "DISCORD", label: "Discord", hint: "Needs a webhook", icon: "logo-discord" },
];

export function CreateAlertForm({
  instrumentId,
  symbol,
  currentPrice,
  defaultTargetValue,
  onSuccess,
}: {
  instrumentId: string;
  symbol: string;
  currentPrice?: number | null;
  defaultTargetValue?: number;
  onSuccess?: () => void;
}) {
  const { colors } = useTheme();
  const [conditionType, setConditionType] = useState<ConditionType>("CROSSES_ABOVE");
  const [targetValue, setTargetValue] = useState(defaultTargetValue ? String(defaultTargetValue) : "");
  const [secondaryValue, setSecondaryValue] = useState("");
  const [pctDirection, setPctDirection] = useState<"up" | "down">("up");
  const [channels, setChannels] = useState<Set<NotificationChannelType>>(new Set(["EXPO_PUSH", "EMAIL"]));
  const [note, setNote] = useState("");
  const createAlert = useCreateAlert();
  const showToast = useToastStore((s) => s.show);

  const selected = CONDITION_OPTIONS.find((c) => c.value === conditionType)!;
  const isPct = conditionType === "PCT_CHANGE";
  const numeric = Number(targetValue);
  const hasValidTarget = targetValue !== "" && Number.isFinite(numeric) && numeric > 0;

  const applyPreset = (kind: "current" | "+1" | "-1") => {
    if (!currentPrice) return;
    haptics.selection();
    if (kind === "current") setTargetValue(String(currentPrice));
    else setTargetValue(String(Number((currentPrice * (kind === "+1" ? 1.01 : 0.99)).toPrecision(8))));
  };

  const toggleChannel = (value: NotificationChannelType, on: boolean) => {
    haptics.selection();
    setChannels((prev) => {
      const next = new Set(prev);
      if (on) next.add(value);
      else next.delete(value);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!hasValidTarget) return;
    const resolvedTarget = isPct ? Math.abs(numeric) * (pctDirection === "down" ? -1 : 1) : numeric;
    await createAlert.mutateAsync({
      instrumentId,
      conditionType,
      targetValue: resolvedTarget,
      secondaryValue: selected.needsSecondary && secondaryValue ? Number(secondaryValue) : undefined,
      channels: CHANNELS.map((c) => ({ channelType: c.value, isEnabled: channels.has(c.value) })),
      notes: note.trim() || undefined,
    });
    haptics.success();
    const targetLabel = isPct ? `${pctDirection === "down" ? "-" : "+"}${Math.abs(numeric)}%` : targetValue;
    showToast("Alert created", `${symbol} will notify you when it ${selected.label.toLowerCase()} ${targetLabel}`, "success");
    onSuccess?.();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Surface style={styles.hero}>
        <LinearGradient
          colors={[colors.brandGlow, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <ThemedText variant="subtle">{symbol} · current price</ThemedText>
        <ThemedText variant="mono" style={styles.heroPrice}>
          {currentPrice != null ? formatCompactPrice(currentPrice) : "--"}
        </ThemedText>
      </Surface>

      <Section title="Condition">
        <View style={styles.grid}>
          {CONDITION_OPTIONS.map((opt) => {
            const active = opt.value === conditionType;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  haptics.selection();
                  setConditionType(opt.value);
                }}
                style={[styles.option, { backgroundColor: active ? colors.brandGlow : colors.glass, borderColor: active ? colors.brand : colors.glassBorder }]}
              >
                <Ionicons name={opt.icon} size={16} color={active ? colors.brand : colors.foregroundMuted} />
                <ThemedText style={{ color: active ? colors.foreground : colors.foregroundMuted, fontWeight: "600", fontSize: 13 }}>{opt.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title={isPct ? "Change" : selected.needsSecondary ? "Range" : "Target price"}>
        {isPct ? (
          <View style={styles.pctRow}>
            <View style={[styles.dirToggle, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
              {(["up", "down"] as const).map((dir) => {
                const active = pctDirection === dir;
                return (
                  <Pressable
                    key={dir}
                    onPress={() => {
                      haptics.selection();
                      setPctDirection(dir);
                    }}
                    style={[styles.dirSegment, active && { backgroundColor: dir === "up" ? colors.positive : colors.negative }]}
                  >
                    <Ionicons name={dir === "up" ? "arrow-up" : "arrow-down"} size={16} color={active ? colors.brandForeground : colors.foregroundMuted} />
                  </Pressable>
                );
              })}
            </View>
            <Input value={targetValue} onChangeText={setTargetValue} keyboardType="decimal-pad" placeholder="5" style={styles.bigInput} />
            <ThemedText variant="muted">%</ThemedText>
          </View>
        ) : (
          <>
            <Input
              value={targetValue}
              onChangeText={setTargetValue}
              keyboardType="decimal-pad"
              placeholder={currentPrice ? String(currentPrice) : "0.00"}
              style={styles.bigInput}
            />
            {selected.needsSecondary && (
              <Input value={secondaryValue} onChangeText={setSecondaryValue} keyboardType="decimal-pad" placeholder="Upper bound" style={styles.bigInput} />
            )}
            {currentPrice != null && !selected.needsSecondary && (
              <View style={styles.presets}>
                <Preset label="Current" onPress={() => applyPreset("current")} />
                <Preset label="+1%" onPress={() => applyPreset("+1")} />
                <Preset label="-1%" onPress={() => applyPreset("-1")} />
              </View>
            )}
          </>
        )}
        {targetValue !== "" && !hasValidTarget && (
          <ThemedText style={{ color: colors.negative, fontSize: 12 }}>Enter a number greater than 0.</ThemedText>
        )}
      </Section>

      <Section title="Note (optional)">
        <Input value={note} onChangeText={setNote} placeholder="e.g. swing trade level" maxLength={140} />
      </Section>

      <Section title="Notify me">
        <Surface style={styles.channelCard}>
          {CHANNELS.map((c, i) => (
            <View key={c.value}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />}
              <View style={styles.channelRow}>
                <View style={[styles.channelIcon, { backgroundColor: colors.brandGlow }]}>
                  <Ionicons name={c.icon} size={15} color={colors.brand} />
                </View>
                <View style={styles.channelText}>
                  <ThemedText>{c.label}</ThemedText>
                  <ThemedText variant="subtle">{c.hint}</ThemedText>
                </View>
                <Switch
                  value={channels.has(c.value)}
                  onValueChange={(on) => toggleChannel(c.value, on)}
                  trackColor={{ true: colors.brand }}
                />
              </View>
            </View>
          ))}
        </Surface>
      </Section>

      <Button
        title="Create alert"
        onPress={handleSubmit}
        loading={createAlert.isPending}
        disabled={!hasValidTarget}
        style={styles.submit}
      />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText variant="label" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      <Surface style={styles.sectionCard}>{children}</Surface>
    </View>
  );
}

function Preset({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.preset, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
      <ThemedText style={{ color: colors.foregroundMuted, fontWeight: "600", fontSize: 12 }}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 22, paddingBottom: 40 },
  hero: { padding: 20, gap: 6, overflow: "hidden" },
  heroPrice: { fontSize: 30, fontWeight: "700" },
  section: { gap: 10 },
  sectionCard: { padding: 14, gap: 12 },
  sectionTitle: { fontSize: 11, letterSpacing: 0.8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { flexGrow: 1, flexBasis: "47%", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderRadius: radius.md, borderWidth: 1 },
  bigInput: { height: 56, fontSize: 18, fontWeight: "600" },
  pctRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dirToggle: { flexDirection: "row", borderRadius: radius.md, borderWidth: 1, padding: 3, gap: 3, height: 56 },
  dirSegment: { width: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  presets: { flexDirection: "row", gap: 8 },
  preset: { paddingHorizontal: 14, height: 32, borderRadius: radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  channelCard: { padding: 0, overflow: "hidden" },
  channelRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  channelIcon: { width: 32, height: 32, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  channelText: { flex: 1, gap: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  submit: { marginTop: 4, height: 54 },
});
