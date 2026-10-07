import { View, Pressable, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/themed-text";
import { CARD_FONTS, CARD_PACKS, CARD_PACK_ORDER, CARD_THEMES, packOf, randomStyleFrom, type CardStyle } from "@/lib/card-layout";
import { useTheme } from "@/lib/use-theme";
import { withAlpha } from "@/lib/color";
import { haptics } from "@/lib/haptics";

/**
 * One tile per card family. Tapping a family shows its cover style (the one on the tile); tapping
 * the selected family again shuffles to a different one.
 */
export function CardStylePicker({ value, onChange }: { value: CardStyle; onChange: (style: CardStyle) => void }) {
  const { colors } = useTheme();
  const activePack = packOf(value);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {CARD_PACK_ORDER.map((packId) => {
        const pack = CARD_PACKS[packId];
        const active = packId === activePack;
        const preview = CARD_THEMES[active ? value : pack.styles[0]];
        const canShuffle = pack.styles.length > 1;
        return (
          <Pressable
            key={packId}
            onPress={() => {
              haptics.selection();
              onChange(active ? randomStyleFrom(packId, value) : pack.styles[0]);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${pack.label} cards${canShuffle ? `, ${pack.styles.length} styles - tap again to shuffle` : ""}`}
            style={styles.item}
          >
            <View style={[styles.tile, { borderColor: active ? colors.brand : colors.glassBorder, borderWidth: active ? 2 : 1 }]}>
              {preview.background ? (
                <Image source={preview.background} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <LinearGradient colors={[...preview.fallback]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              )}
              <ThemedText allowFontScaling={false} style={[styles.sample, { color: preview.profit, fontFamily: CARD_FONTS.display }]}>
                +%
              </ThemedText>
              {canShuffle && (
                <View style={[styles.badge, { backgroundColor: active ? colors.brand : withAlpha("#000000", 0.55) }]}>
                  <Ionicons name="shuffle" size={10} color="#FFFFFF" />
                  <ThemedText allowFontScaling={false} style={styles.badgeText}>
                    {pack.styles.length}
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText style={[styles.label, { color: active ? colors.foreground : colors.foregroundMuted }]} numberOfLines={1}>
              {pack.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingRight: 8 },
  item: { alignItems: "center", gap: 6, width: 64 },
  tile: { width: 64, height: 80, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "flex-end", paddingBottom: 8 },
  sample: { fontSize: 18 },
  badge: { position: "absolute", top: 4, right: 4, flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 4, height: 16, borderRadius: 8 },
  badgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  label: { fontSize: 11, fontWeight: "600" },
});
