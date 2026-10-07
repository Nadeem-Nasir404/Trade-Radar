import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ThemedText } from "./themed-text";
import { IconButton } from "./icon-button";

/**
 * Header for pushed and modal screens: a glass back/close button, a centred title and an optional
 * trailing action. Keeps every sub-screen's top bar the same height and spacing.
 */
export function ModalHeader({
  title,
  kind = "back",
  action,
  onClose,
}: {
  title?: React.ReactNode;
  /** "back" for pushed screens, "close" for modals. */
  kind?: "back" | "close";
  action?: React.ReactNode;
  onClose?: () => void;
}) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <IconButton icon={kind === "back" ? "chevron-back" : "close"} label={kind === "back" ? "Back" : "Close"} onPress={onClose ?? (() => router.back())} />
      <View style={styles.title}>
        {typeof title === "string" ? (
          <ThemedText variant="subtitle" numberOfLines={1} style={styles.titleText}>
            {title}
          </ThemedText>
        ) : (
          title
        )}
      </View>
      {/* Same width as the leading button so the title stays centred. */}
      <View style={styles.action}>{action}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
  title: { flex: 1, alignItems: "center", minWidth: 0 },
  titleText: { fontSize: 16 },
  action: { minWidth: 44, alignItems: "flex-end" },
});
