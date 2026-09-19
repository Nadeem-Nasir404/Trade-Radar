"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function useWebPushSubscribe() {
  const queryClient = useQueryClient();
  const [isSubscribing, setIsSubscribing] = useState(false);

  const subscribe = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Push notifications aren't supported in this browser");
      return;
    }
    setIsSubscribing(true);
    try {
      const { publicKey } = await api.get<{ publicKey: string | null }>("/notifications/webpush/vapid-public-key");
      if (!publicKey) {
        toast.error("Web push isn't configured on this server yet");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = subscription.toJSON();
      await api.post("/notifications/webpush/subscribe", { endpoint: json.endpoint, keys: json.keys });
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationChannels });
      toast.success("Browser notifications enabled");
    } catch {
      toast.error("Couldn't enable browser notifications");
    } finally {
      setIsSubscribing(false);
    }
  };

  return { subscribe, isSubscribing };
}
