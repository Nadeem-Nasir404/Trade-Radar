import { useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button } from "@/components/ui/button";
import { PnlCard } from "@/components/trade/pnl-card";
import { CARD_LAYOUT, type CardStyle } from "@/lib/card-layout";
import type { Trade } from "@/lib/stores/trades-store";
import { useToastStore } from "@/lib/stores/toast-store";
import { saveCardToGallery, shareCard } from "@/lib/save-card";
import { useTheme } from "@/lib/use-theme";
import { haptics } from "@/lib/haptics";

/**
 * Share (system sheet: X, Telegram, ...) and Save-to-gallery for a P&L card.
 *
 * Renders its own full-resolution (1080x1350) copy of the card off-screen and captures that
 * instead of the small on-screen preview. PnlCard scales its fonts/positions to whatever width
 * it's laid out at (see its `k` factor), so capturing the ~400dp preview and asking view-shot to
 * resize the bitmap up to 1080px just blows up an already-small render - soft text, fuzzy edges.
 * This copy is laid out at its native size from the start, so there's nothing left to upscale.
 */
export function CardActions({ trade, livePrice, style }: { trade: Trade; livePrice: number | null; style: CardStyle }) {
  const { colors } = useTheme();
  const showToast = useToastStore((s) => s.show);
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
  const fullResRef = useRef<View>(null);

  const withCard = async (kind: "share" | "save", run: (node: View) => Promise<void>) => {
    if (!fullResRef.current || busy) return;
    setBusy(kind);
    try {
      await run(fullResRef.current);
    } catch (err) {
      console.error(`[${kind} card]`, err);
      showToast(`Could not ${kind} the card`, (err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };

  const share = () => {
    haptics.light();
    void withCard("share", (node) => shareCard(node));
  };

  const save = () => {
    void withCard("save", async (node) => {
      const result = await saveCardToGallery(node);
      if (result === "saved") {
        haptics.success();
        showToast("Saved to gallery", "Find the card in your Photos app", "success");
      } else {
        showToast("Permission needed", "Allow photo access to save the card", "error");
      }
    });
  };

  return (
    <View>
      {/* Off-screen at full size, never visible - exists only so the capture has a crisp native
          render to grab instead of upscaling the small on-screen preview. */}
      <View style={styles.offscreen} pointerEvents="none">
        <View style={{ width: CARD_LAYOUT.canvas.width }}>
          <PnlCard ref={fullResRef} trade={trade} livePrice={livePrice} style={style} />
        </View>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: "absolute", left: -9999, top: 0 },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
