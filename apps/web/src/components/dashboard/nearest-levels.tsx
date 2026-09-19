"use client";

import { ArrowUp, ArrowDown, Radar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { cn, formatCompactPrice, formatPct } from "@/lib/utils";

export function NearestLevels() {
  const { data: alerts, isLoading } = useAlerts({ status: "ACTIVE", sort: "nearest" });

  const grouped = new Map<string, { currentPrice: number | null; alerts: typeof alerts }>();
  for (const alert of alerts ?? []) {
    const existing = grouped.get(alert.symbol);
    if (existing) existing.alerts!.push(alert);
    else grouped.set(alert.symbol, { currentPrice: alert.currentPrice, alerts: [alert] });
  }

  const symbols = [...grouped.entries()].slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Radar className="size-4 text-brand" /> Nearest Levels
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {isLoading && <Skeleton className="h-40 w-full" />}

        {!isLoading && symbols.length === 0 && (
          <EmptyState icon={Radar} title="Nothing nearby yet" description="Create an alert to see how close it is to triggering." />
        )}

        {symbols.map(([symbol, group]) => {
          const above = group.alerts!.filter((a) => (a.distancePct ?? 0) < 0).slice(0, 2);
          const below = group.alerts!.filter((a) => (a.distancePct ?? 0) >= 0).slice(0, 2);
          return (
            <div key={symbol}>
              <div className="flex items-baseline justify-between">
                <p className="font-medium">{symbol}</p>
                <p className="font-tabular text-sm text-foreground-muted">Current: {formatCompactPrice(group.currentPrice)}</p>
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {above.map((a) => (
                  <LevelRow key={a.id} alert={a} up />
                ))}
                {below.map((a) => (
                  <LevelRow key={a.id} alert={a} up={false} />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function LevelRow({ alert, up }: { alert: NonNullable<ReturnType<typeof useAlerts>["data"]>[number]; up: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cn("flex items-center gap-1.5 font-tabular", up ? "text-positive" : "text-negative")}>
        {up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
        {formatCompactPrice(alert.targetValue)}
      </span>
      <span className="font-tabular text-foreground-subtle">{formatPct(alert.distancePct)}</span>
    </div>
  );
}
