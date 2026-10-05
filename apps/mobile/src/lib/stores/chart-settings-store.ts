import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PriceScaleStyle = "normal" | "log" | "percent";

export const CANDLE_PALETTES = {
  classic: { up: "#22c55e", down: "#f43f5e" },
  mono: { up: "#e4e4e7", down: "#71717a" },
  ocean: { up: "#38bdf8", down: "#fb7185" },
} as const;
export type CandlePalette = keyof typeof CANDLE_PALETTES;

interface ChartSettingsState {
  palette: CandlePalette;
  showGrid: boolean;
  showVolume: boolean;
  showWicks: boolean;
  priceScale: PriceScaleStyle;
  set: (patch: Partial<Omit<ChartSettingsState, "set">>) => void;
}

export const useChartSettings = create<ChartSettingsState>()(
  persist(
    (set) => ({
      palette: "classic",
      showGrid: true,
      showVolume: true,
      showWicks: true,
      priceScale: "normal",
      set: (patch) => set(patch),
    }),
    {
      name: "lp-chart-settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ palette: s.palette, showGrid: s.showGrid, showVolume: s.showVolume, showWicks: s.showWicks, priceScale: s.priceScale }),
    },
  ),
);
