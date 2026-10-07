import { useMemo } from "react";
import type { Alert, Instrument } from "@/lib/api/types";
import { useDeleteAlert, useMoveAlert } from "@/lib/api/hooks/use-alerts";
import { chartAlertLevels, conditionForLevel } from "@/lib/alert-lines";
import { useLivePriceStore } from "@/lib/ws/live-price-store";
import { useToastStore } from "@/lib/stores/toast-store";

/**
 * A coin's alerts as chart lines, plus what dragging (move) and swiping (delete) a line does.
 * Shared by the coin screen and the fullscreen chart so both behave the same.
 */
export function useChartAlerts(instrument: Instrument | undefined, alerts: Alert[] | undefined) {
  const instrumentAlerts = useMemo(() => (alerts ?? []).filter((a) => a.instrumentId === instrument?.id), [alerts, instrument?.id]);
  const levels = useMemo(() => chartAlertLevels(instrumentAlerts), [instrumentAlerts]);
  const moveAlert = useMoveAlert();
  const deleteAlert = useDeleteAlert();
  const showToast = useToastStore((s) => s.show);

  // The direction follows which side of the live price the line lands on.
  const onAlertMove = (id: string, price: number) => {
    const alert = instrumentAlerts.find((a) => a.id === id);
    if (!alert || !instrument) return;
    const current = useLivePriceStore.getState().byId[instrument.id]?.price ?? instrument.price ?? null;
    moveAlert.mutate(
      { id, targetValue: price, conditionType: conditionForLevel(alert.conditionType, price, current) },
      { onError: (err) => showToast("Could not move the alert", (err as Error).message, "error") },
    );
  };

  const onAlertDelete = (id: string) => {
    deleteAlert.mutate(id, {
      onSuccess: () => showToast("Alert deleted", undefined, "success"),
      onError: (err) => showToast("Could not delete the alert", (err as Error).message, "error"),
    });
  };

  return { instrumentAlerts, levels, onAlertMove, onAlertDelete };
}
