import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ChartPoint {
  time: number;
  price: number;
}

export type Drawing =
  | { id: string; type: "horizontal"; price: number }
  /** One anchor: a ray running right from it, or a line through its candle. */
  | { id: string; type: "hray" | "vline"; a: ChartPoint }
  /** Two anchors: start and end. */
  | { id: string; type: "trend" | "ray" | "rect" | "fib" | "measure"; a: ChartPoint; b: ChartPoint };

interface DrawingsState {
  /** Drawings keyed by instrument symbol, so the market screen and full-screen chart share them. */
  bySymbol: Record<string, Drawing[]>;
  add: (key: string, drawing: Drawing) => void;
  clear: (key: string) => void;
  removeLast: (key: string) => void;
}

export const useDrawingsStore = create<DrawingsState>()(
  persist(
    (set) => ({
      bySymbol: {},
      add: (key, drawing) =>
        set((s) => ({ bySymbol: { ...s.bySymbol, [key]: [...(s.bySymbol[key] ?? []), drawing] } })),
      clear: (key) => set((s) => ({ bySymbol: { ...s.bySymbol, [key]: [] } })),
      removeLast: (key) => set((s) => ({ bySymbol: { ...s.bySymbol, [key]: (s.bySymbol[key] ?? []).slice(0, -1) } })),
    }),
    {
      name: "lp-chart-drawings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function newDrawingId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
