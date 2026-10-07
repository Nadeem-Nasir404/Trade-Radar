import { useState, type RefObject } from "react";
import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/lib/stores/toast-store";
import { saveCardToGallery, shareCard } from "@/lib/save-card";
import { useTheme } from "@/lib/use-theme";
import { haptics } from "@/lib/haptics";

/** Share (system sheet: X, Telegram, ...) and Save-to-gallery for a rendered P&L card. */
export function CardActions({ cardRef }: { cardRef: RefObject<View | null> }) {
  const { colors } = useTheme();
  const showToast = useToastStore((s) => s.show);
  const [busy, setBusy] = useState<"share" | "save" | null>(null);

  const share = async () => {
    if (!cardRef.current || busy) return;
    haptics.light();
    setBusy("share");
    try {
      await shareCard(cardRef.current);
    } catch (err) {
      console.error("[share card]", err);
      showToast("Could not share the card", (err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!cardRef.current || busy) return;
    setBusy("save");
    try {
      const result = await saveCardToGallery(cardRef.current);
      if (result === "saved") {
        haptics.success();
        showToast("Saved to gallery", "Find the card in your Photos app", "success");
      } else {
        showToast("Permission needed", "Allow photo access to save the card", "error");
      }
    } catch (err) {
      console.error("[save card]", err);
      showToast("Could not save the card", (err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.row}>
      <Button
        title="Share"
        icon={<Ionicons name="share-social-outline" size={18} color={colors.brandForeground} />}
        loading={busy === "share"}
        onPress={share}
        style={styles.flex}
      />
      <Button
        title="Save"
        variant="glass"
        icon={<Ionicons name="download-outline" size={18} color={colors.foreground} />}
        loading={busy === "save"}
        onPress={save}
        style={styles.flex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
