"use client";

import { useMemo, useState } from "react";
import { Map as MapIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { formatCompactPrice, cn } from "@/lib/utils";

function bucketSize(price: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(price || 1)));
  return magnitude / 2;
}

export default function LevelMapPage() {
  const { data: alerts, isLoading } = useAlerts({ status: "ACTIVE" });
  const symbols = useMemo(() => [...new Set((alerts ?? []).map((a) => a.symbol))], [alerts]);
  const [symbol, setSymbol] = useState<string | undefined>(undefined);

  const activeSymbol = symbol ?? symbols[0];
  const symbolAlerts = (alerts ?? []).filter((a) => a.symbol === activeSymbol && a.currentPrice !== null);

  const buckets = useMemo(() => {
    if (symbolAlerts.length === 0) return [];
    const size = bucketSize(symbolAlerts[0].targetValue);
    const counts = new Map<number, number>();
    for (const alert of symbolAlerts) {
      const bucket = Math.round(alert.targetValue / size) * size;
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[0] - a[0]);
  }, [symbolAlerts]);

  const maxCount = Math.max(1, ...buckets.map(([, count]) => count));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Level Map</h1>
          <p className="text-sm text-foreground-muted">A visual heatmap of where you&apos;ve stacked your levels.</p>
        </div>
        {symbols.length > 0 && (
          <Select value={activeSymbol} onValueChange={setSymbol}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {symbols.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading && <Skeleton className="h-80 w-full rounded-xl" />}

      {!isLoading && buckets.length === 0 && (
        <EmptyState icon={MapIcon} title="No levels to map yet" description="Create a few alerts on the same market to see your Level Map." />
      )}

      {buckets.length > 0 && (
        <Card className="p-6">
          <p className="mb-5 text-sm font-medium">{activeSymbol}</p>
          <div className="flex flex-col gap-2.5">
            {buckets.map(([price, count]) => (
              <div key={price} className="flex items-center gap-3">
                <span className="w-24 shrink-0 font-tabular text-xs text-foreground-subtle">{formatCompactPrice(price)}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-glass">
                  <div
                    className={cn("h-full rounded-md bg-gradient-to-r from-brand/70 to-brand transition-all")}
                    style={{ width: `${Math.max(6, (count / maxCount) * 100)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-xs text-foreground-subtle">
                  {count} alert{count === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
