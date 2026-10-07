import { useMemo, useState, useCallback } from "react";
import { View, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet } from "react-native";
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
import { ThemedText } from "@/components/ui/themed-text";
import { useLivePriceStore } from "@/lib/ws/live-price-store";
import { formatCompactNumber } from "@/lib/format";
import { withAlpha } from "@/lib/color";
import { haptics } from "@/lib/haptics";

const FILTERS = ["ALL", "CRYPTO", "FAVORITES"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABELS: Record<Filter, string> = { ALL: "All", CRYPTO: "Crypto", FAVORITES: "Favorites" };

type Sort = "cap" | "gainers" | "losers" | "volume" | "az";
const SORTS: { value: Sort; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { value: "cap", label: "Market cap", icon: "podium-outline" },
  { value: "gainers", label: "Top gainers", icon: "trending-up" },
  { value: "losers", label: "Top losers", icon: "trending-down" },
  { value: "volume", label: "Volume", icon: "bar-chart-outline" },
  { value: "az", label: "A–Z", icon: "text-outline" },
];

/** 24h change: the live feed's figure when the coin is streaming, else the list's. */
function changeOf(m: Instrument): number | null {
  return useLivePriceStore.getState().byId[m.id]?.changePct24h ?? m.changePct24h;
}

/** Largest first, missing values last. */
const desc = (a: number | null | undefined, b: number | null | undefined) => (b ?? -Infinity) - (a ?? -Infinity);

/**
 * Orders the markets for the chosen sort. Gainers keep only coins up on the day and losers only
 * those down. Read when the list renders, so rows don't reshuffle under your thumb on every tick.
 */
function sortMarkets(list: Instrument[], sort: Sort): Instrument[] {
  switch (sort) {
    case "cap":
      // Coins without a market cap (gold, forex, unranked tokens) follow, busiest first.
      return [...list].sort((a, b) => desc(a.marketCap, b.marketCap) || desc(a.volume24h, b.volume24h));
    case "volume":
      return [...list].sort((a, b) => desc(a.volume24h, b.volume24h));
    case "az":
      return [...list].sort((a, b) => a.displaySymbol.localeCompare(b.displaySymbol));
    case "gainers":
    case "losers": {
      const up = sort === "gainers";
      return list
        .map((m) => ({ m, change: changeOf(m) }))
        .filter((r): r is { m: Instrument; change: number } => r.change != null && (up ? r.change > 0 : r.change < 0))
        .sort((a, b) => (up ? b.change - a.change : a.change - b.change))
        .map((r) => r.m);
    }
  }
}

function detailFor(m: Instrument, sort: Sort): string | undefined {
  if (sort === "cap" && m.marketCap != null) return `${m.marketCapRank != null ? `#${m.marketCapRank} · ` : ""}MCap $${formatCompactNumber(m.marketCap)}`;
  if (sort === "volume" && m.volume24h != null) return `Vol $${formatCompactNumber(m.volume24h)}`;
  return undefined;
}

export default function MarketsScreen() {
  const tabSpace = useTabBarSpace();
  const { colors } = useTheme();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("cap");
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
    const scoped =
      filter === "CRYPTO" ? list.filter((m) => m.assetType === "CRYPTO") : filter === "FAVORITES" ? list.filter((m) => favoriteIds.has(m.id)) : list;
    return sortMarkets(scoped, sort);
  }, [markets, filter, favoriteIds, sort]);

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

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sorts} style={styles.sortScroll}>
          {SORTS.map((s) => {
            const active = s.value === sort;
            const tone = s.value === "gainers" ? colors.positive : s.value === "losers" ? colors.negative : colors.brand;
            return (
              <Pressable
                key={s.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  if (active) return;
                  haptics.selection();
                  setSort(s.value);
                }}
                style={[
                  styles.sortChip,
                  { backgroundColor: active ? withAlpha(tone, 0.16) : colors.glass, borderColor: active ? withAlpha(tone, 0.55) : colors.glassBorder },
                ]}
              >
                <Ionicons name={s.icon} size={14} color={active ? tone : colors.foregroundMuted} />
                <ThemedText style={[styles.sortText, { color: active ? tone : colors.foregroundMuted }]}>{s.label}</ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <SkeletonList count={10} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title={
            sort === "gainers" ? "Nothing is up right now" : sort === "losers" ? "Nothing is down right now" : filter === "FAVORITES" ? "No favorites yet" : "No markets found"
          }
          description={
            sort === "gainers" || sort === "losers"
              ? "Try another sort."
              : filter === "FAVORITES"
                ? "Tap the star on any market to save it here."
                : "Try a different symbol or name."
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          extraData={sort}
          contentContainerStyle={[styles.list, { paddingBottom: tabSpace }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          ItemSeparatorComponent={Separator}
          renderItem={({ item, index }: { item: Instrument; index: number }) => (
            <FadeInItem index={index}>
              <MarketRow instrument={item} detail={detailFor(item, sort)} />
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
  sortScroll: { marginHorizontal: -20 },
  sorts: { gap: 8, paddingHorizontal: 20 },
  sortChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1 },
  sortText: { fontSize: 13, fontWeight: "600" },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
});
