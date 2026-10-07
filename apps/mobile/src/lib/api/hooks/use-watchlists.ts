import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../query-keys";
import type { Watchlist, WatchlistItem } from "../types";

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

function favoritesList(watchlists: Watchlist[] | undefined): Watchlist | undefined {
  return watchlists?.find((w) => w.isDefault) ?? watchlists?.[0];
}

interface FavoriteToggle {
  instrumentId: string;
  /** The item to remove, read from the cache before the optimistic flip; undefined means add. */
  existingItemId?: string;
}

/**
 * One-tap favorite toggle: adds to (or removes from) the user's default watchlist, creating one
 * only if they truly have none. The star flips immediately and rolls back if the request fails.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ instrumentId, existingItemId }: FavoriteToggle) => {
      // Read the server's lists if they aren't cached yet - an empty cache must not be mistaken
      // for "no watchlists" and create a duplicate list.
      const watchlists = await queryClient.ensureQueryData({
        queryKey: queryKeys.watchlists,
        queryFn: () => api.get<Watchlist[]>("/watchlists"),
      });
      const list = favoritesList(watchlists);
      if (!list) {
        const created = await api.post<Watchlist>("/watchlists", { name: "My Watchlist" });
        await api.post(`/watchlists/${created.id}/items`, { instrumentId });
        return { added: true };
      }
      if (existingItemId) {
        let itemId = existingItemId;
        // Removed before the add that created it finished: look up the item's real id.
        if (itemId.startsWith("pending-")) {
          const fresh = favoritesList(await api.get<Watchlist[]>("/watchlists"));
          const found = fresh?.items.find((i) => i.instrumentId === instrumentId);
          if (!found) return { added: false };
          itemId = found.id;
        }
        await api.delete(`/watchlists/${list.id}/items/${itemId}`);
        return { added: false };
      }
      await api.post(`/watchlists/${list.id}/items`, { instrumentId });
      return { added: true };
    },
    onMutate: async ({ instrumentId, existingItemId }: FavoriteToggle) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.watchlists });
      const previous = queryClient.getQueryData<Watchlist[]>(queryKeys.watchlists);
      const list = favoritesList(previous);
      if (previous && list) {
        const items = existingItemId
          ? list.items.filter((i) => i.instrumentId !== instrumentId)
          : [...list.items, { id: `pending-${instrumentId}`, instrumentId, sortOrder: list.items.length } as WatchlistItem];
        queryClient.setQueryData<Watchlist[]>(queryKeys.watchlists, previous.map((w) => (w.id === list.id ? { ...w, items } : w)));
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.watchlists, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlists }),
  });

  return {
    ...mutation,
    /** Toggles `instrumentId`, deciding add vs. remove from what the user sees right now. */
    mutate: (instrumentId: string) => {
      const item = favoritesList(queryClient.getQueryData<Watchlist[]>(queryKeys.watchlists))?.items.find(
        (i) => i.instrumentId === instrumentId,
      );
      mutation.mutate({ instrumentId, existingItemId: item?.id });
    },
  };
}
