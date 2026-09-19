import { useState } from "react";
import { View, FlatList, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { Input } from "@/components/ui/input";
import { CoinLogo } from "@/components/coin-logo";
import { CreateAlertForm } from "@/components/alerts/create-alert-form";
import { useMarkets } from "@/lib/api/hooks/use-markets";
import { formatCompactPrice, formatPct } from "@/lib/format";
import { useTheme } from "@/lib/use-theme";
import type { Instrument } from "@/lib/api/types";

export default function CreateAlertScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ instrumentId?: string; symbol?: string; price?: string }>();
  const [selected, setSelected] = useState<{ id: string; symbol: string; price: number | null } | null>(
    params.instrumentId ? { id: params.instrumentId, symbol: params.symbol ?? "", price: params.price ? Number(params.price) : null } : null,
  );
  const [search, setSearch] = useState("");
  const { data: markets, isLoading } = useMarkets({ search: search || undefined, limit: search ? 50 : 250 });

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <View style={[styles.header, { borderBottomColor: colors.glassBorder }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </Pressable>
        <ThemedText variant="subtitle">Create Alert</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {!selected ? (
        <View style={styles.flex}>
          <View style={styles.searchWrap}>
            <Input value={search} onChangeText={setSearch} placeholder="Search BTC, Bitcoin, XAU..." autoFocus />
          </View>
          <FlatList
            data={markets ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }: { item: Instrument }) => (
              <Pressable
                style={[styles.marketRow, { borderBottomColor: colors.glassBorder }]}
                onPress={() => setSelected({ id: item.id, symbol: item.displaySymbol, price: item.price })}
              >
                <View style={styles.marketLeft}>
                  <CoinLogo uri={item.iconUrl} symbol={item.displaySymbol} size={24} />
                  <ThemedText>{item.displaySymbol}</ThemedText>
                </View>
                <View style={styles.marketRight}>
                  <ThemedText variant="mono">{formatCompactPrice(item.price)}</ThemedText>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchWrap: { padding: 16 },
  list: { paddingHorizontal: 16, gap: 4 },
  marketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  marketLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  marketRight: { alignItems: "flex-end", gap: 2 },
  empty: { textAlign: "center", marginTop: 40 },
});
