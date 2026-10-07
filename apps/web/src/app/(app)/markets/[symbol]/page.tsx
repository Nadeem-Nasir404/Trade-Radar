"use client";

import { use, useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import Link from "next/link";
import { Bell, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PriceChart } from "@/components/charts/price-chart";
import { FavoriteButton } from "@/components/markets/favorite-button";
import { MarketAlertRow } from "@/components/alerts/market-alert-row";
import { useMarket, useMarketHistory } from "@/lib/api/hooks/use-markets";
import { useAlerts } from "@/lib/api/hooks/use-alerts";
import { useLivePrice } from "@/lib/ws/use-live-price";
import { useAlertDraftStore } from "@/lib/stores/alert-draft-store";
import { formatCompactNumber, formatCompactPrice, formatPct, cn } from "@/lib/utils";
import { isUpwardCondition } from "@/lib/format-condition";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

export default function MarketDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>("1h");

  const { data: instrument, isLoading } = useMarket(symbol);
  const { data: candles, isLoading: loadingCandles } = useMarketHistory(symbol, timeframe);
  const { data: alerts } = useAlerts({ search: symbol });
  const startDraft = useAlertDraftStore((s) => s.startDraft);

  const live = useLivePrice(instrument?.id, { price: instrument?.price ?? null, changePct24h: instrument?.changePct24h ?? null });
  const price = live.price ?? instrument?.price ?? null;
  const changePct = live.changePct24h ?? instrument?.changePct24h ?? null;
  const positive = (changePct ?? 0) >= 0;

  const queryClient = useQueryClient();
  const refetchHistory = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.marketHistory(symbol, timeframe) });
  }, [queryClient, symbol, timeframe]);

  const instrumentAlerts = useMemo(() => (alerts ?? []).filter((a) => a.instrumentId === instrument?.id), [alerts, instrument?.id]);
  const chartLevels = useMemo(
    () => instrumentAlerts.map((a) => ({ id: a.id, price: a.targetValue, up: isUpwardCondition(a.conditionType) })),
    [instrumentAlerts],
  );

  const handleChartClick = (clickedPrice: number) => {
    if (!instrument) return;
    startDraft({ instrumentId: instrument.id, symbol: instrument.displaySymbol, targetValue: clickedPrice });
  };

  const handleCreateAlert = () => {
    if (!instrument) return;
    startDraft({ instrumentId: instrument.id, symbol: instrument.displaySymbol, targetValue: price ?? 0 });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!instrument) {
    return <EmptyState icon={Bell} title="Market not found" description="This instrument doesn't exist or isn't active." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{instrument.displaySymbol}</h1>
            <FavoriteButton instrumentId={instrument.id} />
            {instrument.isDemo && <Badge variant="warning">Demo data</Badge>}
            {live.feedStatus === "STALE" && <Badge variant="negative">Feed delayed</Badge>}
          </div>
          <p className="text-sm text-foreground-subtle">
            {instrument.exchange ?? instrument.provider}
          </p>
        </div>
        <Button onClick={handleCreateAlert}>
          <Plus className="size-4" /> Create Alert
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Current Price" value={formatCompactPrice(price)} />
        <Stat label="24h Change" value={formatPct(changePct)} tone={positive ? "positive" : "negative"} />
        <Stat label="24h High" value={formatCompactPrice(instrument.high24h)} />
        <Stat label="24h Low" value={formatCompactPrice(instrument.low24h)} />
        <Stat label="24h Volume" value={formatCompactNumber(instrument.volume24h)} />
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as (typeof TIMEFRAMES)[number])}>
            <TabsList>
              {TIMEFRAMES.map((tf) => (
                <TabsTrigger key={tf} value={tf}>
                  {tf}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <p className="hidden text-xs text-foreground-subtle sm:block">Click the chart to set an alert at that price</p>
        </div>
        {/* The chart stays mounted across timeframe switches and shows its own loading/empty state. */}
        <PriceChart
          candles={candles ?? []}
          loading={loadingCandles}
          instrumentId={instrument.id}
          timeframe={timeframe}
          watermark={`${instrument.displaySymbol} · ${timeframe}`}
          onBarClose={refetchHistory}
          alertLevels={chartLevels}
          onPriceClick={handleChartClick}
        />
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground-muted">Your Alerts</h2>
          <span className="text-xs text-foreground-subtle">{instrumentAlerts.length} total</span>
        </div>
        {instrumentAlerts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No alerts on this market yet"
            description="Click the chart or the button above to set your first level."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {instrumentAlerts.map((alert) => (
              <MarketAlertRow key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-foreground-subtle">
        Looking for a market? <Link href="/markets" className="text-brand hover:underline">Browse all markets</Link>
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-foreground-subtle">{label}</p>
      <p className={cn("mt-1 font-tabular text-xl font-semibold", tone === "positive" && "text-positive", tone === "negative" && "text-negative")}>
        {value}
      </p>
    </Card>
  );
}
