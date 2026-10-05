import { View, StyleSheet } from "react-native";
import { ThemedText } from "./themed-text";

/** Large page title with an optional trailing action - the one header style used across tabs. */
export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <ThemedText variant="title" style={styles.title}>
          {title}
        </ThemedText>
        {subtitle ? <ThemedText variant="subtle">{subtitle}</ThemedText> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 30, lineHeight: 36 },
});
