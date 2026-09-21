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
  background: "#120E1B",
  backgroundElevated: "#1A1428",
  foreground: "#F5F3FA",
  foregroundMuted: "#A79FBD",
  foregroundSubtle: "#7A7390",

  glass: "rgba(255,255,255,0.055)",
  glassHover: "rgba(255,255,255,0.09)",
  glassBorder: "rgba(255,255,255,0.10)",
  glassBorderStrong: "rgba(255,255,255,0.16)",

  brand: "#A78BFA",
  brandForeground: "#ffffff",
  brandGlow: "rgba(167,139,250,0.40)",
  brandGradientEnd: "#7C3AED",

  positive: "#4ADE80",
  negative: "#F87171",
  warning: "#FBBF24",
  neutral: "#A79FBD",

  blurTint: "dark",
  statusBarStyle: "light",
};

export const lightTheme: ThemeColors = {
  background: "#F3EFFB",
  backgroundElevated: "#FAF8FD",
  foreground: "#1A1625",
  foregroundMuted: "#6B647D",
  foregroundSubtle: "#8A8299",

  glass: "rgba(255,255,255,0.55)",
  glassHover: "rgba(255,255,255,0.7)",
  glassBorder: "rgba(255,255,255,0.75)",
  glassBorderStrong: "rgba(255,255,255,0.9)",

  brand: "#7C3AED",
  brandForeground: "#ffffff",
  brandGlow: "rgba(139,92,246,0.35)",
  brandGradientEnd: "#6D28D9",

  positive: "#16A34A",
  negative: "#DC2626",
  warning: "#D97706",
  neutral: "#6B647D",

  blurTint: "light",
  statusBarStyle: "dark",
};
