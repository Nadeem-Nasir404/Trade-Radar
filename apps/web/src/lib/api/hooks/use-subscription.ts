"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "../client";
import { queryKeys } from "../query-keys";
import type { PlanDefinition, Subscription } from "../types";
import type { PlanTier } from "@levelpulse/shared-types";

export function useSubscription() {
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: () => api.get<Subscription>("/subscription"),
  });
}

export function usePlans() {
  return useQuery({
    queryKey: queryKeys.plans,
    queryFn: () => api.get<PlanDefinition[]>("/subscription/plans"),
    staleTime: 5 * 60_000,
  });
}

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (plan: PlanTier) => api.post<Subscription>("/subscription/checkout", { plan }),
    onSuccess: (sub) => {
      queryClient.setQueryData(queryKeys.subscription, sub);
      toast.success(`Upgraded to ${sub.plan}`);
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Checkout isn't available yet"),
  });
}
