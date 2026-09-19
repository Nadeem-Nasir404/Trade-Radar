import { create } from "zustand";
import type { ConditionType } from "@levelpulse/shared-types";

export interface AlertDraft {
  instrumentId: string;
  symbol: string;
  targetValue: number;
  conditionType?: ConditionType;
}

interface AlertDraftState {
  draft: AlertDraft | null;
  open: boolean;
  startDraft: (draft: AlertDraft) => void;
  clearDraft: () => void;
}

export const useAlertDraftStore = create<AlertDraftState>((set) => ({
  draft: null,
  open: false,
  startDraft: (draft) => set({ draft, open: true }),
  clearDraft: () => set({ draft: null, open: false }),
}));
