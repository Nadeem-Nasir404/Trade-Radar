import { View, Pressable, StyleSheet, Modal } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { ThemedText } from "@/components/ui/themed-text";
import { useTheme } from "@/lib/use-theme";
import { haptics } from "@/lib/haptics";
import { formatCompactPrice } from "@/lib/format";
import { useDrawingsStore, newDrawingId } from "@/lib/stores/drawings-store";

interface PriceActionSheetProps {
  price: number | null;
  displaySymbol: string;
  symbol: string;
  instrumentId: string;
  onClose: () => void;
}

/** Long-press menu on the chart, matching the TradingView pattern: act on the held price. */
export function PriceActionSheet({ price, displaySymbol, symbol, instrumentId, onClose }: PriceActionSheetProps) {
  const { colors } = useTheme();
  const visible = price !== null;
  const label = price !== null ? formatCompactPrice(price) : "";

  const addAlert = () => {
    if (price === null) return;
    haptics.medium();
    onClose();
    router.push({ pathname: "/create-alert", params: { instrumentId, symbol: displaySymbol, price: String(price) } });
  };

  const drawLevel = () => {
    if (price === null) return;
    haptics.light();
    useDrawingsStore.getState().add(symbol, { id: newDrawingId(), type: "horizontal", price });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
        <View style={[styles.handle, { backgroundColor: colors.glassBorderStrong }]} />
        <Row icon="alarm-outline" label={`Add alert on ${displaySymbol} at ${label}`} onPress={addAlert} />
        <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />
        <Row icon="remove-outline" label={`Draw horizontal line at ${label}`} onPress={drawLevel} />
        <View style={[styles.divider, { backgroundColor: colors.glassBorder }]} />
        <Row icon="close-outline" label="Cancel" onPress={onClose} muted />
      </View>
    </Modal>
  );
}

function Row({
  icon,
  label,
  onPress,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  muted?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Ionicons name={icon} size={22} color={muted ? colors.foregroundMuted : colors.foreground} />
      <ThemedText style={[styles.rowText, muted && { color: colors.foregroundMuted }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 28, paddingTop: 8 },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 22, paddingVertical: 18 },
  rowText: { flex: 1, fontSize: 16 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 22 },
});
