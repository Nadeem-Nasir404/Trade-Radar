import { View, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/themed-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import { PriceText } from "@/components/ui/price-text";
import { CoinLogo } from "@/components/coin-logo";
import { formatPct } from "@/lib/format";
import { useTheme } from "@/lib/use-theme";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { useIsFavorite, useToggleFavorite } from "@/lib/api/hooks/use-watchlists";
import { haptics } from "@/lib/haptics";
import type { Instrument } from "@/lib/api/types";

/** Plain row: change shows as colored text, not a filled pill, so the list reads calm and scannable. */
export function MarketRow({ instrument, detail }: { instrument: Instrument; detail?: string }) {
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
        <CoinLogo uri={instrument.iconUrl} symbol={instrument.displaySymbol} size={36} />
        <View style={styles.nameCol}>
          <ThemedText numberOfLines={1} style={styles.symbol}>
            {instrument.displaySymbol}
          </ThemedText>
          <ThemedText variant="subtle" numberOfLines={1}>
            {detail ?? instrument.name ?? instrument.provider}
          </ThemedText>
        </View>
        <View style={styles.priceCol}>
          <PriceText value={price} style={styles.price} />
          <ThemedText style={[styles.change, { color: positive ? colors.positive : colors.negative }]}>{formatPct(changePct)}</ThemedText>
        </View>
        <Pressable
          hitSlop={12}
          style={styles.star}
          onPress={() => {
            haptics.light();
            toggleFavorite.mutate(instrument.id);
          }}
        >
          <Ionicons name={isFavorite ? "star" : "star-outline"} size={18} color={isFavorite ? colors.warning : colors.foregroundSubtle} />
        </Pressable>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  nameCol: { flex: 1, minWidth: 0, gap: 2 },
  symbol: { fontSize: 15, fontWeight: "600" },
  priceCol: { alignItems: "flex-end", gap: 2 },
  price: { fontSize: 15, fontWeight: "600" },
  change: { fontSize: 12, fontWeight: "600" },
  star: { paddingLeft: 4 },
});
