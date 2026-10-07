import { useState } from "react";
import { View, Pressable, StyleSheet, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { GlassPressable } from "@/components/ui/glass-pressable";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { CANDLE_PALETTES, useChartSettings, type CandlePalette } from "@/lib/stores/chart-settings-store";
import type { DrawTool } from "./trading-chart";

const TOOLS: { value: DrawTool; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "trend", label: "Trend", icon: "analytics-outline" },
  { value: "horizontal", label: "Level", icon: "remove-outline" },
  { value: "rect", label: "Zone", icon: "scan-outline" },
];

interface ChartToolbarProps {
  drawMode: boolean;
  drawTool: DrawTool;
  onToggleDraw: () => void;
  onSelectTool: (tool: DrawTool) => void;
  onClear: () => void;
  trailing?: React.ReactNode;
}

/** Draw tools, clear, and chart settings - one bar shared by the market screen and full-screen chart. */
export function ChartToolbar({ drawMode, drawTool, onToggleDraw, onSelectTool, onClear, trailing }: ChartToolbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pill active={drawMode} onPress={onToggleDraw} icon="pencil-outline" label={drawMode ? "Drawing" : "Draw"} />
        {drawMode &&
          TOOLS.map((t) => (
            <Pill
              key={t.value}
              active={drawTool === t.value}
              onPress={() => {
                haptics.selection();
                onSelectTool(t.value);
              }}
              icon={t.icon}
              label={t.label}
            />
          ))}
        {drawMode && <Pill active={false} onPress={onClear} icon="trash-outline" label="Clear" />}
        <View style={styles.spacer} />
        {trailing}
        <GlassPressable
          hitSlop={8}
          onPress={() => {
            haptics.light();
            setSettingsOpen(true);
          }}
          style={styles.iconPill}
        >
          <Ionicons name="options-outline" size={16} />
        </GlassPressable>
      </View>

      <ChartSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

function Pill({ active, onPress, icon, label }: { active: boolean; onPress: () => void; icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { colors } = useTheme();
  const tint = active ? colors.brand : colors.foregroundMuted;
  return (
    <GlassPressable active={active} onPress={onPress} style={styles.pill}>
      <Ionicons name={icon} size={14} color={tint} />
      <ThemedText style={[styles.pillText, { color: active ? colors.brand : colors.foreground }]}>{label}</ThemedText>
    </GlassPressable>
  );
}

function ChartSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const s = useChartSettings();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Surface style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
        <View style={styles.sheetHandle} />
        <ThemedText variant="subtitle" style={styles.sheetTitle}>
          Chart settings
        </ThemedText>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
          <ThemedText variant="label" style={styles.group}>CANDLE COLORS</ThemedText>
          <View style={styles.paletteGrid}>
            {(Object.keys(CANDLE_PALETTES) as CandlePalette[]).map((key) => {
              const p = CANDLE_PALETTES[key];
              const active = s.palette === key;
              return (
                <GlassPressable
                  key={key}
                  active={active}
                  vertical
                  onPress={() => {
                    haptics.selection();
                    s.set({ palette: key });
                  }}
                  style={styles.palette}
                >
                  <View style={styles.swatches}>
                    <View style={[styles.swatch, { backgroundColor: p.up }]} />
                    <View style={[styles.swatch, { backgroundColor: p.down }]} />
                  </View>
                  <ThemedText style={[styles.paletteName, active && { color: colors.brand }]}>{p.label}</ThemedText>
                </GlassPressable>
              );
            })}
          </View>

          <ThemedText variant="label" style={styles.group}>DISPLAY</ThemedText>
          <Toggle label="Grid lines" value={s.showGrid} onChange={(v) => s.set({ showGrid: v })} />
          <Toggle label="Volume" value={s.showVolume} onChange={(v) => s.set({ showVolume: v })} />
          <Toggle label="Wicks" value={s.showWicks} onChange={(v) => s.set({ showWicks: v })} />
        </ScrollView>
      </Surface>
    </Modal>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
      <ThemedText>{label}</ThemedText>
      <View style={[styles.toggleTrack, { backgroundColor: value ? colors.brand : colors.glassHover }]}>
        <View style={[styles.toggleKnob, { transform: [{ translateX: value ? 16 : 0 }] }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  spacer: { flex: 1, minWidth: 4 },
  pill: { flexDirection: "row", height: 32, paddingHorizontal: 12, borderRadius: radius.full },
  pillText: { fontSize: 12, fontWeight: "600" },
  iconPill: { width: 32, height: 32, borderRadius: radius.full },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderRadius: 0, paddingBottom: 32, maxHeight: "72%" },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", marginTop: 10 },
  sheetTitle: { paddingHorizontal: 20, paddingTop: 14 },
  sheetBody: { padding: 20, gap: 14 },
  group: { marginTop: 6, fontSize: 11, letterSpacing: 0.8 },
  paletteGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  palette: { flex: 1, height: 76, borderRadius: radius.lg, flexDirection: "column", gap: 6 },
  swatches: { flexDirection: "row", gap: 4 },
  swatch: { width: 14, height: 22, borderRadius: 3 },
  paletteName: { fontSize: 12, fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  toggleTrack: { width: 40, height: 24, borderRadius: 12, padding: 4, justifyContent: "center" },
  toggleKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#ffffff" },
});
