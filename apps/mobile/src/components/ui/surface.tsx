import { View, Platform, type ViewProps, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

interface SurfaceProps extends ViewProps {
  intensity?: number;
  /**
   * Live backdrop blur. Turn it off for repeated rows (lists): every BlurView is its own render
   * pass on Android, and over the app's soft background the flat glass tint looks the same.
   */
  blur?: boolean;
}

export function Surface({ style, intensity = 40, blur = true, children, ...props }: SurfaceProps) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.surface, { borderColor: colors.glassBorder }, style]} {...props}>
      {blur && (
        <BlurView
          intensity={intensity}
          tint={colors.blurTint}
          style={StyleSheet.absoluteFill}
          experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
        />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass }]} />
      {/* Diagonal sheen: light catching the top-left of the pane, the cue that reads as glass. */}
      <LinearGradient
        colors={[isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.45)", "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 0.7 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Faint top-edge highlight - the light-catching-glass detail flat translucent fills alone don't sell. */}
      <LinearGradient
        colors={[colors.glassBorderStrong, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.topHighlight}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  topHighlight: { position: "absolute", top: 0, left: 0, right: 0, height: 1 },
});
