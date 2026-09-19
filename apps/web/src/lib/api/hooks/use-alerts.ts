"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "../client";
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
    onSuccess: (alert) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success(`🔔 ${alert.symbol} alert created`, {
        description: `${alert.conditionType.replace(/_/g, " ").toLowerCase()} ${alert.targetValue}`,
      });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create alert");
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<CreateAlertInput> & { id: string }) => api.patch<Alert>(`/alerts/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert updated");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't update alert"),
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast("Alert deleted");
    },
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
    onError: (error, _id, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(error instanceof ApiError ? error.message : `Couldn't ${action} alert`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
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
    onSuccess: (alert) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success(`Cloned to ${alert.symbol}`);
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't clone alert"),
  });
}

export function useAlertGroups() {
  return useQuery({
    queryKey: queryKeys.alertGroups,
    queryFn: () => api.get<AlertGroup[]>("/alerts/groups"),
  });
}

export function useCreateAlertGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<AlertGroup>("/alerts/groups", { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.alertGroups }),
  });
}

export function useSetGroupPaused() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      api.post<{ affectedAlerts: number }>(`/alerts/groups/${id}/${paused ? "pause" : "resume"}`),
    onSuccess: (result, { paused }) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.alertGroups });
      toast.success(`${result.affectedAlerts} alerts ${paused ? "paused" : "resumed"}`);
    },
  });
}
