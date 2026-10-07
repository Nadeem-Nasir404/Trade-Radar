import { useMemo, useState, useCallback } from "react";
import { View, FlatList, Pressable, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Surface } from "@/components/ui/surface";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { FadeInItem } from "@/components/ui/fade-in-item";
import { SkeletonList } from "@/components/ui/skeleton";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { ScreenHeader } from "@/components/ui/screen-header";
import { MarketRow } from "@/components/markets/market-row";
import { useMarkets } from "@/lib/api/hooks/use-markets";
import { useWatchlists } from "@/lib/api/hooks/use-watchlists";
import { useTheme } from "@/lib/use-theme";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { radius } from "@/lib/theme";
import type { Instrument } from "@/lib/api/types";
import { useTabBarSpace } from "@/lib/hooks/use-tab-bar-space";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";

const FILTERS = ["ALL", "CRYPTO", "FAVORITES"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABELS: Record<Filter, string> = { ALL: "All", CRYPTO: "Crypto", FAVORITES: "Favorites" };

export default function MarketsScreen() {
  const tabSpace = useTabBarSpace();
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const debouncedSearch = useDebouncedValue(search.trim());
  const { data: markets, isLoading } = useMarkets({ search: debouncedSearch || undefined, limit: 250 });
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
      <AmbientOrbs />
      <View style={styles.header}>
        <ScreenHeader title="Markets" subtitle={`${filtered.length} instruments`} />

        <Surface style={styles.searchCard}>
          <Ionicons name="search" size={16} color={colors.foregroundSubtle} />
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search BTC, ETH, gold…"
            style={styles.searchInput}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.foregroundSubtle} />
            </Pressable>
          )}
        </Surface>

        <SegmentedTabs tabs={FILTERS} value={filter} onChange={setFilter} getLabel={(t) => FILTER_LABELS[t]} />
      </View>

      {isLoading ? (
        <SkeletonList count={10} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title={filter === "FAVORITES" ? "No favorites yet" : "No markets found"}
          description={filter === "FAVORITES" ? "Tap the star on any market to save it here." : "Try a different symbol or name."}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabSpace }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ItemSeparatorComponent={Separator}
          renderItem={({ item, index }: { item: Instrument; index: number }) => (
            <FadeInItem index={index}>
              <MarketRow instrument={item} />
            </FadeInItem>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function Separator() {
  const { colors } = useTheme();
  return <View style={[styles.separator, { backgroundColor: colors.glassBorder }]} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 14 },
  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: radius.lg,
  },
  searchInput: { flex: 1, height: 46, borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0 },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
});
