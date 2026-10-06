import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

interface Icon3DProps {
  icon: keyof typeof Ionicons.glyphMap;
  /** Base color; the tile is lit from the top-left and shaded to the bottom-right. */
  color: string;
  size?: number;
}

/** A glossy, lifted icon tile - gradient body, top highlight, and a soft shadow - for a 3D feel without heavy artwork. */
export function Icon3D({ icon, color, size = 56 }: Icon3DProps) {
  const radius = size * 0.32;
  const glyph = Math.round(size * 0.46);
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: radius, shadowColor: color }]}>
      <LinearGradient
        colors={[lighten(color, 0.35), color, darken(color, 0.25)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.55)", "rgba(255,255,255,0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.highlight, { borderRadius: radius, height: size * 0.5 }]}
      />
      <Ionicons name={icon} size={glyph} color="#FFFFFF" />
    </View>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function lighten(hex: string, amt: number): string {
  return toHex(hexToRgb(hex).map((v) => v + (255 - v) * amt) as [number, number, number]);
}

function darken(hex: string, amt: number): string {
  return toHex(hexToRgb(hex).map((v) => v * (1 - amt)) as [number, number, number]);
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  highlight: { position: "absolute", top: 0, left: 0, right: 0 },
});
