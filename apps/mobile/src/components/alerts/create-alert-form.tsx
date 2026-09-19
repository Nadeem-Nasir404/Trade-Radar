import { useState } from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  { value: "PCT_CHANGE", label: "% Change", icon: "pulse" },
  { value: "ENTERS_RANGE", label: "Enters range", icon: "swap-horizontal", needsSecondary: true },
  { value: "EXITS_RANGE", label: "Exits range", icon: "swap-horizontal", needsSecondary: true },
];

const CHANNELS: { value: NotificationChannelType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "EXPO_PUSH", label: "Push", icon: "notifications-outline" },
  { value: "EMAIL", label: "Email", icon: "mail-outline" },
  { value: "TELEGRAM", label: "Telegram", icon: "paper-plane-outline" },
  { value: "DISCORD", label: "Discord", icon: "logo-discord" },
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

  const toggleChannel = (value: NotificationChannelType) => {
    haptics.selection();
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!targetValue) return;
    const resolvedTarget = isPct ? Math.abs(Number(targetValue)) * (pctDirection === "down" ? -1 : 1) : Number(targetValue);
    await createAlert.mutateAsync({
      instrumentId,
      conditionType,
      targetValue: resolvedTarget,
      secondaryValue: selected.needsSecondary && secondaryValue ? Number(secondaryValue) : undefined,
      channels: CHANNELS.map((c) => ({ channelType: c.value, isEnabled: channels.has(c.value) })),
      notes: note.trim() || undefined,
    });
    haptics.success();
    const targetLabel = isPct ? `${pctDirection === "down" ? "-" : "+"}${Math.abs(Number(targetValue))}%` : targetValue;
    showToast("Alert created", `${symbol} will notify you when it ${selected.label.toLowerCase()} ${targetLabel}`, "success");
    onSuccess?.();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Surface style={styles.headerCard}>
        <ThemedText variant="muted">{symbol}</ThemedText>
        {currentPrice !== undefined && currentPrice !== null && (
          <ThemedText variant="title" style={styles.price}>
            {formatCompactPrice(currentPrice)}
          </ThemedText>
        )}
      </Surface>

      <Surface style={styles.card}>
        <ThemedText variant="label" style={styles.sectionLabel}>
          Condition
        </ThemedText>
        <View style={styles.chipGrid}>
          {CONDITION_OPTIONS.map((opt) => {
            const active = opt.value === conditionType;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  haptics.selection();
                  setConditionType(opt.value);
                }}
                style={[
                  styles.chip,
                  { borderColor: colors.glassBorder, backgroundColor: colors.glass },
                  active && { borderColor: colors.brand, backgroundColor: colors.brandGlow },
                ]}
              >
                <Ionicons name={opt.icon} size={14} color={active ? colors.brand : colors.foregroundMuted} />
                <ThemedText style={[styles.chipText, { color: colors.foregroundMuted }, active && { color: colors.foreground }]}>
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {isPct ? (
          <View style={styles.row}>
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
                    <Ionicons
                      name={dir === "up" ? "arrow-up" : "arrow-down"}
                      size={16}
                      color={active ? colors.brandForeground : colors.foregroundMuted}
                    />
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.field}>
              <ThemedText variant="label">Change %</ThemedText>
              <Input value={targetValue} onChangeText={setTargetValue} keyboardType="decimal-pad" placeholder="5" />
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <View style={styles.field}>
              <ThemedText variant="label">{selected.needsSecondary ? "Lower bound" : "Price"}</ThemedText>
              <Input value={targetValue} onChangeText={setTargetValue} keyboardType="decimal-pad" />
            </View>
            {selected.needsSecondary && (
              <View style={styles.field}>
                <ThemedText variant="label">Upper bound</ThemedText>
                <Input value={secondaryValue} onChangeText={setSecondaryValue} keyboardType="decimal-pad" />
              </View>
            )}
          </View>
        )}
      </Surface>

      <Surface style={styles.card}>
        <ThemedText variant="label" style={styles.sectionLabel}>
          Note <ThemedText variant="subtle">(optional)</ThemedText>
        </ThemedText>
        <Input value={note} onChangeText={setNote} placeholder="e.g. Add to swing trade watchlist" maxLength={140} />
      </Surface>

      <Surface style={styles.card}>
        <ThemedText variant="label" style={styles.sectionLabel}>
          Notify me via
        </ThemedText>
        <View style={styles.chipGrid}>
          {CHANNELS.map((c) => {
            const active = channels.has(c.value);
            return (
              <Pressable
                key={c.value}
                onPress={() => toggleChannel(c.value)}
                style={[
                  styles.chip,
                  { borderColor: colors.glassBorder, backgroundColor: colors.glass },
                  active && { borderColor: colors.brand, backgroundColor: colors.brandGlow },
                ]}
              >
                <Ionicons name={c.icon} size={14} color={active ? colors.brand : colors.foregroundMuted} />
                <ThemedText style={[styles.chipText, { color: colors.foregroundMuted }, active && { color: colors.foreground }]}>
                  {c.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </Surface>

      <Button title="Create Alert" onPress={handleSubmit} loading={createAlert.isPending} disabled={!targetValue} style={styles.submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  headerCard: { padding: 16 },
  card: { padding: 16 },
  price: { marginTop: 2 },
  sectionLabel: { marginBottom: 10 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  row: { flexDirection: "row", gap: 12, marginTop: 14 },
  field: { flex: 1, gap: 6 },
  dirToggle: { flexDirection: "row", borderRadius: radius.md, borderWidth: 1, padding: 3, gap: 3, height: 48 },
  dirSegment: { width: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  submit: { marginTop: 4 },
});
