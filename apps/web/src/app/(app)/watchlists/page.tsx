"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useWatchlists, useCreateWatchlist, useDeleteWatchlist } from "@/lib/api/hooks/use-watchlists";
import { cn, formatCompactPrice, formatPct } from "@/lib/utils";

export default function WatchlistsPage() {
  const { data: watchlists, isLoading } = useWatchlists();
  const createWatchlist = useCreateWatchlist();
  const deleteWatchlist = useDeleteWatchlist();
  const [newName, setNewName] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createWatchlist.mutateAsync(newName.trim());
    setNewName("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Watchlists</h1>
        <p className="text-sm text-foreground-muted">Group the markets you check every day.</p>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New watchlist name" className="max-w-xs" />
        <Button type="submit" disabled={createWatchlist.isPending}>
          <Plus className="size-4" /> Create
        </Button>
      </form>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && watchlists?.length === 0 && (
        <EmptyState icon={Star} title="No watchlists yet" description="Create one to track your favorite markets in one place." />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {watchlists?.map((w) => (
          <Card key={w.id} className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <Link href={`/watchlists/${w.id}`} className="font-medium hover:text-brand">
                {w.name}
              </Link>
              {!w.isDefault && (
                <Button variant="ghost" size="icon-sm" onClick={() => deleteWatchlist.mutate(w.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {w.items.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground-muted">{item.symbol}</span>
                  <span className="flex items-center gap-2 font-tabular">
                    {formatCompactPrice(item.price)}
                    <span className={cn("text-xs", (item.changePct24h ?? 0) >= 0 ? "text-positive" : "text-negative")}>
                      {formatPct(item.changePct24h)}
                    </span>
                  </span>
                </div>
              ))}
              {w.items.length === 0 && <p className="text-xs text-foreground-subtle">No markets yet</p>}
            </div>
            <Link href={`/watchlists/${w.id}`} className="text-xs font-medium text-brand hover:underline">
              View all {w.items.length} →
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
