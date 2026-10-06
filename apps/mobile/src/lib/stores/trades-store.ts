import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type TradeSide = "LONG" | "SHORT";

export interface Trade {
  id: string;
  symbol: string;
  instrumentId: string;
  side: TradeSide;
  entryPrice: number;
  exitPrice: number | null;
  openedAt: number;
  closedAt: number | null;
}

interface TradesState {
  trades: Trade[];
  open: (t: Omit<Trade, "id" | "exitPrice" | "closedAt" | "openedAt">) => string;
  close: (id: string, exitPrice: number) => void;
}

export const useTradesStore = create<TradesState>()(
  persist(
    (set) => ({
      trades: [],
      open: (t) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({ trades: [{ ...t, id, exitPrice: null, openedAt: Date.now(), closedAt: null }, ...s.trades].slice(0, 100) }));
        return id;
      },
      close: (id, exitPrice) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, exitPrice, closedAt: Date.now() } : t)),
        })),
    }),
    { name: "lp-trades", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Percentage return for a side, from entry to a given price. */
export function pnlPct(side: TradeSide, entry: number, price: number): number {
  if (!entry) return 0;
  const raw = ((price - entry) / entry) * 100;
  return side === "LONG" ? raw : -raw;
}
