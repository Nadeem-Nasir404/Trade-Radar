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
    <div className="overflow-hidden rounded-xl border border-glass-border bg-glass backdrop-blur-xl shadow-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-glass-border bg-background-elevated/60 text-left text-xs uppercase tracking-wider text-foreground-subtle">
            <th className="px-4 py-3.5 font-semibold">Asset</th>
            <th className="px-4 py-3.5 font-semibold">Condition</th>
            <th className="px-4 py-3.5 font-semibold">Target Level</th>
            <th className="hidden px-4 py-3.5 font-semibold sm:table-cell">Distance to Target</th>
            <th className="px-4 py-3.5 font-semibold">Status</th>
            <th className="px-4 py-3.5 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-glass-border/40">
          {alerts.map((alert) => {
            const up = isUpwardCondition(alert.conditionType);
            return (
              <tr key={alert.id} className="group transition-colors hover:bg-white/[0.03]">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-lg border border-glass-border bg-background-elevated font-mono font-bold text-foreground text-xs group-hover:border-brand/40 group-hover:text-brand transition-colors">
                      {alert.symbol.substring(0, 3)}
                    </div>
                    <div>
                      <Link href={`/markets/${alert.symbol.replace("/", "")}`} className="font-semibold text-foreground hover:text-brand transition-colors">
                        {alert.symbol}
                      </Link>
                      <p className="text-[11px] font-medium text-foreground-subtle uppercase">{alert.provider}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium border",
                    up ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-rose-500/20 bg-rose-500/10 text-rose-400"
                  )}>
                    {up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                    {formatConditionLabel(alert.conditionType)}
                  </span>
                </td>
                <td className="px-4 py-3.5 font-tabular font-semibold text-foreground">{formatAlertTarget(alert)}</td>
                <td className="hidden px-4 py-3.5 font-tabular sm:table-cell">
                  {alert.distancePct !== null ? (
                    <span className={cn(
                      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold font-tabular border",
                      alert.distancePct >= 0 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-rose-500/20 bg-rose-500/10 text-rose-400"
                    )}>
                      {formatPct(alert.distancePct)}
                    </span>
                  ) : (
                    <span className="text-foreground-subtle">--</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <AlertStatusBadge status={alert.status} />
                </td>
                <td className="px-4 py-3.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="opacity-70 group-hover:opacity-100 hover:bg-white/10">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {alert.status === "ACTIVE" && (
                        <DropdownMenuItem onSelect={() => pause.mutate(alert.id)} className="gap-2">
                          <Pause className="size-3.5" /> Pause Alert
                        </DropdownMenuItem>
                      )}
                      {alert.status === "PAUSED" && (
                        <DropdownMenuItem onSelect={() => resume.mutate(alert.id)} className="gap-2">
                          <Play className="size-3.5" /> Resume Alert
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => clone.mutate(alert.id)} className="gap-2">
                        <Copy className="size-3.5" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate(alert.id)} className="gap-2 text-rose-400 focus:text-rose-300">
                        <Trash2 className="size-3.5" /> Delete
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
