"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pause, Play, Repeat, Trash2 } from "lucide-react";
import { AlertStatusBadge } from "./alert-status-badge";
import { cn, formatPct } from "@/lib/utils";
import { computeDistancePct, formatAlertTarget, formatConditionLabel, isUpwardCondition } from "@/lib/format-condition";
import { useDeleteAlert, usePauseAlert, useResumeAlert } from "@/lib/api/hooks/use-alerts";
import { useLivePriceStore } from "@/lib/ws/live-price-store";
import type { Alert } from "@/lib/api/types";

const CONFIRM_WINDOW_MS = 3000;

/** An alert on the market page: target, live distance to it, status, and pause/resume/delete. */
export function MarketAlertRow({ alert }: { alert: Alert }) {
  const up = isUpwardCondition(alert.conditionType);
  const livePrice = useLivePriceStore((s) => s.byId[alert.instrumentId]?.price) ?? alert.currentPrice;
  const distancePct = computeDistancePct(livePrice, alert) ?? alert.distancePct;

  const pause = usePauseAlert();
  const resume = useResumeAlert();
  const remove = useDeleteAlert();
  // Delete asks once: the first click arms it, a second click within a few seconds confirms.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => setConfirmingDelete(false), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  const canPause = alert.status === "ACTIVE";
  const canResume = alert.status === "PAUSED";

  return (
    <div
      className={cn(
        "group flex items-center gap-4 rounded-lg border border-glass-border bg-glass px-4 py-3 transition-colors hover:bg-glass-hover",
        alert.status !== "ACTIVE" && "opacity-75",
      )}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", up ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative")}>
        {up ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-tabular text-sm font-medium">{formatAlertTarget(alert)}</span>
          {alert.isRecurring && <Repeat className="size-3.5 text-foreground-subtle" aria-label="Recurring" />}
        </div>
        <p className="truncate text-xs text-foreground-subtle">
          {formatConditionLabel(alert.conditionType)}
          {alert.notes ? ` · ${alert.notes}` : ""}
        </p>
      </div>

      {distancePct !== null && alert.status === "ACTIVE" && (
        <span
          className={cn(
            "hidden rounded-md border px-2 py-0.5 font-tabular text-xs sm:inline-block",
            distancePct >= 0 ? "border-positive/20 bg-positive/10 text-positive" : "border-negative/20 bg-negative/10 text-negative",
          )}
          title="Distance from the current price"
        >
          {formatPct(distancePct)}
        </span>
      )}

      <AlertStatusBadge status={alert.status} />

      <div className="flex items-center gap-1">
        {(canPause || canResume) && (
          <button
            type="button"
            onClick={() => (canPause ? pause.mutate(alert.id) : resume.mutate(alert.id))}
            className="inline-flex size-8 items-center justify-center rounded-md text-foreground-subtle transition-colors hover:bg-glass-hover hover:text-foreground"
            aria-label={canPause ? "Pause alert" : "Resume alert"}
            title={canPause ? "Pause" : "Resume"}
          >
            {canPause ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => (confirmingDelete ? remove.mutate(alert.id) : setConfirmingDelete(true))}
          disabled={remove.isPending}
          className={cn(
            "inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-xs transition-colors",
            confirmingDelete ? "bg-negative text-white" : "text-foreground-subtle hover:bg-glass-hover hover:text-negative",
          )}
          aria-label={confirmingDelete ? "Confirm delete" : "Delete alert"}
          title={confirmingDelete ? "Click again to delete" : "Delete"}
        >
          <Trash2 className="size-4" />
          {confirmingDelete && <span>Delete?</span>}
        </button>
      </div>
    </div>
  );
}
