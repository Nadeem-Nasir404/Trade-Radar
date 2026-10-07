import type { View } from "react-native";

/**
 * Saving and sharing a P&L card: it is rendered at its 1080x1350 export size first.
 * The native modules are loaded only when the user taps, so the rest of the app still runs
 * in Expo Go even if a module there is missing; in that case this throws a readable error.
 */
async function captureCard(node: View): Promise<string> {
  let viewShot: typeof import("react-native-view-shot");
  try {
    viewShot = await import("react-native-view-shot");
  } catch {
    throw new Error("Card images are not available in this build");
  }
  return viewShot.captureRef(node, { format: "png", quality: 1, result: "tmpfile", width: 1080, height: 1350 });
}

export async function saveCardToGallery(node: View): Promise<"saved" | "denied"> {
  // The legacy entry point: the root package's saveToLibraryAsync now throws ("deprecated").
  let MediaLibrary: typeof import("expo-media-library/legacy");
  try {
    MediaLibrary = await import("expo-media-library/legacy");
  } catch {
    throw new Error("Saving cards is not available in this build");
  }

  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) return "denied";
  await MediaLibrary.saveToLibraryAsync(await captureCard(node));
  return "saved";
}

/** Opens the system share sheet (X, Telegram, WhatsApp, ...) with the card image. */
export async function shareCard(node: View): Promise<void> {
  let Sharing: typeof import("expo-sharing");
  try {
    Sharing = await import("expo-sharing");
  } catch {
    throw new Error("Sharing is not available in this build");
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device");
  const uri = await captureCard(node);
  await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share your P&L card" });
}
