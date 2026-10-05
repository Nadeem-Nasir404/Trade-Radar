import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/use-theme";

/** A quiet top-edge wash of the brand color - gives screens depth without decorative blobs. */
export function AmbientOrbs() {
  const { colors } = useTheme();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[colors.brandGlow, "transparent"]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.wash}
    />
  );
}

const styles = StyleSheet.create({
  wash: { position: "absolute", top: 0, left: 0, right: 0, height: 260, opacity: 0.45 },
});
