import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../query-keys";
import type { Watchlist } from "../types";

export function useWatchlists() {
  return useQuery({
    queryKey: queryKeys.watchlists,
    queryFn: () => api.get<Watchlist[]>("/watchlists"),
    staleTime: 15_000,
  });
}

export function useCreateWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<Watchlist>("/watchlists", { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlists }),
  });
}

export function useDeleteWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (watchlistId: string) => api.delete(`/watchlists/${watchlistId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlists }),
  });
}

export function useAddWatchlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ watchlistId, instrumentId }: { watchlistId: string; instrumentId: string }) =>
      api.post(`/watchlists/${watchlistId}/items`, { instrumentId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlists }),
  });
}

export function useRemoveWatchlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ watchlistId, itemId }: { watchlistId: string; itemId: string }) =>
      api.delete(`/watchlists/${watchlistId}/items/${itemId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlists }),
  });
}

/** True if `instrumentId` is in the user's default (or first) watchlist. */
export function useIsFavorite(instrumentId: string | undefined): boolean {
  const { data: watchlists } = useWatchlists();
  if (!instrumentId) return false;
  const list = watchlists?.find((w) => w.isDefault) ?? watchlists?.[0];
  return list?.items.some((i) => i.instrumentId === instrumentId) ?? false;
}

/**
 * One-tap favorite toggle for list rows that don't want to deal with "which watchlist" - adds to
 * (or removes from) the user's default watchlist, creating one on first use if they somehow have
 * none yet (e.g. deleted their only list).
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (instrumentId: string) => {
      const watchlists = queryClient.getQueryData<Watchlist[]>(queryKeys.watchlists) ?? [];
      let list = watchlists.find((w) => w.isDefault) ?? watchlists[0];

      if (!list) {
        const created = await api.post<Watchlist>("/watchlists", { name: "My Watchlist" });
        await api.post(`/watchlists/${created.id}/items`, { instrumentId });
        return { added: true };
      }

      const existingItem = list.items.find((i) => i.instrumentId === instrumentId);
      if (existingItem) {
        await api.delete(`/watchlists/${list.id}/items/${existingItem.id}`);
        return { added: false };
      }
      await api.post(`/watchlists/${list.id}/items`, { instrumentId });
      return { added: true };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlists }),
  });
}
