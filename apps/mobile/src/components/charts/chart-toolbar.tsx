import { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, Modal, ScrollView, Alert, TextInput } from "react-native";
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
import { DRAWING_TOOLS, DRAW_TOOL_CATEGORIES, toolInfo, type DrawTool, type DrawToolCategory } from "./drawing-tools";
import { ToolIcon } from "./tool-icon";

interface ChartToolbarProps {
  drawMode: boolean;
  drawTool: DrawTool;
  /** Pick a tool and start drawing with it. */
  onSelectTool: (tool: DrawTool) => void;
  /** Stop drawing and go back to moving the chart. */
  onCancelDraw: () => void;
  onUndo: () => void;
  onClear: () => void;
  /** Shown only where there is a bigger chart to open (not on the full-screen chart itself). */
  onFullscreen?: () => void;
}

/**
 * TradingView-style bar under the chart: the pencil opens the full Drawings panel, the starred
 * favourites sit right on the bar for one-tap access, then undo, clear, settings and full screen.
 * While a tool is active, a strip above the bar says what to do and lets you cancel.
 */
export function ChartToolbar({ drawMode, drawTool, onSelectTool, onCancelDraw, onUndo, onClear, onFullscreen }: ChartToolbarProps) {
  const { colors } = useTheme();
  const favorites = useChartSettings((s) => s.favoriteTools);
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const confirmClear = () =>
    Alert.alert("Clear all drawings?", "Every drawing on this chart will be removed.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: onClear },
    ]);

  return (
    <View style={styles.wrap}>
      {drawMode && (
        <View style={[styles.activeStrip, { backgroundColor: colors.brandGlow, borderColor: colors.brand }]}>
          <ToolIcon tool={drawTool} color={colors.brand} size={18} />
          <View style={styles.flex}>
            <ThemedText style={[styles.activeTitle, { color: colors.brand }]}>{toolInfo(drawTool).label}</ThemedText>
            <ThemedText variant="subtle" style={styles.activeHint} numberOfLines={1}>
              {toolInfo(drawTool).hint}
            </ThemedText>
          </View>
          <PressableScale onPress={onCancelDraw} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel drawing" style={styles.cancel}>
            <Ionicons name="close" size={18} color={colors.foreground} />
          </PressableScale>
        </View>
      )}

      <View style={[styles.bar, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
        <BarButton label="Drawings" active={panelOpen} onPress={() => setPanelOpen(true)}>
          <Ionicons name="pencil-outline" size={19} color={colors.foreground} />
        </BarButton>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favorites} style={styles.flex}>
          {favorites.map((tool) => {
            const active = drawMode && drawTool === tool;
            return (
              <BarButton key={tool} label={toolInfo(tool).label} active={active} onPress={() => (active ? onCancelDraw() : onSelectTool(tool))}>
                <ToolIcon tool={tool} color={active ? colors.brand : colors.foreground} size={22} />
              </BarButton>
            );
          })}
        </ScrollView>
        <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />
        <BarButton label="Undo last drawing" onPress={onUndo}>
          <Ionicons name="arrow-undo-outline" size={19} color={colors.foreground} />
        </BarButton>
        <BarButton label="Clear drawings" onPress={confirmClear}>
          <Ionicons name="trash-outline" size={18} color={colors.foreground} />
        </BarButton>
        <BarButton label="Chart settings" onPress={() => setSettingsOpen(true)}>
          <Ionicons name="options-outline" size={19} color={colors.foreground} />
        </BarButton>
        {onFullscreen && (
          <BarButton label="Full screen" onPress={onFullscreen}>
            <Ionicons name="expand-outline" size={18} color={colors.foreground} />
          </BarButton>
        )}
      </View>

      <DrawingsSheet
        visible={panelOpen}
        onClose={() => setPanelOpen(false)}
        onPick={(tool) => {
          setPanelOpen(false);
          onSelectTool(tool);
        }}
      />
      <ChartSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

function BarButton({ label, active = false, onPress, children }: { label: string; active?: boolean; onPress: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={4}
      style={[styles.barButton, active && { backgroundColor: colors.brandGlow }]}
    >
      {children}
    </PressableScale>
  );
}

type PanelTab = "favorites" | DrawToolCategory;

/**
 * The Drawings panel, laid out like TradingView's: search, category tabs, and a grid of tool
 * tiles. The star on a tile adds or removes it from the favourites shown on the chart's bar.
 */
function DrawingsSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (tool: DrawTool) => void }) {
  const { colors } = useTheme();
  const favorites = useChartSettings((s) => s.favoriteTools);
  const setSettings = useChartSettings((s) => s.set);
  const [tab, setTab] = useState<PanelTab>("favorites");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const tools = q
    ? DRAWING_TOOLS.filter((t) => t.label.toLowerCase().includes(q))
    : tab === "favorites"
      ? DRAWING_TOOLS.filter((t) => favorites.includes(t.value))
      : DRAWING_TOOLS.filter((t) => t.category === tab);

  const toggleFavorite = (tool: DrawTool) => {
    haptics.selection();
    setSettings({ favoriteTools: favorites.includes(tool) ? favorites.filter((f) => f !== tool) : [...favorites, tool] });
  };

  const tabs: { value: PanelTab; label: string }[] = [{ value: "favorites", label: "Favorites" }, ...DRAW_TOOL_CATEGORIES];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.panel, { backgroundColor: colors.backgroundElevated }]}>
        <View style={[styles.sheetHandle, { backgroundColor: colors.glassBorderStrong }]} />
        <ThemedText variant="title" style={styles.panelTitle}>
          Drawings
        </ThemedText>

        <View style={[styles.search, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <Ionicons name="search" size={18} color={colors.foregroundMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={colors.foregroundMuted}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>

        {!q && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabsScroll}>
            {tabs.map((t) => {
              const active = t.value === tab;
              return (
                <PressableScale key={t.value} onPress={() => setTab(t.value)} style={[styles.tab, active && { backgroundColor: colors.glassHover }]}>
                  <ThemedText style={{ color: active ? colors.foreground : colors.foregroundMuted, fontWeight: "600" }}>{t.label}</ThemedText>
                </PressableScale>
              );
            })}
          </ScrollView>
        )}

        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {tools.length === 0 ? (
            <ThemedText variant="subtle" style={styles.empty}>
              {q ? "No tool matches your search." : "Star a tool in another tab to keep it here and on the chart."}
            </ThemedText>
          ) : (
            tools.map((t) => {
              const fav = favorites.includes(t.value);
              return (
                <PressableScale
                  key={t.value}
                  onPress={() => onPick(t.value)}
                  style={[styles.tile, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}
                >
                  <Pressable
                    onPress={() => toggleFavorite(t.value)}
                    hitSlop={10}
                    style={styles.star}
                    accessibilityLabel={fav ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Ionicons name={fav ? "star" : "star-outline"} size={15} color={fav ? "#F59E0B" : colors.foregroundSubtle} />
                  </Pressable>
                  <ToolIcon tool={t.value} color={colors.foreground} size={28} />
                  <ThemedText style={styles.tileLabel} numberOfLines={1}>
                    {t.label}
                  </ThemedText>
                </PressableScale>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
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
  flex: { flex: 1 },
  wrap: { gap: 8, marginTop: 10 },
  bar: { flexDirection: "row", alignItems: "center", height: 48, paddingHorizontal: 4, borderRadius: radius.lg, borderWidth: 1 },
  barButton: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  favorites: { alignItems: "center", gap: 2, paddingHorizontal: 2 },
  divider: { width: StyleSheet.hairlineWidth, height: 24, marginHorizontal: 4 },
  activeStrip: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 12, paddingRight: 6, height: 46, borderRadius: radius.lg, borderWidth: 1 },
  activeTitle: { fontSize: 13, fontWeight: "700" },
  activeHint: { fontSize: 11 },
  cancel: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.full },
  panel: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 28, maxHeight: "78%" },
  panelTitle: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, height: 44, paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  tabsScroll: { flexGrow: 0, marginTop: 12 },
  tabs: { gap: 6, paddingHorizontal: 20 },
  tab: { height: 36, paddingHorizontal: 14, borderRadius: radius.md, justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 20 },
  tile: { width: "31%", height: 92, borderRadius: radius.lg, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 6 },
  tileLabel: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  star: { position: "absolute", top: 6, right: 6 },
  empty: { paddingVertical: 24, textAlign: "center", width: "100%" },
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
