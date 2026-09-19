import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../client";
import { tokenStore } from "../token-store";
import { useAuthStore } from "../../stores/auth-store";
import type { User } from "../types";

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/** Called once at app boot: if secure-store has a token, validate it against /auth/me. */
export async function bootstrapAuth(): Promise<User | null> {
  const accessToken = await tokenStore.getAccessToken();
  if (!accessToken) return null;
  try {
    return await api.get<User>("/users/me");
  } catch {
    await tokenStore.clear();
    return null;
  }
}

export function useLogin() {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<AuthResponse>("/auth/login", input, { skipAuthRetry: true }),
    onSuccess: async (data) => {
      await tokenStore.setTokens(data.accessToken, data.refreshToken);
      setAuthenticated(data.user);
    },
  });
}

export function useRegister() {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  return useMutation({
    mutationFn: (input: { email: string; password: string; name?: string }) =>
      api.post<AuthResponse>("/auth/register", input, { skipAuthRetry: true }),
    onSuccess: async (data) => {
      await tokenStore.setTokens(data.accessToken, data.refreshToken);
      setAuthenticated(data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const setUnauthenticated = useAuthStore((s) => s.setUnauthenticated);
  return useMutation({
    mutationFn: async () => {
      const refreshToken = await tokenStore.getRefreshToken();
      await api.post("/auth/logout", { refreshToken });
    },
    onSettled: async () => {
      await tokenStore.clear();
      setUnauthenticated();
      queryClient.clear();
    },
  });
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
