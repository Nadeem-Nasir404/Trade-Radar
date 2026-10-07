"use client";

import { useEffect, useMemo } from "react";
import { useLivePriceStore, subscribeLivePrice, unsubscribeLivePrice, type LivePriceState } from "./live-price-store";

export type { LivePriceState };

const EMPTY: LivePriceState = { price: null, prevPrice: null, changePct24h: null, feedStatus: "UNKNOWN", eventTime: null };

/**
 * Live price for an instrument while the calling component is mounted. Joins the server's
 * `instrument:{id}` room through the shared store (which drives the server-side viewer refcount,
 * see SubscriptionRegistryService) and re-renders only when this instrument's entry changes.
 */
export function useLivePrice(instrumentId: string | undefined, initial?: { price: number | null; changePct24h: number | null }): LivePriceState {
  const entry = useLivePriceStore((s) => (instrumentId ? s.byId[instrumentId] : undefined));

  useEffect(() => {
    if (!instrumentId) return;
    subscribeLivePrice(instrumentId);
    return () => unsubscribeLivePrice(instrumentId);
  }, [instrumentId]);

  return useMemo(() => {
    if (entry) return entry;
    return { ...EMPTY, price: initial?.price ?? null, changePct24h: initial?.changePct24h ?? null };
  }, [entry, initial?.price, initial?.changePct24h]);
}
