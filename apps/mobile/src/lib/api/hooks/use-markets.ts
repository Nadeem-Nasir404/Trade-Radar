import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../query-keys";
import type { Candle, CoinGeckoSearchResult, Instrument } from "../types";

export interface MarketFilters {
  assetType?: string;
  search?: string;
  limit?: number;
}

export function useMarkets(filters: MarketFilters = {}, options: { enabled?: boolean } = {}) {
  const params = new URLSearchParams();
  if (filters.assetType) params.set("assetType", filters.assetType);
  if (filters.search) params.set("search", filters.search);
  if (filters.limit) params.set("limit", String(filters.limit));

  return useQuery({
    queryKey: queryKeys.markets(filters),
    queryFn: () => api.get<Instrument[]>(`/markets?${params.toString()}`),
    staleTime: 30_000,
    enabled: options.enabled ?? true,
  });
}

export function useMarket(symbol: string | undefined) {
  return useQuery({
    queryKey: queryKeys.market(symbol ?? ""),
    queryFn: () => api.get<Instrument>(`/markets/${symbol}`),
    enabled: Boolean(symbol),
    staleTime: 15_000,
  });
}

export function useMarketHistory(symbol: string | undefined, timeframe: string) {
  return useQuery({
    queryKey: queryKeys.marketHistory(symbol ?? "", timeframe),
    queryFn: () => api.get<Candle[]>(`/markets/${symbol}/history?timeframe=${timeframe}`),
    enabled: Boolean(symbol),
    staleTime: 30_000,
  });
}

export function useDiscoverMarkets(q: string) {
  return useQuery({
    queryKey: queryKeys.discover(q),
    queryFn: () => api.get<CoinGeckoSearchResult[]>(`/markets/discover?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
    staleTime: 60_000,
  });
}
