import { useMemo, useState, useCallback } from "react";
import { View, SectionList, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { ThemedText } from "@/components/ui/themed-text";
import { ScreenHeader } from "@/components/ui/screen-header";
import { AlertRow } from "@/components/alerts/alert-row";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
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
        <ScreenHeader
          title="Alerts"
          subtitle={`${sections.find((s) => s.title === "Active")?.data.length ?? 0} active · ${(alerts ?? []).filter((a) => a.status === "TRIGGERED").length} triggered`}
        />
      </View>

      {isLoading ? (
        <SkeletonList />
      ) : (
        // Virtualized: only the rows on screen are mounted (each with its own live price), so
        // opening the tab costs the same with 20 alerts or 500.
        <SectionList
          sections={sections}
          keyExtractor={(alert) => alert.id}
          stickySectionHeadersEnabled={false}
          initialNumToRender={14}
          windowSize={9}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
          renderSectionHeader={({ section }) => (
            <ThemedText variant="label" style={[styles.sectionTitle, section !== sections[0] && styles.cardGap]}>
              {section.title.toUpperCase()} · {section.data.length}
            </ThemedText>
          )}
          renderItem={({ item: alert, index, section }) => {
            const isFirst = index === 0;
            const isLast = index === section.data.length - 1;
            return (
              // Consecutive rows join into one card per section, like the grouped Surface they replace.
              <View
                style={[
                  styles.cardRow,
                  { borderColor: colors.glassBorder, backgroundColor: colors.glass },
                  isFirst && styles.cardFirst,
                  isLast && styles.cardLast,
                ]}
              >
                <AlertRow alert={alert} autoPeek={section === sections[0] && isFirst} />
              </View>
            );
          }}
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
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },
  cardGap: { marginTop: 20 },
  sectionTitle: { letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  cardRow: { paddingHorizontal: 14, borderLeftWidth: 1, borderRightWidth: 1, overflow: "hidden" },
  cardFirst: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: 2 },
  cardLast: { borderBottomWidth: 1, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, paddingBottom: 2 },
});
