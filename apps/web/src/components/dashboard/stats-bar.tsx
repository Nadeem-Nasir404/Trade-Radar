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
    {
      label: "Active Alerts",
      value: activeAlerts?.length,
      icon: Bell,
      subtext: "Armed & monitoring",
      accent: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      glow: "group-hover:shadow-[0_0_20px_-3px_rgba(99,102,241,0.3)]",
    },
    {
      label: "Triggered Today",
      value: triggeredToday,
      icon: CheckCircle2,
      subtext: "Crossed target levels",
      accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      glow: "group-hover:shadow-[0_0_20px_-3px_rgba(34,197,94,0.3)]",
    },
    {
      label: "Markets Watched",
      value: marketsWatched,
      icon: LayoutGrid,
      subtext: "Instruments tracked",
      accent: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      glow: "group-hover:shadow-[0_0_20px_-3px_rgba(245,158,11,0.3)]",
    },
    {
      label: "Notifications",
      value: notificationsSentToday,
      icon: Send,
      subtext: "Delivered last 24h",
      accent: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
      glow: "group-hover:shadow-[0_0_20px_-3px_rgba(6,182,212,0.3)]",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className={`group glass-panel-interactive p-5 transition-all ${stat.glow}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground-muted">{stat.label}</p>
            <div className={`flex size-8 items-center justify-center rounded-lg border transition-transform duration-300 group-hover:scale-110 ${stat.accent}`}>
              <stat.icon className="size-4" />
            </div>
          </div>
          {loadingActive || loadingEvents ? (
            <Skeleton className="mt-3 h-8 w-20" />
          ) : (
            <div className="mt-2 flex items-baseline justify-between">
              <p className="font-tabular text-3xl font-bold tracking-tight text-foreground">{stat.value ?? 0}</p>
              <span className="text-[11px] font-medium text-foreground-subtle">{stat.subtext}</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

