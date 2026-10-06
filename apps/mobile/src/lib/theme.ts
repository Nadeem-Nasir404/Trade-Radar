// NOTE: static `colors` used to live here. It's now superseded by the runtime-switchable
// palette in ./themes.ts + the useTheme() hook - see MEMORY/plan notes. radius/spacing are
// theme-independent and still used everywhere.
export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
};

export const spacing = (n: number) => n * 4;

/** Space Grotesk for headings/prices (a little technical, numeric), Manrope for everything else. */
export const fonts = {
  display: "PlusJakartaSans_800ExtraBold",
  displaySemibold: "PlusJakartaSans_700Bold",
  headingSemibold: "SpaceGrotesk_600SemiBold",
  headingBold: "SpaceGrotesk_700Bold",
  headingMedium: "SpaceGrotesk_500Medium",
  body: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodySemibold: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
};
