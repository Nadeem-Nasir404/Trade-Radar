"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export interface AdminDashboard {
  totalUsers: number;
  activeAlerts: number;
  triggeredToday: number;
  failedNotifications: number;
  providers: Array<{ provider: string; connected: boolean; latencyMs: number | null; subscribedSymbols: number; lastMessageAt: number | null; reconnectCount: number }>;
  queueDepths: Record<string, number>;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isSuspended: boolean;
  createdAt: string;
  subscription: { plan: string } | null;
  _count: { alerts: number };
}

export interface AdminProvider {
  id: string;
  name: string;
  type: string;
  isEnabled: boolean;
  priority: number;
}

export interface AdminInstrument {
  id: string;
  symbol: string;
  displaySymbol: string;
  assetType: string;
  isActive: boolean;
  provider: { name: string };
}

export interface SystemEvent {
  id: string;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
}

export function useAdminDashboard() {
  return useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => api.get<AdminDashboard>("/admin/dashboard"), refetchInterval: 10_000 });
}

export function useAdminUsers(search?: string) {
  return useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => api.get<AdminUser[]>(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.patch(`/admin/users/${id}/suspend`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useUnsuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/unsuspend`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useAdminProviders() {
  return useQuery({ queryKey: ["admin", "providers"], queryFn: () => api.get<AdminProvider[]>("/admin/providers") });
}

export function useSetProviderEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) => api.patch(`/admin/providers/${id}`, { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "providers"] }),
  });
}

export function useAdminInstruments() {
  return useQuery({ queryKey: ["admin", "instruments"], queryFn: () => api.get<AdminInstrument[]>("/admin/instruments") });
}

export function useSetInstrumentActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/admin/instruments/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "instruments"] }),
  });
}

export function useAdminLogs() {
  return useQuery({ queryKey: ["admin", "logs"], queryFn: () => api.get<SystemEvent[]>("/admin/logs") });
}
