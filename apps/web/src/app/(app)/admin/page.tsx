"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminDashboard } from "@/lib/api/hooks/use-admin";
import { cn } from "@/lib/utils";

export default function AdminDashboardPage() {
  const { data, isLoading } = useAdminDashboard();

  if (isLoading || !data) return <Skeleton className="h-96 w-full rounded-xl" />;

  const stats = [
    { label: "Total Users", value: data.totalUsers },
    { label: "Active Alerts", value: data.activeAlerts },
    { label: "Triggered Today", value: data.triggeredToday },
    { label: "Failed Notifications", value: data.failedNotifications },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-xs text-foreground-subtle">{s.label}</p>
            <p className="mt-1 font-tabular text-3xl font-semibold">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <p className="mb-4 text-sm font-medium">Provider health</p>
        <div className="flex flex-col gap-3">
          {data.providers.map((p) => (
            <div key={p.provider} className="flex items-center justify-between border-b border-glass-border/60 pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", p.connected ? "bg-positive" : "bg-negative")} />
                <span className="font-medium capitalize">{p.provider}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-foreground-subtle">
                <span>{p.subscribedSymbols} symbols</span>
                <span>{p.latencyMs !== null ? `${p.latencyMs}ms` : "--"}</span>
                <Badge variant={p.connected ? "positive" : "negative"}>{p.connected ? "Connected" : "Disconnected"}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <p className="mb-4 text-sm font-medium">Queue depths</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(data.queueDepths).map(([name, depth]) => (
            <div key={name} className="rounded-lg border border-glass-border bg-glass px-3 py-2.5">
              <p className="text-xs text-foreground-subtle">{name}</p>
              <p className="font-tabular text-lg font-semibold">{depth}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
