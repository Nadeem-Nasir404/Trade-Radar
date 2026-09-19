import { View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "./ui/themed-text";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

export function Logo({ iconOnly = false }: { iconOnly?: boolean }) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <LinearGradient
        colors={[colors.brand, colors.brandGradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconWrap}
      >
        <Svg viewBox="0 0 24 24" width={18} height={18} fill="none">
          <Path d="M3 14L8 9L12 13L21 4" stroke={colors.brandForeground} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15 4H21V10" stroke={colors.brandForeground} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </LinearGradient>
      {!iconOnly && (
        <ThemedText variant="subtitle" style={styles.wordmark}>
          CoinRadar
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: { fontSize: 18 },
});
