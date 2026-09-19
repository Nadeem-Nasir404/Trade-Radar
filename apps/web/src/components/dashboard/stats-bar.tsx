"use client";

import { Bell, CheckCircle2, LayoutGrid, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { useAlertEvents } from "@/lib/api/hooks/use-alert-events";

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

export function StatsBar() {
  const { data: activeAlerts, isLoading: loadingActive } = useAlerts({ status: "ACTIVE" });
  const { data: allAlerts } = useAlerts();
  const { data: events, isLoading: loadingEvents } = useAlertEvents();

  const triggeredToday = events?.items.filter((e) => isToday(e.eventTime)).length ?? 0;
  const marketsWatched = new Set(allAlerts?.map((a) => a.instrumentId)).size;
  const notificationsSentToday =
    events?.items.filter((e) => isToday(e.eventTime)).reduce((sum, e) => sum + e.deliveries.filter((d) => d.status === "SENT").length, 0) ?? 0;

  const stats = [
    { label: "Active Alerts", value: activeAlerts?.length, icon: Bell },
    { label: "Triggered Today", value: triggeredToday, icon: CheckCircle2 },
    { label: "Markets Watched", value: marketsWatched, icon: LayoutGrid },
    { label: "Notifications", value: notificationsSentToday, icon: Send },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-foreground-subtle">{stat.label}</p>
            <stat.icon className="size-4 text-foreground-subtle" />
          </div>
          {loadingActive || loadingEvents ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-1 font-tabular text-3xl font-semibold">{stat.value ?? 0}</p>
          )}
        </Card>
      ))}
    </div>
  );
}
