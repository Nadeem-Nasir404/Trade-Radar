export interface ThemeColors {
  background: string;
  backgroundElevated: string;
  foreground: string;
  foregroundMuted: string;
  foregroundSubtle: string;

  glass: string;
  glassHover: string;
  glassBorder: string;
  glassBorderStrong: string;

  /** Purple primary accent - used for the primary CTA/FAB gradient and focus states only, never decoratively. */
  brand: string;
  brandForeground: string;
  brandGlow: string;
  /** Second gradient stop paired with `brand`. */
  brandGradientEnd: string;

  positive: string;
  negative: string;
  warning: string;
  neutral: string;

  /** Tint passed to expo-blur's BlurView - "dark"/"light" match its own palette, not ours directly. */
  blurTint: "dark" | "light";
  statusBarStyle: "light" | "dark";
}

export const darkTheme: ThemeColors = {
  background: "#080808",
  backgroundElevated: "#0f0f0f",
  foreground: "#ffffff",
  foregroundMuted: "#a0a0a0",
  foregroundSubtle: "#6e6e73",

  glass: "rgba(255,255,255,0.05)",
  glassHover: "rgba(255,255,255,0.08)",
  glassBorder: "rgba(255,255,255,0.10)",
  glassBorderStrong: "rgba(255,255,255,0.16)",

  brand: "#a855f7",
  brandForeground: "#ffffff",
  brandGlow: "rgba(168,85,247,0.35)",
  brandGradientEnd: "#6d28d9",

  positive: "#30d158",
  negative: "#ff453a",
  warning: "#ffd60a",
  neutral: "#a0a0a0",

  blurTint: "dark",
  statusBarStyle: "light",
};

export const lightTheme: ThemeColors = {
  background: "#ffffff",
  backgroundElevated: "#fafafa",
  foreground: "#111014",
  foregroundMuted: "#5f5b6d",
  foregroundSubtle: "#8d8998",

  glass: "rgba(124,58,237,0.04)",
  glassHover: "rgba(124,58,237,0.07)",
  glassBorder: "rgba(88,28,135,0.10)",
  glassBorderStrong: "rgba(88,28,135,0.16)",

  brand: "#9333ea",
  brandForeground: "#ffffff",
  brandGlow: "rgba(147,51,234,0.22)",
  brandGradientEnd: "#6d28d9",

  positive: "#34c759",
  negative: "#ff3b30",
  warning: "#d97706",
  neutral: "#5f5b6d",

  blurTint: "light",
  statusBarStyle: "dark",
};
