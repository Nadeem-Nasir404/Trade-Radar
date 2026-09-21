import { useMemo, useState, useCallback } from "react";
import { View, FlatList, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AlertRow } from "@/components/alerts/alert-row";
import { EmptyState } from "@/components/empty-state";
import { FadeInItem } from "@/components/ui/fade-in-item";
import { SkeletonList } from "@/components/ui/skeleton";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { useTheme } from "@/lib/use-theme";
import { isSameDay } from "@/lib/format";
import type { Alert } from "@/lib/api/types";

interface Section {
  title: string;
  data: Alert[];
}

export default function AlertsScreen() {
  const { colors } = useTheme();
  const { data: alerts, isLoading } = useAlerts({ sort: "recent" });
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    setRefreshing(false);
  }, [queryClient]);

  const sections = useMemo<Section[]>(() => {
    const all = alerts ?? [];
    const active = all.filter((a) => a.status === "ACTIVE");
    const triggeredToday = all.filter((a) => a.status === "TRIGGERED" && a.lastTriggeredAt && isSameDay(a.lastTriggeredAt));
    const triggeredEarlier = all.filter((a) => a.status === "TRIGGERED" && !(a.lastTriggeredAt && isSameDay(a.lastTriggeredAt)));
    const paused = all.filter((a) => a.status === "PAUSED");
    const expired = all.filter((a) => a.status === "EXPIRED" || a.status === "CANCELLED");

    return [
      { title: "Active", data: active },
      { title: "Triggered Today", data: triggeredToday },
      { title: "Triggered Earlier", data: triggeredEarlier },
      { title: "Paused", data: paused },
      { title: "Expired", data: expired },
    ].filter((s) => s.data.length > 0);
  }, [alerts]);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={styles.header}>
        <ThemedText variant="title">Alerts</ThemedText>
      </View>

      {isLoading ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(section) => section.title}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          renderItem={({ item: section, index }) => (
            <FadeInItem index={index} style={index > 0 ? styles.cardGap : undefined}>
              <ThemedText variant="label" style={styles.sectionTitle}>
                {section.title.toUpperCase()} · {section.data.length}
              </ThemedText>
              <Surface style={styles.card}>
                {section.data.map((alert, alertIndex) => (
                  <AlertRow key={alert.id} alert={alert} autoPeek={index === 0 && alertIndex === 0} />
                ))}
              </Surface>
            </FadeInItem>
          )}
          ListEmptyComponent={
            <EmptyState icon="notifications-outline" title="Your first alert is waiting." description="Pick a market and set your level." />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },
  cardGap: { marginTop: 20 },
  sectionTitle: { letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  card: { paddingHorizontal: 14, paddingVertical: 2 },
});
