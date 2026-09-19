import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export interface ToastState {
  id: number;
  title: string;
  message?: string;
  variant: ToastVariant;
}

interface ToastStoreState {
  toast: ToastState | null;
  show: (title: string, message?: string, variant?: ToastVariant) => void;
  dismiss: () => void;
}

let counter = 0;

export const useToastStore = create<ToastStoreState>((set) => ({
  toast: null,
  show: (title, message, variant = "info") => set({ toast: { id: ++counter, title, message, variant } }),
  dismiss: () => set({ toast: null }),
}));
