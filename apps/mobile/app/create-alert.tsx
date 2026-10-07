import { useState } from "react";
import { View, FlatList, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { ModalHeader } from "@/components/ui/modal-header";
import { Input } from "@/components/ui/input";
import { CoinLogo } from "@/components/coin-logo";
import { CreateAlertForm } from "@/components/alerts/create-alert-form";
import { useMarkets } from "@/lib/api/hooks/use-markets";
import { formatCompactPrice, formatPct } from "@/lib/format";
import { useTheme } from "@/lib/use-theme";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { radius } from "@/lib/theme";
import type { Instrument } from "@/lib/api/types";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";

export default function CreateAlertScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ instrumentId?: string; symbol?: string; price?: string }>();
  const [selected] = useState<{ id: string; symbol: string; price: number | null } | null>(
    params.instrumentId ? { id: params.instrumentId, symbol: params.symbol ?? "", price: params.price ? Number(params.price) : null } : null,
  );
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim());
  const { data: markets, isLoading } = useMarkets(
    { search: debounced || undefined, limit: debounced ? 50 : 100 },
    { enabled: !selected },
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <AmbientOrbs />
      <ModalHeader kind="close" title={selected ? "Set your level" : "Choose a market"} />

      {!selected ? (
        <View style={styles.flex}>
          <Surface style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.foregroundSubtle} />
            <Input value={search} onChangeText={setSearch} placeholder="Search BTC, Bitcoin, gold…" autoFocus style={styles.searchInput} />
          </Surface>
          <FlatList
            data={markets ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.glassBorder }]} />}
            renderItem={({ item }: { item: Instrument }) => (
              <Pressable
                style={styles.marketRow}
                onPress={() => router.replace({ pathname: "/(tabs)/markets/[symbol]", params: { symbol: item.symbol } })}
              >
                <CoinLogo uri={item.iconUrl} symbol={item.displaySymbol} size={36} />
                <View style={styles.marketName}>
                  <ThemedText style={styles.marketSymbol}>{item.displaySymbol}</ThemedText>
                  <ThemedText variant="subtle" numberOfLines={1}>
                    {item.name ?? item.provider}
                  </ThemedText>
                </View>
                <View style={styles.marketRight}>
                  <ThemedText variant="mono" style={styles.marketPrice}>
                    {formatCompactPrice(item.price)}
                  </ThemedText>
                  <ThemedText variant="subtle" style={{ color: (item.changePct24h ?? 0) >= 0 ? colors.positive : colors.negative }}>
                    {formatPct(item.changePct24h)}
                  </ThemedText>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={!isLoading ? <ThemedText variant="muted" style={styles.empty}>No markets found</ThemedText> : null}
          />
        </View>
      ) : (
        <CreateAlertForm
          instrumentId={selected.id}
          symbol={selected.symbol}
          currentPrice={selected.price}
          defaultTargetValue={selected.price ?? undefined}
          onSuccess={() => router.back()}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 14, height: 50, borderRadius: radius.lg },
  searchInput: { flex: 1, height: 46, borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
  marketRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
  marketName: { flex: 1, minWidth: 0, gap: 2 },
  marketSymbol: { fontSize: 15, fontWeight: "600" },
  marketRight: { alignItems: "flex-end", gap: 2 },
  marketPrice: { fontSize: 14, fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 40 },
});
