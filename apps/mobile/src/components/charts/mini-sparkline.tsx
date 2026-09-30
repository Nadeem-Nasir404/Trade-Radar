import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { useTheme } from "@/lib/use-theme";

export interface MiniSparklineProps {
  data?: number[];
  width?: number;
  height?: number;
  positive?: boolean;
}

export function MiniSparkline({
  data = [100, 101, 99, 102, 101, 104, 103, 106],
  width = 64,
  height = 24,
  positive = true,
}: MiniSparklineProps) {
  const { colors } = useTheme();
  const strokeColor = positive ? colors.positive : colors.negative;
  const gradientId = useMemo(() => `sparkline-grad-${Math.random().toString(36).substring(2, 7)}`, []);

  const { pathData, areaPathData } = useMemo(() => {
    if (!data || data.length < 2) {
      return { pathData: "", areaPathData: "" };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const usableHeight = height - padding * 2;

    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - padding - ((val - min) / range) * usableHeight;
      return { x, y };
    });

    const path = points.reduce((acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`), "");
    const area = `${path} L ${width} ${height} L 0 ${height} Z`;

    return { pathData: path, areaPathData: area };
  }, [data, width, height]);

  if (!pathData) {
    return <View style={{ width, height }} />;
  }

  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={strokeColor} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
          </LinearGradient>
        </Defs>
        <Path d={areaPathData} fill={`url(#${gradientId})`} />
        <Path d={pathData} fill="none" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
