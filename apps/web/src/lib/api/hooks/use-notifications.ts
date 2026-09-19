"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "../client";
import { queryKeys } from "../query-keys";
import type { NotificationChannel } from "../types";
import type { NotificationChannelType } from "@levelpulse/shared-types";

export function useNotificationChannels() {
  return useQuery({
    queryKey: queryKeys.notificationChannels,
    queryFn: () => api.get<NotificationChannel[]>("/notifications/channels"),
  });
}

export function useConnectDiscord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (webhookUrl: string) => api.post("/notifications/discord/connect", { webhookUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationChannels });
      toast.success("Discord connected");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't connect Discord"),
  });
}

export function useToggleEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isEnabled: boolean) => api.post("/notifications/email/toggle", { isEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationChannels }),
  });
}

export function useRequestTelegramLink() {
  return useMutation({
    mutationFn: () => api.post<{ code: string; deepLink: string }>("/notifications/telegram/link"),
  });
}

export function useDisconnectChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type: NotificationChannelType) => api.delete(`/notifications/channels/${type}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationChannels });
      toast("Channel disconnected");
    },
  });
}

export function useSendTestNotification() {
  return useMutation({
    mutationFn: (channelType: NotificationChannelType) => api.post<{ message: string }>("/notifications/test", { channelType }),
    onSuccess: (result) => toast.success(result.message),
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't send test notification"),
  });
}
