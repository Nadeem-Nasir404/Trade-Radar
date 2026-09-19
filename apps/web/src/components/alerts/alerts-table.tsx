"use client";

import Link from "next/link";
import { ArrowUp, ArrowDown, MoreHorizontal, Pause, Play, Copy, Trash2, Bell } from "lucide-react";
import { AlertStatusBadge } from "./alert-status-badge";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatAlertTarget, formatConditionLabel, isUpwardCondition } from "@/lib/format-condition";
import { cn, formatPct } from "@/lib/utils";
import { usePauseAlert, useResumeAlert, useCloneAlert, useDeleteAlert } from "@/lib/api/hooks/use-alerts";
import type { Alert } from "@/lib/api/types";

export function AlertsTable({ alerts, isLoading }: { alerts?: Alert[]; isLoading?: boolean }) {
  const pause = usePauseAlert();
  const resume = useResumeAlert();
  const clone = useCloneAlert();
  const remove = useDeleteAlert();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="Your first alert is waiting."
        description="Pick a market and set your level."
        actionHref="/markets"
        actionLabel="Create your first alert"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-glass-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-glass-border bg-glass text-left text-xs uppercase tracking-wide text-foreground-subtle">
            <th className="px-4 py-3 font-medium">Asset</th>
            <th className="px-4 py-3 font-medium">Condition</th>
            <th className="px-4 py-3 font-medium">Target</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Distance</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => {
            const up = isUpwardCondition(alert.conditionType);
            return (
              <tr key={alert.id} className="border-b border-glass-border/60 last:border-0 hover:bg-glass/50">
                <td className="px-4 py-3">
                  <Link href={`/markets/${alert.symbol.replace("/", "")}`} className="font-medium hover:text-brand">
                    {alert.symbol}
                  </Link>
                  <p className="text-xs text-foreground-subtle">{alert.provider}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-foreground-muted">
                    {up ? <ArrowUp className="size-3.5 text-positive" /> : <ArrowDown className="size-3.5 text-negative" />}
                    {formatConditionLabel(alert.conditionType)}
                  </span>
                </td>
                <td className="px-4 py-3 font-tabular">{formatAlertTarget(alert)}</td>
                <td className="hidden px-4 py-3 font-tabular sm:table-cell">
                  {alert.distancePct !== null ? (
                    <span className={cn(alert.distancePct >= 0 ? "text-positive" : "text-negative")}>{formatPct(alert.distancePct)}</span>
                  ) : (
                    "--"
                  )}
                </td>
                <td className="px-4 py-3">
                  <AlertStatusBadge status={alert.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {alert.status === "ACTIVE" && (
                        <DropdownMenuItem onSelect={() => pause.mutate(alert.id)}>
                          <Pause /> Pause
                        </DropdownMenuItem>
                      )}
                      {alert.status === "PAUSED" && (
                        <DropdownMenuItem onSelect={() => resume.mutate(alert.id)}>
                          <Play /> Resume
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => clone.mutate(alert.id)}>
                        <Copy /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate(alert.id)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
