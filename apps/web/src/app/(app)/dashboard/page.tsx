"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { NearestLevels } from "@/components/dashboard/nearest-levels";
import { AlertsTable } from "@/components/alerts/alerts-table";
import { useAlerts } from "@/lib/api/hooks/use-alerts";

export default function DashboardPage() {
  const { data: alerts, isLoading } = useAlerts({ sort: "recent" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-foreground-muted">Everything you&apos;re watching, at a glance.</p>
        </div>
        <Button asChild>
          <Link href="/markets">+ Create Alert</Link>
        </Button>
      </div>

      <StatsBar />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground-muted">Recent alerts</h2>
            <Link href="/alerts" className="text-xs font-medium text-brand hover:underline">
              View all
            </Link>
          </div>
          <AlertsTable alerts={alerts?.slice(0, 8)} isLoading={isLoading} />
        </div>
        <NearestLevels />
      </div>
    </div>
  );
}
