import { useMemo, useState, useCallback } from "react";
import { View, FlatList, Pressable, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { FadeInItem } from "@/components/ui/fade-in-item";
import { SkeletonList } from "@/components/ui/skeleton";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { MarketRow } from "@/components/markets/market-row";
import { useMarkets } from "@/lib/api/hooks/use-markets";
import { useWatchlists } from "@/lib/api/hooks/use-watchlists";
import { useTheme } from "@/lib/use-theme";
import type { Instrument } from "@/lib/api/types";

const FILTERS = ["ALL", "CRYPTO", "FAVORITES"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABELS: Record<Filter, string> = { ALL: "All", CRYPTO: "Crypto", FAVORITES: "Favorites" };

export default function MarketsScreen() {
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const { data: markets, isLoading } = useMarkets({ search: search || undefined, limit: 250 });
  const { data: watchlists } = useWatchlists();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["markets"] });
    setRefreshing(false);
  }, [queryClient]);

  const favoriteIds = useMemo(
    () => new Set((watchlists ?? []).flatMap((w) => w.items.map((i) => i.instrumentId))),
    [watchlists],
  );

  const filtered = useMemo(() => {
    const list = markets ?? [];
    if (filter === "CRYPTO") return list.filter((m) => m.assetType === "CRYPTO");
    if (filter === "FAVORITES") return list.filter((m) => favoriteIds.has(m.id));
    return list;
  }, [markets, filter, favoriteIds]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <ThemedText variant="title">Markets</ThemedText>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.foregroundSubtle} style={styles.searchIcon} />
          <Input value={search} onChangeText={setSearch} placeholder="Search markets" style={styles.search} />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={colors.foregroundSubtle} />
            </Pressable>
          )}
        </View>
        <SegmentedTabs tabs={FILTERS} value={filter} onChange={setFilter} getLabel={(t) => FILTER_LABELS[t]} />
      </View>

      {isLoading ? (
        <SkeletonList count={10} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title={filter === "FAVORITES" ? "No favorites yet" : "No markets found"}
          description={filter === "FAVORITES" ? "Add markets to a watchlist to see them here." : "Try a different symbol or name."}
        />
      ) : (
        <Surface style={styles.panel}>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
            ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.glassBorder }]} />}
            renderItem={({ item, index }: { item: Instrument; index: number }) => (
              <FadeInItem index={index}>
                <MarketRow instrument={item} />
              </FadeInItem>
            )}
          />
        </Surface>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 14 },
  searchWrap: { position: "relative", justifyContent: "center" },
  searchIcon: { position: "absolute", left: 14, zIndex: 1 },
  search: { paddingLeft: 38, paddingRight: 38 },
  clearButton: { position: "absolute", right: 14 },
  panel: { flex: 1, marginHorizontal: 20, marginBottom: 110, padding: 2 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
});
