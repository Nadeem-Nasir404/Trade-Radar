"use client";

import { useState } from "react";
import Link from "next/link";
import { Search as SearchIcon, History, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertsTable } from "@/components/alerts/alerts-table";
import { useAlerts, type AlertFilters } from "@/lib/api/hooks/use-alerts";

const STATUS_TABS = ["ALL", "ACTIVE", "TRIGGERED", "PAUSED", "EXPIRED"] as const;

export default function AlertsPage() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<NonNullable<AlertFilters["sort"]>>("recent");

  const { data: alerts, isLoading } = useAlerts({
    status: status === "ALL" ? undefined : status,
    search: search || undefined,
    sort,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-foreground-muted">Every level you&apos;re watching.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="glass" size="sm">
            <Link href="/alerts/groups">
              <Users className="size-4" /> Groups
            </Link>
          </Button>
          <Button asChild variant="glass" size="sm">
            <Link href="/alerts/history">
              <History className="size-4" /> History
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as (typeof STATUS_TABS)[number])}>
        <TabsList className="flex-wrap">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search BTC, ETH, SOL..." className="pl-9" />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently created</SelectItem>
            <SelectItem value="nearest">Nearest target</SelectItem>
            <SelectItem value="recently_triggered">Recently triggered</SelectItem>
            <SelectItem value="asset">Asset</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <AlertsTable alerts={alerts} isLoading={isLoading} />
    </div>
  );
}
