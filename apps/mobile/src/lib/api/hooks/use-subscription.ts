import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { queryKeys } from "../query-keys";
import type { PlanDefinition, Subscription } from "../types";

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
