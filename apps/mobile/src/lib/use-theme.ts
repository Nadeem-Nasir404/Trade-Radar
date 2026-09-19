import { useColorScheme } from "react-native";
import { useThemeStore, type ThemeMode } from "./stores/theme-store";
import { darkTheme, lightTheme, type ThemeColors } from "./themes";

export interface UseThemeResult {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedScheme: "light" | "dark";
  colors: ThemeColors;
  isDark: boolean;
}

export function useTheme(): UseThemeResult {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const systemScheme = useColorScheme();

  const resolvedScheme = mode === "system" ? (systemScheme === "light" ? "light" : "dark") : mode;
  const colors = resolvedScheme === "light" ? lightTheme : darkTheme;

  return { mode, setMode, resolvedScheme, colors, isDark: resolvedScheme === "dark" };
}
