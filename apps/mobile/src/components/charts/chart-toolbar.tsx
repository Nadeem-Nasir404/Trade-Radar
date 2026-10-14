import { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, Modal, ScrollView, Alert } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { GlassPressable } from "@/components/ui/glass-pressable";
import { PressableScale } from "@/components/ui/pressable-scale";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { haptics } from "@/lib/haptics";
import { CANDLE_PALETTES, useChartSettings, type CandlePalette } from "@/lib/stores/chart-settings-store";
import type { DrawTool } from "./trading-chart";

const TOOLS: { value: DrawTool; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "trend", label: "Trend line", icon: "trending-up-outline" },
  { value: "horizontal", label: "Horizontal line", icon: "remove-outline" },
  { value: "rect", label: "Zone", icon: "square-outline" },
];

interface ChartToolRailProps {
  drawMode: boolean;
  drawTool: DrawTool;
  /** The cursor: leave drawing mode and go back to panning/zooming the chart. */
  onSelectCursor: () => void;
  onSelectTool: (tool: DrawTool) => void;
  onUndo: () => void;
  onClear: () => void;
  /** Shown only where there is a bigger chart to open (not on the full-screen chart itself). */
  onFullscreen?: () => void;
}

/**
 * TradingView-style tool rail down the left edge of the chart: the cursor and every drawing tool
 * are always one tap away, instead of hidden behind a "Draw" button. Picking a tool starts
 * drawing with it; the cursor goes back to moving the chart. Shared by the market screen and the
 * full-screen chart.
 */
export function ChartToolRail({ drawMode, drawTool, onSelectCursor, onSelectTool, onUndo, onClear, onFullscreen }: ChartToolRailProps) {
  const { colors } = useTheme();
  const setSettings = useChartSettings((s) => s.set);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const confirmClear = () =>
    Alert.alert("Clear all drawings?", "Every line and zone on this chart will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: onClear },
    ]);

  return (
    <View style={[styles.rail, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
      <RailButton icon="navigate-outline" label="Cursor" active={!drawMode} onPress={onSelectCursor} />
      {TOOLS.map((t) => (
        <RailButton key={t.value} icon={t.icon} label={t.label} active={drawMode && drawTool === t.value} onPress={() => onSelectTool(t.value)} />
      ))}
      <View style={[styles.railDivider, { backgroundColor: colors.glassBorder }]} />
      <RailButton icon="arrow-undo-outline" label="Undo last drawing" onPress={onUndo} />
      <RailButton icon="trash-outline" label="Clear drawings" onPress={confirmClear} />
      <View style={styles.spacer} />
      <RailButton icon="options-outline" label="Chart settings" onPress={() => setSettingsOpen(true)} />
      {onFullscreen && <RailButton icon="expand-outline" label="Full screen" onPress={onFullscreen} />}
      <RailButton
        icon="chevron-back"
        label="Hide tools"
        onPress={() => {
          onSelectCursor();
          setSettings({ showTools: false });
        }}
      />

      <ChartSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

/** With the rail hidden, this small button over the chart's bottom-left corner brings it back. */
export function ShowToolsButton() {
  const { colors } = useTheme();
  const setSettings = useChartSettings((s) => s.set);
  return (
    <PressableScale
      onPress={() => setSettings({ showTools: true })}
      accessibilityRole="button"
      accessibilityLabel="Show drawing tools"
      hitSlop={6}
      style={[styles.showTools, { backgroundColor: colors.backgroundElevated, borderColor: colors.glassBorder }]}
    >
      <Ionicons name="brush-outline" size={16} color={colors.brand} />
    </PressableScale>
  );
}

function RailButton({ icon, label, active = false, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={4}
      style={[styles.railButton, active && { backgroundColor: colors.brandGlow, borderColor: colors.brand }]}
    >
      <Ionicons name={icon} size={17} color={active ? colors.brand : colors.foregroundMuted} />
    </PressableScale>
  );
}

function ChartSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const s = useChartSettings();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Surface style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
        <View style={[styles.sheetHandle, { backgroundColor: colors.glassBorderStrong }]} />
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
  // 0..1 drives both the knob's slide and the track's colour crossfade, so the whole switch
  // settles together instead of the colour snapping instantly while the knob is mid-slide.
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, { damping: 16, stiffness: 320 });
  }, [value, progress]);

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * 16 }] }));
  const onTintStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Pressable
      onPress={() => {
        haptics.selection();
        onChange(!value);
      }}
      style={styles.toggleRow}
    >
      <ThemedText>{label}</ThemedText>
      <View style={[styles.toggleTrack, { backgroundColor: colors.glassHover }]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.toggleTrackFill, { backgroundColor: colors.brand }, onTintStyle]} />
        <Animated.View style={[styles.toggleKnob, knobStyle]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { width: 40, paddingVertical: 4, alignItems: "center", gap: 2, borderRadius: radius.md, borderWidth: 1 },
  railButton: { width: 32, height: 32, borderRadius: radius.sm, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  railDivider: { width: 22, height: StyleSheet.hairlineWidth, marginVertical: 2 },
  spacer: { flex: 1, minHeight: 4 },
  // Bottom-left, clear of the OHLC readout at the top and the time axis along the bottom edge.
  showTools: {
    position: "absolute", left: 6, bottom: 34, width: 34, height: 34, borderRadius: radius.full, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderRadius: 0, paddingBottom: 32, maxHeight: "72%" },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginTop: 10 },
  sheetTitle: { paddingHorizontal: 20, paddingTop: 14 },
  sheetBody: { padding: 20, gap: 14 },
  group: { marginTop: 6, fontSize: 11, letterSpacing: 0.8 },
  paletteGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  palette: { flex: 1, height: 76, borderRadius: radius.lg, flexDirection: "column", gap: 6 },
  swatches: { flexDirection: "row", gap: 4 },
  swatch: { width: 14, height: 22, borderRadius: 3 },
  paletteName: { fontSize: 12, fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  toggleTrack: { width: 40, height: 24, borderRadius: 12, padding: 4, justifyContent: "center", overflow: "hidden" },
  toggleTrackFill: { borderRadius: 12 },
  toggleKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#ffffff", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
});
