import { useState, useCallback } from "react";
import { View, FlatList, Pressable, RefreshControl, StyleSheet, Alert as RNAlert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
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

const VISIBLE_ITEMS = 6;

export default function WatchlistsScreen() {
  const { colors } = useTheme();
  const { data: watchlists, isLoading } = useWatchlists();
  const createWatchlist = useCreateWatchlist();
  const deleteWatchlist = useDeleteWatchlist();
  const removeItem = useRemoveWatchlistItem();
  const showToast = useToastStore((s) => s.show);
  const [newName, setNewName] = useState("");
  const [composing, setComposing] = useState(false);
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
      </View>

      {isLoading ? (
        <SkeletonList count={4} />
      ) : (
        <FlatList
          data={watchlists ?? []}
          keyExtractor={(w: Watchlist) => w.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          renderItem={({ item, index }) => (
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
                      {item.items.length} {item.items.length === 1 ? "market" : "markets"}
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
                ) : (
                  <View style={styles.rows}>
                    {item.items.slice(0, VISIBLE_ITEMS).map((mkt: WatchlistItem, i: number) => (
                      <View
                        key={mkt.id}
                        style={[
                          styles.marketRow,
                          i < Math.min(item.items.length, VISIBLE_ITEMS) - 1 && { borderBottomColor: colors.glassBorder, borderBottomWidth: StyleSheet.hairlineWidth },
                        ]}
                      >
                        <View style={styles.marketLeft}>
                          <CoinLogo uri={mkt.iconUrl} symbol={mkt.symbol} size={26} />
                          <ThemedText numberOfLines={1} style={styles.marketSymbol}>
                            {mkt.symbol}
                          </ThemedText>
                        </View>
                        <View style={styles.marketRight}>
                          <PriceText value={mkt.price} variant="mono" />
                          <ThemedText variant="subtle" style={{ color: (mkt.changePct24h ?? 0) >= 0 ? colors.positive : colors.negative }}>
                            {formatPct(mkt.changePct24h)}
                          </ThemedText>
                          <Pressable
                            hitSlop={8}
                            onPress={() => {
                              haptics.light();
                              removeItem.mutate({ watchlistId: item.id, itemId: mkt.id });
                              showToast("Removed from watchlist", mkt.symbol, "info");
                            }}
                            style={styles.removeButton}
                          >
                            <Ionicons name="star" size={15} color={colors.warning} />
                          </Pressable>
                        </View>
                      </View>
                    ))}
                    {item.items.length > VISIBLE_ITEMS && (
                      <ThemedText variant="subtle" style={styles.moreText}>
                        +{item.items.length - VISIBLE_ITEMS} more
                      </ThemedText>
                    )}
                  </View>
                )}
              </Surface>
            </FadeInItem>
          )}
          ListEmptyComponent={<EmptyState icon="star-outline" title="No watchlists yet" description="Create one to track your favorite markets." />}
        />
      )}
    </SafeAreaView>
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
  emptyRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 16 },
});
