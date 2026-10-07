import { useState, useCallback } from "react";
import { View, FlatList, Pressable, RefreshControl, StyleSheet, Alert as RNAlert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ui/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import { Surface } from "@/components/ui/surface";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { FadeInItem } from "@/components/ui/fade-in-item";
import { SkeletonList } from "@/components/ui/skeleton";
import { PriceText } from "@/components/ui/price-text";
import { CoinLogo } from "@/components/coin-logo";
import { useWatchlists, useCreateWatchlist, useDeleteWatchlist, useRemoveWatchlistItem } from "@/lib/api/hooks/use-watchlists";
import { queryKeys } from "@/lib/api/query-keys";
import { formatPct } from "@/lib/format";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { withAlpha } from "@/lib/color";
import { haptics } from "@/lib/haptics";
import { useToastStore } from "@/lib/stores/toast-store";
import type { Watchlist, WatchlistItem } from "@/lib/api/types";
import { useTabBarSpace } from "@/lib/hooks/use-tab-bar-space";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { useLivePriceStore } from "@/lib/ws/live-price-store";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";

const VISIBLE_ITEMS = 6;

type MoverFilter = "all" | "gainers" | "losers";

const FILTERS: { value: MoverFilter; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { value: "all", label: "All", icon: "list-outline" },
  { value: "gainers", label: "Top gainers", icon: "trending-up" },
  { value: "losers", label: "Top losers", icon: "trending-down" },
];

/** 24h change: the live feed's figure when the coin is streaming, else the list's. */
function changeOf(item: WatchlistItem): number | null {
  return useLivePriceStore.getState().byId[item.instrumentId]?.changePct24h ?? item.changePct24h;
}

/**
 * A watchlist's markets for the filter: as saved for "all"; for gainers only those up on the day,
 * biggest first; for losers only those down, biggest drop first. Read when the list renders, so
 * the order holds still while you look at it instead of jumping with every tick.
 */
function moversOf(items: WatchlistItem[], filter: MoverFilter): WatchlistItem[] {
  if (filter === "all") return items;
  const ranked = items.map((item) => ({ item, change: changeOf(item) })).filter((r): r is { item: WatchlistItem; change: number } => r.change != null);
  return filter === "gainers"
    ? ranked.filter((r) => r.change > 0).sort((a, b) => b.change - a.change).map((r) => r.item)
    : ranked.filter((r) => r.change < 0).sort((a, b) => a.change - b.change).map((r) => r.item);
}

export default function WatchlistsScreen() {
  const tabSpace = useTabBarSpace();
  const { colors } = useTheme();
  const { data: watchlists, isLoading } = useWatchlists();
  const createWatchlist = useCreateWatchlist();
  const deleteWatchlist = useDeleteWatchlist();
  const removeItem = useRemoveWatchlistItem();
  const showToast = useToastStore((s) => s.show);
  const [newName, setNewName] = useState("");
  const [composing, setComposing] = useState(false);
  const [filter, setFilter] = useState<MoverFilter>("all");
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: queryKeys.watchlists });
    setRefreshing(false);
  }, [queryClient]);

  const submitCreate = async () => {
    if (!newName.trim()) return;
    await createWatchlist.mutateAsync(newName.trim());
    setNewName("");
    setComposing(false);
    haptics.success();
  };

  const confirmDelete = (watchlist: Watchlist) => {
    haptics.warning();
    RNAlert.alert("Delete watchlist?", `"${watchlist.name}" and its ${watchlist.items.length} market(s) will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteWatchlist.mutate(watchlist.id);
          showToast("Watchlist deleted", watchlist.name, "info");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <AmbientOrbs />
      <View style={styles.header}>
        <ScreenHeader
          title="Watchlists"
          subtitle="Group the markets you follow"
          action={
            <Pressable
              hitSlop={10}
              onPress={() => {
                haptics.light();
                setComposing((v) => !v);
              }}
              style={[styles.newButton, { backgroundColor: withAlpha(colors.brand, composing ? 0.22 : 0.14) }]}
            >
              <Ionicons name={composing ? "close" : "add"} size={20} color={colors.brand} />
            </Pressable>
          }
        />

        {composing && (
          <View style={styles.createRow}>
            <Input
              value={newName}
              onChangeText={setNewName}
              placeholder="Watchlist name"
              autoFocus
              onSubmitEditing={submitCreate}
              returnKeyType="done"
              style={styles.input}
            />
            <Button title="Create" onPress={submitCreate} loading={createWatchlist.isPending} style={styles.addButton} />
          </View>
        )}

        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = f.value === filter;
            const tone = f.value === "gainers" ? colors.positive : f.value === "losers" ? colors.negative : colors.brand;
            return (
              <Pressable
                key={f.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  if (active) return;
                  haptics.selection();
                  setFilter(f.value);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? withAlpha(tone, 0.16) : colors.glass,
                    borderColor: active ? withAlpha(tone, 0.55) : colors.glassBorder,
                  },
                ]}
              >
                <Ionicons name={f.icon} size={14} color={active ? tone : colors.foregroundMuted} />
                <ThemedText style={[styles.filterText, { color: active ? tone : colors.foregroundMuted }]}>{f.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <SkeletonList count={4} />
      ) : (
        <FlatList
          data={watchlists ?? []}
          keyExtractor={(w: Watchlist) => w.id}
          extraData={filter}
          contentContainerStyle={[styles.list, { paddingBottom: tabSpace }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          renderItem={({ item, index }) => {
            const shown = moversOf(item.items, filter);
            return (
              <FadeInItem index={index} style={index > 0 ? styles.cardGap : undefined}>
                <Surface style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, { backgroundColor: withAlpha(colors.brand, 0.14) }]}>
                      <Ionicons name="albums" size={15} color={colors.brand} />
                    </View>
                    <View style={styles.cardTitleWrap}>
                      <ThemedText variant="subtitle" numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      <ThemedText variant="subtle">
                        {filter === "all"
                          ? `${item.items.length} ${item.items.length === 1 ? "market" : "markets"}`
                          : `${shown.length} of ${item.items.length} ${filter === "gainers" ? "up" : "down"} today`}
                      </ThemedText>
                    </View>
                    <Pressable hitSlop={10} onPress={() => confirmDelete(item)} style={styles.overflowButton}>
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.foregroundSubtle} />
                    </Pressable>
                  </View>

                  {item.items.length === 0 ? (
                    <View style={styles.emptyRow}>
                      <Ionicons name="search-outline" size={16} color={colors.foregroundSubtle} />
                      <ThemedText variant="subtle">No markets yet - add some from the Markets tab</ThemedText>
                    </View>
                  ) : shown.length === 0 ? (
                    <View style={styles.emptyRow}>
                      <Ionicons name={filter === "gainers" ? "trending-up" : "trending-down"} size={16} color={colors.foregroundSubtle} />
                      <ThemedText variant="subtle">{filter === "gainers" ? "Nothing in this list is up today" : "Nothing in this list is down today"}</ThemedText>
                    </View>
                  ) : (
                    <View style={styles.rows}>
                      {shown.slice(0, VISIBLE_ITEMS).map((mkt: WatchlistItem, i: number) => (
                        <WatchRow
                          key={mkt.id}
                          item={mkt}
                          rank={filter === "all" ? null : i + 1}
                          divider={i < Math.min(shown.length, VISIBLE_ITEMS) - 1}
                          onRemove={() => {
                            haptics.light();
                            removeItem.mutate({ watchlistId: item.id, itemId: mkt.id });
                            showToast("Removed from watchlist", mkt.symbol, "info");
                          }}
                        />
                      ))}
                      {shown.length > VISIBLE_ITEMS && (
                        <ThemedText variant="subtle" style={styles.moreText}>
                          +{shown.length - VISIBLE_ITEMS} more
                        </ThemedText>
                      )}
                    </View>
                  )}
                </Surface>
              </FadeInItem>
            );
          }}
          ListEmptyComponent={<EmptyState icon="star-outline" title="No watchlists yet" description="Create one to track your favorite markets." />}
        />
      )}
    </SafeAreaView>
  );
}

/** One market in a watchlist card: live price and 24h change, with its rank when filtering movers. */
function WatchRow({ item, rank, divider, onRemove }: { item: WatchlistItem; rank: number | null; divider: boolean; onRemove: () => void }) {
  const { colors } = useTheme();
  const live = useLivePrice(item.instrumentId, { price: item.price, changePct24h: item.changePct24h });
  const change = live.changePct24h ?? item.changePct24h;
  const tone = (change ?? 0) >= 0 ? colors.positive : colors.negative;
  return (
    <View style={[styles.marketRow, divider && { borderBottomColor: colors.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.marketLeft}>
        {rank != null && (
          <View style={[styles.rank, { backgroundColor: withAlpha(tone, 0.14) }]}>
            <ThemedText style={[styles.rankText, { color: tone }]}>{rank}</ThemedText>
          </View>
        )}
        <CoinLogo uri={item.iconUrl} symbol={item.symbol} size={26} />
        <ThemedText numberOfLines={1} style={styles.marketSymbol}>
          {item.symbol}
        </ThemedText>
      </View>
      <View style={styles.marketRight}>
        <PriceText value={live.price ?? item.price} variant="mono" />
        <ThemedText variant="subtle" style={{ color: tone }}>
          {formatPct(change)}
        </ThemedText>
        <Pressable hitSlop={8} onPress={onRemove} style={styles.removeButton} accessibilityLabel={`Remove ${item.symbol} from watchlist`}>
          <Ionicons name="star" size={15} color={colors.warning} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  newButton: { width: 34, height: 34, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  createRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1 },
  addButton: { width: 96 },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 110 },
  cardGap: { marginTop: 12 },
  card: { padding: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIcon: { width: 30, height: 30, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  cardTitleWrap: { flex: 1, minWidth: 0, gap: 1 },
  overflowButton: { padding: 4 },
  rows: { marginTop: 14 },
  marketRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  marketLeft: { flexDirection: "row", gap: 10, alignItems: "center", flex: 1, minWidth: 0 },
  marketSymbol: { flexShrink: 1 },
  marketRight: { flexDirection: "row", gap: 8, alignItems: "center" },
  removeButton: { padding: 2 },
  moreText: { textAlign: "center", paddingTop: 10 },
  filters: { flexDirection: "row", gap: 8 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1 },
  filterText: { fontSize: 13, fontWeight: "600" },
  rank: { width: 20, height: 20, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 11, fontWeight: "700" },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 16 },
});
