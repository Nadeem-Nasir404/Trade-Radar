import { useState } from "react";
import { Image, View, StyleSheet } from "react-native";
import { ThemedText } from "./ui/themed-text";
import { useTheme } from "@/lib/use-theme";

interface CoinLogoProps {
  uri: string | null;
  symbol: string;
  size?: number;
}

/** Renders a coin's icon, falling back to an initials badge if there's no URL or the image 404s (long-tail tickers aren't all covered by the icon CDN). */
export function CoinLogo({ uri, symbol, size = 28 }: CoinLogoProps) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const dims = { width: size, height: size, borderRadius: size / 2 };

  if (!uri || failed) {
    return (
      <View style={[styles.fallback, dims, { backgroundColor: colors.glassHover, borderColor: colors.glassBorder }]}>
        <ThemedText style={[styles.fallbackText, { fontSize: size * 0.4 }]}>{symbol.slice(0, 1).toUpperCase()}</ThemedText>
      </View>
    );
  }

  return <Image source={{ uri }} style={dims} onError={() => setFailed(true)} />;
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  fallbackText: { fontWeight: "700" },
});
