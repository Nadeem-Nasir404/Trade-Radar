import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import type { DrawTool } from "./drawing-tools";

/**
 * Line-art glyph for a drawing tool, in TradingView's style: the shape itself with small circles
 * on its anchor points, so each tool reads as what it draws.
 */
export function ToolIcon({ tool, color, size = 24 }: { tool: DrawTool; color: string; size?: number }) {
  const s = { stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, fill: "none" };
  const dot = (cx: number, cy: number) => <Circle cx={cx} cy={cy} r={2.2} stroke={color} strokeWidth={1.4} fill="none" />;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {tool === "trend" && (
        <>
          <Line x1={7} y1={17} x2={17} y2={7} {...s} />
          {dot(5.5, 18.5)}
          {dot(18.5, 5.5)}
        </>
      )}
      {tool === "ray" && (
        <>
          <Line x1={7} y1={17} x2={21} y2={3} {...s} />
          {dot(5.5, 18.5)}
          {dot(13, 11)}
        </>
      )}
      {tool === "horizontal" && (
        <>
          <Line x1={2} y1={12} x2={9.8} y2={12} {...s} />
          <Line x1={14.2} y1={12} x2={22} y2={12} {...s} />
          {dot(12, 12)}
        </>
      )}
      {tool === "hray" && (
        <>
          <Line x1={7.2} y1={12} x2={22} y2={12} {...s} />
          {dot(5, 12)}
        </>
      )}
      {tool === "vline" && (
        <>
          <Line x1={12} y1={2} x2={12} y2={9.8} {...s} />
          <Line x1={12} y1={14.2} x2={12} y2={22} {...s} />
          {dot(12, 12)}
        </>
      )}
      {tool === "rect" && (
        <>
          <Rect x={5} y={7} width={14} height={10} {...s} />
          {dot(5, 7)}
          {dot(19, 17)}
        </>
      )}
      {tool === "fib" && (
        <>
          <Line x1={7} y1={5} x2={21} y2={5} {...s} />
          <Line x1={3} y1={10} x2={21} y2={10} {...s} />
          <Line x1={3} y1={14} x2={21} y2={14} {...s} />
          <Line x1={7} y1={19} x2={21} y2={19} {...s} />
          {dot(4.8, 5)}
          {dot(4.8, 19)}
        </>
      )}
      {tool === "measure" && (
        <>
          <Rect x={4} y={5} width={16} height={14} {...s} strokeDasharray="2 2" />
          <Path d="M12 16V8M9 11l3-3 3 3" {...s} />
        </>
      )}
    </Svg>
  );
}
