"use client";

import { use, useState } from "react";
import Link from "next/link";
import { GripVertical, Plus, X, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useWatchlists, useAddWatchlistItem, useRemoveWatchlistItem, useReorderWatchlist } from "@/lib/api/hooks/use-watchlists";
import { useMarkets } from "@/lib/api/hooks/use-markets";
import { cn, formatCompactPrice, formatPct } from "@/lib/utils";

export default function WatchlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: watchlists, isLoading } = useWatchlists();
  const removeItem = useRemoveWatchlistItem();
  const reorder = useReorderWatchlist();
  const addItem = useAddWatchlistItem();

  const [search, setSearch] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const { data: searchResults } = useMarkets({ search, limit: 6 });

  const watchlist = watchlists?.find((w) => w.id === id);

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (!watchlist) return <EmptyState icon={Bell} title="Watchlist not found" description="It may have been deleted." />;

  const items = [...watchlist.items].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorder.mutate({ watchlistId: watchlist.id, itemIdsInOrder: ids });
    setDraggedId(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/watchlists" className="text-xs text-foreground-subtle hover:text-foreground-muted">
          ← All watchlists
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{watchlist.name}</h1>
      </div>

      <div className="relative max-w-sm">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Add a market..." />
        {search && searchResults && searchResults.length > 0 && (
          <div className="glass-panel absolute z-10 mt-1 w-full rounded-lg p-1.5 shadow-xl">
            {searchResults.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  addItem.mutate({ watchlistId: watchlist.id, instrumentId: m.id });
                  setSearch("");
                }}
                className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-glass-hover"
              >
                {m.displaySymbol}
                <Plus className="size-3.5 text-foreground-subtle" />
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No markets yet" description="Search above to add your first market." />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Card
              key={item.id}
              draggable
              onDragStart={() => setDraggedId(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(item.id)}
              className={cn("flex items-center gap-3 p-3.5 transition-opacity", draggedId === item.id && "opacity-50")}
            >
              <GripVertical className="size-4 shrink-0 cursor-grab text-foreground-subtle" />
              <Link href={`/markets/${item.symbol}`} className="min-w-0 flex-1 hover:text-brand">
                <p className="truncate font-medium">{item.symbol}</p>
              </Link>
              <span className="font-tabular text-sm">{formatCompactPrice(item.price)}</span>
              <span className={cn("w-16 text-right font-tabular text-xs", (item.changePct24h ?? 0) >= 0 ? "text-positive" : "text-negative")}>
                {formatPct(item.changePct24h)}
              </span>
              <span className="hidden w-20 text-right text-xs text-foreground-subtle sm:block">{item.alertCount} alerts</span>
              <Button variant="ghost" size="icon-sm" onClick={() => removeItem.mutate({ watchlistId: watchlist.id, itemId: item.id })}>
                <X className="size-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
