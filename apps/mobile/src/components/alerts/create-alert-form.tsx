import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/themed-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PressableScale } from "@/components/ui/pressable-scale";
import { useCreateAlert } from "@/lib/api/hooks/use-alerts";
import { formatCompactPrice } from "@/lib/format";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { useToastStore } from "@/lib/stores/toast-store";
import { haptics } from "@/lib/haptics";
import {
  MAX_ALERT_REMINDERS,
  REPEAT_INTERVAL_MINUTES,
  REPEATABLE_CONDITIONS,
  type ConditionType,
  type NotificationChannelType,
  type RepeatIntervalMinutes,
} from "@levelpulse/shared-types";

const CONDITION_OPTIONS: { value: ConditionType; label: string; phrase: string; icon: keyof typeof Ionicons.glyphMap; needsSecondary?: boolean }[] = [
  { value: "CROSSES_ABOVE", label: "Crosses above", phrase: "crosses above", icon: "arrow-up" },
  { value: "CROSSES_BELOW", label: "Crosses below", phrase: "crosses below", icon: "arrow-down" },
  { value: "ABOVE", label: "Above", phrase: "is above", icon: "trending-up" },
  { value: "BELOW", label: "Below", phrase: "is below", icon: "trending-down" },
  { value: "EQUALS", label: "Exactly", phrase: "hits", icon: "remove" },
  { value: "PCT_CHANGE", label: "% change", phrase: "moves", icon: "pulse" },
  { value: "PCT_CHANGE_WINDOW", label: "% in window", phrase: "moves", icon: "timer-outline" },
  { value: "ENTERS_RANGE", label: "Enters range", phrase: "enters", icon: "enter-outline", needsSecondary: true },
  { value: "EXITS_RANGE", label: "Exits range", phrase: "exits", icon: "exit-outline", needsSecondary: true },
];

// Same set the chart's own timeframe picker offers, minus the very short/very long ends - a 1m
// rolling window is mostly noise, and a 1w window rarely fires before the baseline just rolls over.
const WINDOW_OPTIONS = ["5m", "15m", "1h", "4h", "1d"] as const;

const CHANNELS: { value: NotificationChannelType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "EXPO_PUSH", label: "Push", icon: "notifications-outline" },
  { value: "EMAIL", label: "Email", icon: "mail-outline" },
  { value: "TELEGRAM", label: "Telegram", icon: "paper-plane-outline" },
  { value: "DISCORD", label: "Discord", icon: "logo-discord" },
];

function repeatLabel(minutes: RepeatIntervalMinutes): string {
  return minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`;
}

/**
 * Compact on purpose: every choice is a row of small chips under a one-line label, rather than a
 * card per section with full-height buttons, so the whole form fits about one screen.
 */
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
  const [windowTimeframe, setWindowTimeframe] = useState<(typeof WINDOW_OPTIONS)[number]>("1h");
  const [repeatEvery, setRepeatEvery] = useState<RepeatIntervalMinutes | null>(null);
  const [channels, setChannels] = useState<Set<NotificationChannelType>>(new Set(["EXPO_PUSH", "EMAIL"]));
  const [note, setNote] = useState("");
  const createAlert = useCreateAlert();
  const showToast = useToastStore((s) => s.show);

  const selected = CONDITION_OPTIONS.find((c) => c.value === conditionType)!;
  const isWindow = conditionType === "PCT_CHANGE_WINDOW";
  const isPct = conditionType === "PCT_CHANGE" || isWindow;
  // "Hits exactly" is a single touch and the window baseline resets itself, so neither can be "still true".
  const canRepeat = (REPEATABLE_CONDITIONS as readonly string[]).includes(conditionType);
  const numeric = Number(targetValue);
  const hasValidTarget = targetValue !== "" && Number.isFinite(numeric) && numeric > 0;

  const applyPreset = (kind: "current" | "+1" | "-1") => {
    if (!currentPrice) return;
    if (kind === "current") setTargetValue(String(currentPrice));
    else setTargetValue(String(Number((currentPrice * (kind === "+1" ? 1.01 : 0.99)).toPrecision(8))));
  };

  const toggleChannel = (value: NotificationChannelType) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
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
      timeframe: isWindow ? windowTimeframe : undefined,
      repeatIntervalMinutes: canRepeat ? repeatEvery : null,
      channels: CHANNELS.map((c) => ({ channelType: c.value, isEnabled: channels.has(c.value) })),
      notes: note.trim() || undefined,
    });
    haptics.success();
    const targetLabel = isPct
      ? `${pctDirection === "down" ? "-" : "+"}${Math.abs(numeric)}%${isWindow ? ` within ${windowTimeframe}` : ""}`
      : targetValue;
    const repeatNote = canRepeat && repeatEvery ? `, then every ${repeatLabel(repeatEvery)}` : "";
    showToast("Alert created", `${symbol} will notify you when it ${selected.phrase} ${targetLabel}${repeatNote}`, "success");
    onSuccess?.();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={[styles.priceBar, { backgroundColor: colors.brandGlow, borderColor: colors.glassBorder }]}>
        <ThemedText variant="subtle">{symbol}</ThemedText>
        <ThemedText variant="mono" style={styles.priceBarValue}>
          {currentPrice != null ? formatCompactPrice(currentPrice) : "--"}
        </ThemedText>
      </View>

      <Field label="When price">
        <ChipRow>
          {CONDITION_OPTIONS.map((opt) => (
            <Chip key={opt.value} active={opt.value === conditionType} icon={opt.icon} label={opt.label} onPress={() => setConditionType(opt.value)} />
          ))}
        </ChipRow>
      </Field>

      <Field label={isPct ? "By" : selected.needsSecondary ? "Range" : "Target price"}>
        {isPct ? (
          <View style={styles.inlineRow}>
            <Chip active={pctDirection === "up"} icon="arrow-up" tone={colors.positive} onPress={() => setPctDirection("up")} />
            <Chip active={pctDirection === "down"} icon="arrow-down" tone={colors.negative} onPress={() => setPctDirection("down")} />
            <Input value={targetValue} onChangeText={setTargetValue} keyboardType="decimal-pad" placeholder="5" style={[styles.input, styles.flex]} />
            <ThemedText variant="muted">%</ThemedText>
          </View>
        ) : (
          <View style={styles.inlineRow}>
            <Input
              value={targetValue}
              onChangeText={setTargetValue}
              keyboardType="decimal-pad"
              placeholder={selected.needsSecondary ? "Lower" : currentPrice ? String(currentPrice) : "0.00"}
              style={[styles.input, styles.flex]}
            />
            {selected.needsSecondary && (
              <Input value={secondaryValue} onChangeText={setSecondaryValue} keyboardType="decimal-pad" placeholder="Upper" style={[styles.input, styles.flex]} />
            )}
          </View>
        )}
        {!isPct && !selected.needsSecondary && currentPrice != null && (
          <View style={styles.chipsWrap}>
            <Chip small label="Current" onPress={() => applyPreset("current")} />
            <Chip small label="+1%" onPress={() => applyPreset("+1")} />
            <Chip small label="−1%" onPress={() => applyPreset("-1")} />
          </View>
        )}
        {isWindow && (
          <View style={styles.chipsWrap}>
            <ThemedText variant="subtle">within</ThemedText>
            {WINDOW_OPTIONS.map((tf) => (
              <Chip key={tf} small active={tf === windowTimeframe} label={tf} onPress={() => setWindowTimeframe(tf)} />
            ))}
          </View>
        )}
        {targetValue !== "" && !hasValidTarget && (
          <ThemedText style={{ color: colors.negative, fontSize: 12 }}>Enter a number greater than 0.</ThemedText>
        )}
      </Field>

      {canRepeat && (
        <Field label="Repeat reminder">
          <ChipRow>
            <Chip small active={repeatEvery === null} label="Off" onPress={() => setRepeatEvery(null)} />
            {REPEAT_INTERVAL_MINUTES.map((m) => (
              <Chip key={m} small active={repeatEvery === m} icon="repeat" label={repeatLabel(m)} onPress={() => setRepeatEvery(m)} />
            ))}
          </ChipRow>
          <ThemedText variant="subtle" style={styles.hint}>
            {repeatEvery
              ? `After it fires, reminds you every ${repeatLabel(repeatEvery)} while the price stays there, until you open the alert (up to ${MAX_ALERT_REMINDERS}).`
              : "Notifies you once when it fires."}
          </ThemedText>
        </Field>
      )}

      <Field label="Notify via">
        <View style={styles.chipsWrap}>
          {CHANNELS.map((c) => (
            <Chip key={c.value} active={channels.has(c.value)} icon={c.icon} label={c.label} onPress={() => toggleChannel(c.value)} />
          ))}
        </View>
        {(channels.has("TELEGRAM") || channels.has("DISCORD")) && (
          <ThemedText variant="subtle" style={styles.hint}>
            Telegram and Discord only deliver once connected in Profile.
          </ThemedText>
        )}
      </Field>

      <Input value={note} onChangeText={setNote} placeholder="Note (optional)" maxLength={140} style={styles.input} />

      <Button title="Create alert" onPress={handleSubmit} loading={createAlert.isPending} disabled={!hasValidTarget} />
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText variant="label" style={styles.fieldLabel}>
        {label.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

/** One horizontally scrolling line of chips, so a long list of options costs a single row of height. */
function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {children}
    </ScrollView>
  );
}

function Chip({
  label,
  icon,
  active = false,
  small = false,
  tone,
  onPress,
}: {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  small?: boolean;
  /** Fill colour when active (defaults to the brand tint). */
  tone?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const fill = active ? (tone ?? colors.brandGlow) : colors.glass;
  const ink = active ? (tone ? "#FFFFFF" : colors.brand) : colors.foregroundMuted;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        small && styles.chipSmall,
        !label && styles.chipIconOnly,
        { backgroundColor: fill, borderColor: active ? (tone ?? colors.brand) : colors.glassBorder },
      ]}
    >
      {icon && <Ionicons name={icon} size={small ? 12 : 14} color={ink} />}
      {label && <ThemedText style={[styles.chipText, small && styles.chipTextSmall, { color: active ? (tone ? "#FFFFFF" : colors.foreground) : colors.foregroundMuted }]}>{label}</ThemedText>}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 32 },
  flex: { flex: 1 },
  priceBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, height: 46, borderRadius: radius.lg, borderWidth: 1 },
  priceBarValue: { fontSize: 18, fontWeight: "700" },
  field: { gap: 8 },
  fieldLabel: { fontSize: 11, letterSpacing: 0.8 },
  hint: { fontSize: 12 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: { height: 46, fontSize: 16, fontWeight: "600" },
  chipRow: { gap: 6, paddingRight: 4 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1 },
  chipSmall: { height: 30, paddingHorizontal: 10 },
  chipIconOnly: { width: 46, height: 46, paddingHorizontal: 0, justifyContent: "center", borderRadius: radius.md },
  chipText: { fontSize: 13, fontWeight: "600" },
  chipTextSmall: { fontSize: 12 },
});
