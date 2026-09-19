import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import type { NotificationChannel } from "../types";

const CHANNELS_KEY = ["notification-channels"];

export function useNotificationChannels() {
  return useQuery({
    queryKey: CHANNELS_KEY,
    queryFn: () => api.get<NotificationChannel[]>("/notifications/channels"),
  });
}

export function useToggleEmailChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isEnabled: boolean) => api.post<NotificationChannel>("/notifications/email/toggle", { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHANNELS_KEY }),
  });
}

export function useRegisterExpoPushToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.post<{ success: boolean }>("/notifications/expo-push/register", { token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHANNELS_KEY }),
  });
}
