import { View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { PriceText } from "@/components/ui/price-text";
import { Badge } from "@/components/ui/badge";
import { CoinLogo } from "@/components/coin-logo";
import { formatPct } from "@/lib/format";
import { useTheme } from "@/lib/use-theme";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { useIsFavorite, useToggleFavorite } from "@/lib/api/hooks/use-watchlists";
import { haptics } from "@/lib/haptics";
import type { Instrument } from "@/lib/api/types";

// Flat row - the enclosing Surface panel (see markets/index.tsx) supplies the "Level 1" glass
// boundary and FlatList's ItemSeparatorComponent supplies the dividers, so this stays plain.
export function MarketRow({ instrument }: { instrument: Instrument }) {
  const { colors } = useTheme();
  const live = useLivePrice(instrument.id, { price: instrument.price, changePct24h: instrument.changePct24h });
  const price = live.price ?? instrument.price;
  const changePct = live.changePct24h ?? instrument.changePct24h;
  const positive = (changePct ?? 0) >= 0;

  const isFavorite = useIsFavorite(instrument.id);
  const toggleFavorite = useToggleFavorite();

  return (
    <PressableScale onPress={() => router.push({ pathname: "/(tabs)/markets/[symbol]", params: { symbol: instrument.symbol } })}>
      <View style={styles.row}>
        <View style={styles.left}>
          <CoinLogo uri={instrument.iconUrl} symbol={instrument.displaySymbol} />
          <View style={styles.nameCol}>
            <ThemedText numberOfLines={1} style={styles.symbol}>
              {instrument.displaySymbol}
              {instrument.isDemo && <ThemedText variant="subtle"> · Demo</ThemedText>}
            </ThemedText>
            <ThemedText variant="subtle" numberOfLines={1}>
              {instrument.provider}
              {instrument.exchange ? ` · ${instrument.exchange}` : ""}
            </ThemedText>
          </View>
        </View>
        <View style={styles.right}>
          <PriceText value={price} />
          <Badge label={formatPct(changePct)} variant={positive ? "positive" : "negative"} />
        </View>
        <Pressable
          hitSlop={10}
          style={styles.favoriteButton}
          onPress={() => {
            haptics.light();
            toggleFavorite.mutate(instrument.id);
          }}
        >
          <Ionicons name={isFavorite ? "star" : "star-outline"} size={17} color={isFavorite ? colors.warning : colors.foregroundSubtle} />
        </Pressable>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 8,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  nameCol: { flexShrink: 1, gap: 2 },
  symbol: { fontWeight: "600", fontSize: 15 },
  right: { alignItems: "flex-end", gap: 4 },
  favoriteButton: { paddingLeft: 2, paddingVertical: 4 },
});
