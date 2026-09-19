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
