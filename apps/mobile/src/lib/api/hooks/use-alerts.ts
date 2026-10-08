import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../query-keys";
import type { Alert, AlertGroup, ChannelPref } from "../types";
import type { ConditionType } from "@levelpulse/shared-types";

export interface AlertFilters {
  status?: string;
  assetType?: string;
  search?: string;
  sort?: "recent" | "nearest" | "recently_triggered" | "asset";
  alertGroupId?: string;
}

export function useAlerts(filters: AlertFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });

  return useQuery({
    queryKey: queryKeys.alerts(filters),
    queryFn: () => api.get<Alert[]>(`/alerts?${params.toString()}`),
    staleTime: 10_000,
  });
}

export function useAlert(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.alert(id ?? ""),
    queryFn: () => api.get<Alert>(`/alerts/${id}`),
    enabled: Boolean(id),
  });
}

export interface CreateAlertInput {
  instrumentId: string;
  conditionType: ConditionType;
  targetValue: number;
  secondaryValue?: number;
  timeframe?: string;
  isRecurring?: boolean;
  cooldownSeconds?: number;
  expiresAt?: string;
  notes?: string;
  tags?: string[];
  alertGroupId?: string;
  channels?: ChannelPref[];
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAlertInput) => api.post<Alert>("/alerts", input),
    // Not awaited: the form closes as soon as the server confirms; the lists refresh behind it.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CreateAlertInput> & { id: string }) => api.patch<Alert>(`/alerts/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

/**
 * Applies `update` to every cached alert list right away (the alert queries share the "alerts"
 * prefix) and returns what was there, so a failed request can put it back.
 */
async function patchCachedAlerts(queryClient: QueryClient, update: (alerts: Alert[]) => Alert[]) {
  await queryClient.cancelQueries({ queryKey: ["alerts"] });
  const previous = queryClient.getQueriesData<Alert[]>({ queryKey: ["alerts"] });
  queryClient.setQueriesData<Alert[]>({ queryKey: ["alerts"] }, (old) => (Array.isArray(old) ? update(old) : old));
  return previous;
}

function restoreCachedAlerts(queryClient: QueryClient, previous: [QueryKey, Alert[] | undefined][] | undefined) {
  previous?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

/** Deletes an alert, removing it from lists (and the chart) at once and restoring it if the request fails. */
export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/alerts/${id}`),
    onMutate: (id: string) => patchCachedAlerts(queryClient, (alerts) => alerts.filter((a) => a.id !== id)),
    onError: (_error, _id, previous) => restoreCachedAlerts(queryClient, previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

/**
 * Moves an alert's level (dragging its chart line). The direction may flip when the line crosses
 * the price; the new level shows at once and springs back if the request fails.
 */
export function useMoveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, targetValue, conditionType }: { id: string; targetValue: number; conditionType: ConditionType }) =>
      api.patch<Alert>(`/alerts/${id}`, { targetValue, conditionType }),
    onMutate: ({ id, targetValue, conditionType }) =>
      patchCachedAlerts(queryClient, (alerts) => alerts.map((a) => (a.id === id ? { ...a, targetValue, conditionType } : a))),
    onError: (_error, _input, previous) => restoreCachedAlerts(queryClient, previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

function useSetAlertStatus(action: "pause" | "resume") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Alert>(`/alerts/${id}/${action}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["alerts"] });
      const previous = queryClient.getQueriesData<Alert[]>({ queryKey: ["alerts"] });
      queryClient.setQueriesData<Alert[]>({ queryKey: ["alerts"] }, (old) =>
        old?.map((a) => (a.id === id ? { ...a, status: action === "pause" ? "PAUSED" : "ACTIVE" } : a)),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function usePauseAlert() {
  return useSetAlertStatus("pause");
}

export function useResumeAlert() {
  return useSetAlertStatus("resume");
}

export function useCloneAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Alert>(`/alerts/${id}/clone`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useAlertGroups() {
  return useQuery({
    queryKey: queryKeys.alertGroups,
    queryFn: () => api.get<AlertGroup[]>("/alerts/groups"),
  });
}
