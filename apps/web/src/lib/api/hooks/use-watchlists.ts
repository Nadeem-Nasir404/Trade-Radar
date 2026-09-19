"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "../client";
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlists });
      toast.success("Watchlist created");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't create watchlist"),
  });
}

export function useDeleteWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/watchlists/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlists }),
  });
}

export function useAddWatchlistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ watchlistId, instrumentId }: { watchlistId: string; instrumentId: string }) =>
      api.post(`/watchlists/${watchlistId}/items`, { instrumentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlists });
      toast.success("Added to watchlist");
    },
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

export function useReorderWatchlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ watchlistId, itemIdsInOrder }: { watchlistId: string; itemIdsInOrder: string[] }) =>
      api.post(`/watchlists/${watchlistId}/reorder`, { itemIdsInOrder }),
    onMutate: async ({ watchlistId, itemIdsInOrder }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.watchlists });
      const previous = queryClient.getQueryData<Watchlist[]>(queryKeys.watchlists);
      queryClient.setQueryData<Watchlist[]>(queryKeys.watchlists, (old) =>
        old?.map((w) =>
          w.id === watchlistId
            ? { ...w, items: itemIdsInOrder.map((id, i) => ({ ...w.items.find((it) => it.id === id)!, sortOrder: i })) }
            : w,
        ),
      );
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.watchlists, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlists }),
  });
}
