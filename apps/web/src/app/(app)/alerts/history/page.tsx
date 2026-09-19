"use client";

import { CheckCircle2, XCircle, Clock, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useAlertEvents } from "@/lib/api/hooks/use-alert-events";
import { formatCompactPrice, formatDateTime, cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/api/hooks/use-auth";

const DELIVERY_ICON = {
  SENT: { icon: CheckCircle2, className: "text-positive" },
  FAILED: { icon: XCircle, className: "text-negative" },
  RETRYING: { icon: Clock, className: "text-warning" },
  PENDING: { icon: Clock, className: "text-foreground-subtle" },
};

export default function AlertHistoryPage() {
  const { data: user } = useCurrentUser();
  const { data, isLoading } = useAlertEvents();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alert History</h1>
        <p className="text-sm text-foreground-muted">Every trigger, every price, every notification.</p>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <EmptyState icon={History} title="No triggers yet" description="Once an alert fires, you'll see the full history here." />
      )}

      <div className="flex flex-col gap-3">
        {data?.items.map((event) => (
          <Card key={event.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {event.symbol} crossed {formatCompactPrice(event.targetValue)}
                </p>
                <p className="mt-0.5 text-xs text-foreground-subtle">
                  Triggered: {formatDateTime(event.eventTime, user?.timezone)} · Source: {event.provider}
                </p>
              </div>
              <p className="font-tabular text-sm text-foreground-muted">Observed {formatCompactPrice(event.observedPrice)}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {event.deliveries.map((d) => {
                const config = DELIVERY_ICON[d.status as keyof typeof DELIVERY_ICON] ?? DELIVERY_ICON.PENDING;
                return (
                  <span key={d.channelType} className={cn("flex items-center gap-1.5 text-xs", config.className)}>
                    <config.icon className="size-3.5" />
                    {d.channelType}
                    {d.latencyMs !== null && <span className="text-foreground-subtle">· {d.latencyMs}ms</span>}
                  </span>
                );
              })}
              {event.deliveries.length === 0 && <span className="text-xs text-foreground-subtle">No notification channels enabled</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
