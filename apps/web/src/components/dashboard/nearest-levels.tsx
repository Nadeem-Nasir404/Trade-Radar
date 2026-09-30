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
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <div className="relative flex size-6 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Radar className="size-3.5" />
              <span className="absolute -top-0.5 -right-0.5 flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-indigo-500"></span>
              </span>
            </div>
            <span className="font-semibold text-foreground">Nearest Levels</span>
          </div>
          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-400 border border-indigo-500/20">
            Radar Active
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-1">
        {isLoading && <Skeleton className="h-40 w-full" />}

        {!isLoading && symbols.length === 0 && (
          <EmptyState icon={Radar} title="Nothing nearby yet" description="Create an alert to see how close it is to triggering." />
        )}

        {symbols.map(([symbol, group]) => {
          const above = group.alerts!.filter((a) => (a.distancePct ?? 0) < 0).slice(0, 2);
          const below = group.alerts!.filter((a) => (a.distancePct ?? 0) >= 0).slice(0, 2);
          return (
            <div key={symbol} className="rounded-xl border border-glass-border bg-background-elevated/40 p-3.5 transition-colors hover:border-glass-border-strong">
              <div className="flex items-baseline justify-between border-b border-glass-border/60 pb-2">
                <p className="font-bold tracking-tight text-foreground">{symbol}</p>
                <p className="font-tabular text-xs text-foreground-muted">
                  Spot: <span className="font-medium text-foreground">{formatCompactPrice(group.currentPrice)}</span>
                </p>
              </div>
              <div className="mt-2.5 flex flex-col gap-2">
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
  const distPct = Math.abs(alert.distancePct ?? 0);
  const barWidth = Math.min(100, Math.max(12, 100 - distPct * 15));

  return (
    <div className="group/row flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className={cn("flex items-center gap-1 font-tabular font-medium transition-colors", up ? "text-emerald-400 group-hover/row:text-emerald-300" : "text-rose-400 group-hover/row:text-rose-300")}>
          {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
          {formatCompactPrice(alert.targetValue)}
        </span>
        <span className="font-tabular text-[11px] font-semibold text-foreground-muted">
          {formatPct(alert.distancePct)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cn("h-full rounded-full transition-all duration-500", up ? "bg-gradient-to-r from-emerald-500/40 to-emerald-400" : "bg-gradient-to-r from-rose-500/40 to-rose-400")}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}

