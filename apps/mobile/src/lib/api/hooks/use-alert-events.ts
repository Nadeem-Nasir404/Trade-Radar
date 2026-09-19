import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../query-keys";
import type { AlertEvent } from "../types";

export interface AlertEventFilters {
  instrumentId?: string;
  alertId?: string;
}

export function useAlertEvents(filters: AlertEventFilters = {}) {
  const params = new URLSearchParams();
  if (filters.instrumentId) params.set("instrumentId", filters.instrumentId);
  if (filters.alertId) params.set("alertId", filters.alertId);

  return useQuery({
    queryKey: queryKeys.alertEvents(filters),
    queryFn: () => api.get<{ items: AlertEvent[]; nextCursor: string | null }>(`/alert-events?${params.toString()}`),
  });
}
