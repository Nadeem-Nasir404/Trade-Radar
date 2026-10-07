import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const CANDLE_PALETTES = {
  classic: { label: "Classic", up: "#22c55e", down: "#f43f5e" },
  ocean: { label: "Ocean", up: "#38bdf8", down: "#fb7185" },
  lime: { label: "Lime", up: "#c6f432", down: "#ff4d4d" },
  violet: { label: "Violet", up: "#a78bfa", down: "#f472b6" },
} as const;
export type CandlePalette = keyof typeof CANDLE_PALETTES;

interface ChartSettingsState {
  palette: CandlePalette;
  showGrid: boolean;
  showVolume: boolean;
  showWicks: boolean;
  set: (patch: Partial<Omit<ChartSettingsState, "set">>) => void;
}

export const useChartSettings = create<ChartSettingsState>()(
  persist(
    (set) => ({
      palette: "classic",
      showGrid: true,
      showVolume: true,
      showWicks: true,
      set: (patch) => set(patch),
    }),
    {
      name: "lp-chart-settings",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ palette: s.palette, showGrid: s.showGrid, showVolume: s.showVolume, showWicks: s.showWicks }),
    },
  ),
);
