import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_CARD_STYLE, isCardStyle, type CardStyle } from "@/lib/card-layout";

export type { CardStyle };
export type TradeSide = "LONG" | "SHORT";

export interface Trade {
  id: string;
  symbol: string;
  instrumentId: string;
  side: TradeSide;
  entryPrice: number;
  exitPrice: number | null;
  /** Position size in USD (spot-style notional). Null when the user did not enter one. */
  sizeUsd: number | null;
  openedAt: number;
  closedAt: number | null;
}

interface TradesState {
  trades: Trade[];
  cardStyle: CardStyle;
  setCardStyle: (s: CardStyle) => void;
  open: (t: Omit<Trade, "id" | "exitPrice" | "closedAt" | "openedAt" | "sizeUsd"> & { sizeUsd?: number | null }) => string;
  /** Journal entry logged by hand; pass an exit price to record it as already closed. */
  add: (t: NewTrade) => string;
  close: (id: string, exitPrice: number) => void;
  remove: (id: string) => void;
}

export type NewTrade = Pick<Trade, "symbol" | "instrumentId" | "side" | "entryPrice"> & {
  exitPrice?: number | null;
  sizeUsd?: number | null;
};

export const useTradesStore = create<TradesState>()(
  persist(
    (set) => ({
      trades: [],
      cardStyle: DEFAULT_CARD_STYLE,
      setCardStyle: (cardStyle) => set({ cardStyle }),
      open: (t) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({ trades: [{ ...t, id, sizeUsd: t.sizeUsd ?? null, exitPrice: null, openedAt: Date.now(), closedAt: null }, ...s.trades].slice(0, 100) }));
        return id;
      },
      add: (t) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();
        const exitPrice = t.exitPrice ?? null;
        const trade: Trade = {
          id,
          symbol: t.symbol,
          instrumentId: t.instrumentId,
          side: t.side,
          entryPrice: t.entryPrice,
          exitPrice,
          sizeUsd: t.sizeUsd ?? null,
          openedAt: now,
          closedAt: exitPrice != null ? now : null,
        };
        set((s) => ({ trades: [trade, ...s.trades].slice(0, 100) }));
        return id;
      },
      close: (id, exitPrice) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === id ? { ...t, exitPrice, closedAt: Date.now() } : t)),
        })),
      remove: (id) => set((s) => ({ trades: s.trades.filter((t) => t.id !== id) })),
    }),
    {
      name: "lp-trades",
      storage: createJSONStorage(() => AsyncStorage),
      // A saved style that no longer exists (e.g. the retired Neon/Bold/Grid/Gradient) falls back to the default.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<TradesState>;
        return { ...current, ...saved, cardStyle: isCardStyle(saved.cardStyle) ? saved.cardStyle : DEFAULT_CARD_STYLE };
      },
    },
  ),
);

/** Percentage return for a side, from entry to a given price. */
export function pnlPct(side: TradeSide, entry: number, price: number): number {
  if (!entry) return 0;
  const raw = ((price - entry) / entry) * 100;
  return side === "LONG" ? raw : -raw;
}
