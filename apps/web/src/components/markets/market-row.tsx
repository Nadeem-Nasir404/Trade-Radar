"use client";

import Link from "next/link";
import { Star, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatCompactPrice, formatPct } from "@/lib/utils";
import type { Instrument } from "@/lib/api/types";
import { useLivePrice } from "@/lib/ws/use-live-price";

export function MarketRow({ instrument }: { instrument: Instrument }) {
  // Each row follows its own live price; one shared socket subscription per instrument.
  const live = useLivePrice(instrument.id, { price: instrument.price, changePct24h: instrument.changePct24h });
  const price = live.price ?? instrument.price;
  const changePct = live.changePct24h ?? instrument.changePct24h;
  const positive = (changePct ?? 0) >= 0;

  return (
    <Link
      href={`/markets/${instrument.symbol}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-glass-border bg-glass px-4 py-3.5 transition-colors hover:bg-glass-hover"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          className="text-foreground-subtle hover:text-warning"
          aria-label="Favorite"
        >
          <Star className="size-4" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{instrument.displaySymbol}</p>
            {instrument.isDemo && (
              <Badge variant="warning" className="text-[10px]">
                Demo
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-foreground-subtle">
            {instrument.provider} {instrument.exchange ? `· ${instrument.exchange}` : ""}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-tabular font-medium">{formatCompactPrice(price)}</p>
        <p className={cn("flex items-center justify-end gap-1 text-xs font-tabular", positive ? "text-positive" : "text-negative")}>
          {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {formatPct(changePct)}
        </p>
      </div>
    </Link>
  );
}
