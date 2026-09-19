"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetTitle, BottomSheetDescription } from "@/components/ui/bottom-sheet";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useAlertDraftStore } from "@/lib/stores/alert-draft-store";
import { CreateAlertForm } from "./create-alert-form";

/** Mounted once near the app root. Opens whenever useAlertDraftStore's `startDraft` is called -
 *  from a chart click, a "+ Create Alert" button, or the mobile FAB. */
export function CreateAlertDialog() {
  const isDesktop = useIsDesktop();
  const { draft, open, clearDraft } = useAlertDraftStore();

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(next) => !next && clearDraft()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Alert</DialogTitle>
            <DialogDescription>You&apos;ll be notified the moment this level is hit.</DialogDescription>
          </DialogHeader>
          {draft && (
            <CreateAlertForm
              instrumentId={draft.instrumentId}
              symbol={draft.symbol}
              defaultTargetValue={draft.targetValue}
              defaultConditionType={draft.conditionType}
              onSuccess={clearDraft}
            />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <BottomSheet open={open} onOpenChange={(next) => !next && clearDraft()}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>Create Alert</BottomSheetTitle>
          <BottomSheetDescription>You&apos;ll be notified the moment this level is hit.</BottomSheetDescription>
        </BottomSheetHeader>
        {draft && (
          <CreateAlertForm
            instrumentId={draft.instrumentId}
            symbol={draft.symbol}
            defaultTargetValue={draft.targetValue}
            defaultConditionType={draft.conditionType}
            onSuccess={clearDraft}
          />
        )}
      </BottomSheetContent>
    </BottomSheet>
  );
}
