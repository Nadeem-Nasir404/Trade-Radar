"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WS_EVENTS, type AlertTriggeredEvent } from "@levelpulse/shared-types";
import { getSocket } from "./socket";
import { formatCompactPrice } from "@/lib/utils";

/** Mounted once at the authenticated app shell - the WS "push" tells us something changed,
 *  the query invalidation "pulls" the authoritative record, per the app's push/pull split. */
export function useAlertTriggeredListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const onTriggered = (payload: AlertTriggeredEvent) => {
      toast(`🔔 ${payload.symbol} ${describeCondition(payload.conditionType)}`, {
        description: `Observed at ${formatCompactPrice(Number(payload.observedPrice))}`,
      });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert-events"] });
    };

    socket.on(WS_EVENTS.ALERT_TRIGGERED, onTriggered);
    return () => {
      socket.off(WS_EVENTS.ALERT_TRIGGERED, onTriggered);
    };
  }, [queryClient]);
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
