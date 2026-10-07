import { useState } from "react";
import { View, Pressable, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { ModalHeader } from "@/components/ui/modal-header";
import { Button } from "@/components/ui/button";
import { useTradesStore, type TradeSide } from "@/lib/stores/trades-store";
import { useToastStore } from "@/lib/stores/toast-store";
import { useTheme } from "@/lib/use-theme";
import { radius, fonts } from "@/lib/theme";
import { haptics } from "@/lib/haptics";

/** Parses a number typed by the user; empty or invalid input becomes null. */
function parseNumber(v: string): number | null {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

export default function NewTradeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const add = useTradesStore((s) => s.add);
  const showToast = useToastStore((s) => s.show);

  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<TradeSide>("LONG");
  const [entry, setEntry] = useState("");
  const [exit, setExit] = useState("");
  const [size, setSize] = useState("");

  const save = () => {
    const entryPrice = parseNumber(entry);
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return showToast("Add a symbol", "Example: BTC/USDT", "error");
    if (entryPrice == null) return showToast("Add an entry price", "It must be a number above 0", "error");

    const exitRaw = exit.trim();
    const exitPrice = exitRaw === "" ? null : parseNumber(exitRaw);
    if (exitRaw !== "" && exitPrice == null) return showToast("Exit price is invalid", "Leave it empty if the trade is still open", "error");

    try {
      add({ symbol: cleanSymbol, instrumentId: "", side, entryPrice, exitPrice, sizeUsd: parseNumber(size) });
      haptics.success();
      router.back();
    } catch (err) {
      console.error("[save trade]", err);
      showToast("Could not save the trade", (err as Error).message, "error");
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <AmbientOrbs />
      <ModalHeader title="New trade" kind="close" />

      {/* Keeps Save above the keyboard; the form stays phone-width on tablets. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.body, { width: Math.min(width, 560), alignSelf: "center" }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Surface style={styles.card}>
            <Field label="Symbol">
              <TextInput
                value={symbol}
                onChangeText={setSymbol}
                placeholder="BTC/USDT"
                placeholderTextColor={colors.foregroundMuted}
                autoCapitalize="characters"
                style={[styles.input, { color: colors.foreground, borderColor: colors.glassBorder }]}
              />
            </Field>

            <Field label="Direction">
              <View style={styles.sideRow}>
                {(["LONG", "SHORT"] as TradeSide[]).map((s) => {
                  const active = s === side;
                  const tone = s === "LONG" ? colors.positive : colors.negative;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => {
                        haptics.selection();
                        setSide(s);
                      }}
                      style={[styles.sideBtn, { borderColor: colors.glassBorder, backgroundColor: active ? tone : colors.glass }]}
                    >
                      <ThemedText style={{ color: active ? colors.brandForeground : colors.foregroundMuted, fontWeight: "700" }}>{s}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="Entry price">
              <NumberInput value={entry} onChange={setEntry} placeholder="e.g. 142.80" />
            </Field>

            <Field label="Exit price (leave empty if still open)">
              <NumberInput value={exit} onChange={setExit} placeholder="e.g. 179.43" />
            </Field>

            <Field label="Position size in $ (optional)">
              <NumberInput value={size} onChange={setSize} placeholder="e.g. 1000" prefix="$" />
            </Field>
          </Surface>

          <Button title="Save trade" onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText variant="label">{label}</ThemedText>
      {children}
    </View>
  );
}

function NumberInput({ value, onChange, placeholder, prefix }: { value: string; onChange: (v: string) => void; placeholder: string; prefix?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.numRow, { borderColor: colors.glassBorder }]}>
      {prefix ? <ThemedText style={{ color: colors.foregroundMuted, fontWeight: "700" }}>{prefix}</ThemedText> : null}
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, ""))}
        placeholder={placeholder}
        placeholderTextColor={colors.foregroundMuted}
        keyboardType="decimal-pad"
        style={[styles.numInput, { color: colors.foreground }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: 20, gap: 16, paddingBottom: 40 },
  card: { padding: 18, gap: 16 },
  field: { gap: 8 },
  input: { height: 50, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, fontSize: 16, fontFamily: fonts.bodySemibold },
  numRow: { flexDirection: "row", alignItems: "center", gap: 6, height: 50, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14 },
  numInput: { flex: 1, fontSize: 16, fontFamily: fonts.bodySemibold, padding: 0 },
  sideRow: { flexDirection: "row", gap: 10 },
  sideBtn: { flex: 1, height: 46, borderRadius: radius.lg, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
