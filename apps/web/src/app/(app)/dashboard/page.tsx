"use client";

import Link from "next/link";
import { Plus, Activity, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { NearestLevels } from "@/components/dashboard/nearest-levels";
import { AlertsTable } from "@/components/alerts/alerts-table";
import { useAlerts } from "@/lib/api/hooks/use-alerts";

export default function DashboardPage() {
  const { data: alerts, isLoading } = useAlerts({ sort: "recent" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
              </span>
              Live Feed
            </div>
          </div>
          <p className="mt-1 text-sm text-foreground-muted">Real-time market monitoring and active alert status.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild size="sm" className="gap-1.5 font-medium shadow-[0_0_20px_-3px_rgba(99,102,241,0.4)]">
            <Link href="/markets">
              <Plus className="size-4" /> Create Alert
            </Link>
          </Button>
        </div>
      </div>

      <StatsBar />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-brand" />
              <h2 className="text-sm font-semibold text-foreground">Recent Active Alerts</h2>
            </div>
            <Link href="/alerts" className="flex items-center gap-1 text-xs font-medium text-brand hover:text-indigo-400 hover:underline">
              View all alerts <ArrowRight className="size-3" />
            </Link>
          </div>
          <AlertsTable alerts={alerts?.slice(0, 8)} isLoading={isLoading} />
        </div>
        <NearestLevels />
      </div>
    </div>
  );
}

