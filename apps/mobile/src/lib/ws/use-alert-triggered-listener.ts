import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WS_EVENTS, type AlertTriggeredEvent } from "@levelpulse/shared-types";
import { getSocket } from "./socket";
import { formatCompactPrice } from "@/lib/format";
import { scheduleLocalNotification } from "@/lib/safe-notifications";
import { useToastStore } from "@/lib/stores/toast-store";
import { haptics } from "@/lib/haptics";

/**
 * Mounted once at the authenticated app root. While the app is foregrounded, a WS push tells us
 * an alert fired and we show a local notification + invalidate queries (push signals, pull
 * fetches the authoritative record - same pattern as the web app).
 *
 * NOTE: this only covers the app-foregrounded case. Real background/killed-app delivery needs
 * server-side FCM (Android) / APNs (iOS) push, which requires real Firebase + Apple Developer
 * credentials - intentionally stubbed for this pass (see mobile README).
 */
export function useAlertTriggeredListener() {
  const queryClient = useQueryClient();
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    getSocket().then((socket) => {
      if (cancelled) return;

      const onTriggered = (payload: AlertTriggeredEvent) => {
        const title = `🔔 ${payload.symbol} ${describeCondition(payload.conditionType)}`;
        const body = `Observed at ${formatCompactPrice(Number(payload.observedPrice))}`;

        // Always show the celebratory in-app toast (works everywhere, including Expo Go) and
        // additionally fire a real OS notification when the native module is available (real
        // build / iOS Expo Go) so it's also visible if the app is backgrounded.
        haptics.success();
        showToast(title, body, "success");
        scheduleLocalNotification(title, body, {
          symbol: payload.symbol.replace("/", ""),
          instrumentId: payload.instrumentId,
          price: String(payload.observedPrice),
          condition: payload.conditionType,
          target: String(payload.targetValue),
        });

        queryClient.invalidateQueries({ queryKey: ["alerts"] });
        queryClient.invalidateQueries({ queryKey: ["alert-events"] });
      };

      socket.on(WS_EVENTS.ALERT_TRIGGERED, onTriggered);
      unsubscribe = () => socket.off(WS_EVENTS.ALERT_TRIGGERED, onTriggered);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient, showToast]);
}

function describeCondition(conditionType: string): string {
  switch (conditionType) {
    case "ABOVE":
      return "is above your target";
    case "BELOW":
      return "is below your target";
    case "CROSSES_ABOVE":
      return "crossed above your target";
    case "CROSSES_BELOW":
      return "crossed below your target";
    case "EQUALS":
      return "hit your target";
    case "ENTERS_RANGE":
      return "entered your range";
    case "EXITS_RANGE":
      return "exited your range";
    default:
      return "moved to your target";
  }
}
