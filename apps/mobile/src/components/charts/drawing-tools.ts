/** Every drawing tool the chart supports. The chart page (trading-chart.tsx) renders each kind. */
export type DrawTool = "trend" | "ray" | "horizontal" | "hray" | "vline" | "rect" | "fib" | "measure";

export type DrawToolCategory = "lines" | "fib" | "shapes";

export interface DrawToolInfo {
  value: DrawTool;
  label: string;
  category: DrawToolCategory;
  /** What to do on the chart once the tool is picked, shown above the toolbar. */
  hint: string;
}

/** Tool order follows TradingView's Drawings panel. */
export const DRAWING_TOOLS: DrawToolInfo[] = [
  { value: "trend", label: "Trend Line", category: "lines", hint: "Drag from one point to another, or tap both" },
  { value: "ray", label: "Ray", category: "lines", hint: "Drag in the direction the ray should run" },
  { value: "horizontal", label: "Horizontal Line", category: "lines", hint: "Tap or drag to the price" },
  { value: "hray", label: "Horizontal Ray", category: "lines", hint: "Tap where the ray should start" },
  { value: "vline", label: "Vertical Line", category: "lines", hint: "Tap the candle to mark" },
  { value: "fib", label: "Fib Retracement", category: "fib", hint: "Drag from the swing start to its end" },
  { value: "measure", label: "Price Range", category: "fib", hint: "Drag to measure the move" },
  { value: "rect", label: "Rectangle", category: "shapes", hint: "Drag across the zone, or tap two corners" },
];

export const DRAW_TOOL_CATEGORIES: { value: DrawToolCategory; label: string }[] = [
  { value: "lines", label: "Lines" },
  { value: "fib", label: "Fib & Measure" },
  { value: "shapes", label: "Shapes" },
];

export const DEFAULT_FAVORITE_TOOLS: DrawTool[] = ["trend", "horizontal", "rect"];

export function toolInfo(tool: DrawTool): DrawToolInfo {
  return DRAWING_TOOLS.find((t) => t.value === tool) ?? DRAWING_TOOLS[0];
}
