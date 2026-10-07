"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsFavorite, useToggleFavorite } from "@/lib/api/hooks/use-watchlists";

/** Star that adds/removes a market from the user's default watchlist; safe to place inside a link. */
export function FavoriteButton({ instrumentId, className }: { instrumentId: string; className?: string }) {
  const isFavorite = useIsFavorite(instrumentId);
  const toggle = useToggleFavorite();

  return (
    <button
      type="button"
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorite}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      onClick={(e) => {
        // Rows are links - starring a market must not also open it.
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate(instrumentId);
      }}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-glass-hover",
        isFavorite ? "text-warning" : "text-foreground-subtle hover:text-warning",
        className,
      )}
    >
      <Star className={cn("size-4 transition-transform active:scale-90", isFavorite && "fill-current")} />
    </button>
  );
}
