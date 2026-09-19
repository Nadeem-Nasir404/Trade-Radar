"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "../client";
import { queryKeys } from "../query-keys";
import type { User } from "../types";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.get<User>("/users/me"),
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<{ user: User }>("/auth/login", input, { skipAuthRetry: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data.user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string; name?: string }) =>
      api.post<{ user: User }>("/auth/register", input, { skipAuthRetry: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data.user);
    },
  });
}

export function useRequestMagicLink() {
  return useMutation({
    mutationFn: (email: string) => api.post<{ message: string }>("/auth/magic-link/request", { email }),
  });
}

export function useVerifyMagicLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.post<{ user: User }>("/auth/magic-link/verify", { token }, { skipAuthRetry: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.me, data.user);
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name?: string; timezone?: string; currency?: string }) => api.patch<User>("/users/me", input),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.me, user);
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't update profile"),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
