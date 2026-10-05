import { useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
const CACHED_USER_KEY = "lp_cached_user";
const VERIFY_TIMEOUT_MS = 8000;

async function readCachedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function cacheUser(user: User): void {
  AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user)).catch(() => undefined);
}

async function clearCachedUser(): Promise<void> {
  await AsyncStorage.removeItem(CACHED_USER_KEY).catch(() => undefined);
}

/**
 * Restores the session without making the user wait on the network. A cached user lets the app
 * open immediately while the session is verified in the background; only a real 401 signs the
 * user out - a slow or unreachable server (free-tier cold starts) keeps them signed in.
 */
export async function bootstrapAuth(): Promise<User | null> {
  const accessToken = await tokenStore.getAccessToken();
  if (!accessToken) return null;

  const cached = await readCachedUser();
  const verify = api.get<User>("/users/me").then(
    (user) => {
      cacheUser(user);
      return user;
    },
    async (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        await tokenStore.clear();
        await clearCachedUser();
        useAuthStore.getState().setUnauthenticated();
        return null;
      }
      return cached;
    },
  );

  if (cached) {
    verify.then((user) => {
      if (user && user !== cached) useAuthStore.getState().setAuthenticated(user);
    });
    return cached;
  }

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), VERIFY_TIMEOUT_MS));
  return Promise.race([verify, timeout]);
}

export function useLogin() {
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<AuthResponse>("/auth/login", input, { skipAuthRetry: true }),
    onSuccess: async (data) => {
      await tokenStore.setTokens(data.accessToken, data.refreshToken);
      cacheUser(data.user);
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
      cacheUser(data.user);
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
      await clearCachedUser();
      setUnauthenticated();
      queryClient.clear();
    },
  });
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
