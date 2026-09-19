"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { MarketRow } from "@/components/markets/market-row";
import { useMarkets } from "@/lib/api/hooks/use-markets";
import type { AssetType } from "@levelpulse/shared-types";

function MarketsPageInner() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [assetType, setAssetType] = useState<AssetType | "ALL">("ALL");

  const { data: markets, isLoading } = useMarkets({
    search: search || undefined,
    assetType: assetType === "ALL" ? undefined : assetType,
    limit: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
        <p className="text-sm text-foreground-muted">Search any market, then click through to set a level.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-subtle" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search BTC, Bitcoin, XAU..." className="pl-9" />
        </div>
        <Tabs value={assetType} onValueChange={(v) => setAssetType(v as AssetType | "ALL")}>
          <TabsList>
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="CRYPTO">Crypto</TabsTrigger>
            <TabsTrigger value="COMMODITY">Gold</TabsTrigger>
            <TabsTrigger value="FOREX">Forex</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[68px] rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && markets?.length === 0 && (
        <EmptyState icon={SearchIcon} title="No markets found" description="Try a different symbol or name." />
      )}

      <div className="flex flex-col gap-2">
        {markets?.map((instrument) => (
          <MarketRow key={instrument.id} instrument={instrument} />
        ))}
      </div>
    </div>
  );
}

export default function MarketsPage() {
  return (
    <Suspense>
      <MarketsPageInner />
    </Suspense>
  );
}
