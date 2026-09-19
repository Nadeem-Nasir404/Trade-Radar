import { Stack } from "expo-router";
import { useTheme } from "@/lib/use-theme";

export default function MarketsLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[symbol]" />
    </Stack>
  );
}
