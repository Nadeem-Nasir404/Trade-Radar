import { View, StyleSheet } from "react-native";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

/**
 * Three soft blurred color orbs behind the content - purple top-left, pink/magenta top-right,
 * blue bottom-left - the ambient backdrop the glassmorphic design pass uses on screens where the
 * glass cards need something more alive than a flat background to actually read as "glass".
 */
export function AmbientOrbs() {
  const { isDark } = useTheme();
  const opacity = isDark ? { a: 0.4, b: 0.26, c: 0.2 } : { a: 0.35, b: 0.22, c: 0.22 };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.orb, styles.orbA, { opacity: opacity.a }]} />
      <View style={[styles.orb, styles.orbB, { opacity: opacity.b }]} />
      <View style={[styles.orb, styles.orbC, { opacity: opacity.c }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: { position: "absolute", borderRadius: radius.full },
  orbA: { width: 280, height: 280, top: -90, left: -70, backgroundColor: "#8B5CF6" },
  orbB: { width: 230, height: 230, top: 20, right: -90, backgroundColor: "#F472B6" },
  orbC: { width: 250, height: 250, bottom: -60, left: -80, backgroundColor: "#60A5FA" },
});
