import type { View } from "react-native";

/**
 * Renders a P&L card at its 1080x1350 export size and writes it to the device gallery.
 * The native modules are loaded only when the user taps save, so the rest of the app still runs
 * in Expo Go even if a module there is missing; in that case this throws a readable error.
 */
export async function saveCardToGallery(node: View): Promise<"saved" | "denied"> {
  let MediaLibrary: typeof import("expo-media-library");
  let viewShot: typeof import("react-native-view-shot");
  try {
    MediaLibrary = await import("expo-media-library");
    viewShot = await import("react-native-view-shot");
  } catch {
    throw new Error("Saving cards is not available in this build");
  }

  const permission = await MediaLibrary.requestPermissionsAsync(true);
  if (!permission.granted) return "denied";
  const uri = await viewShot.captureRef(node, { format: "png", quality: 1, result: "tmpfile", width: 1080, height: 1350 });
  await MediaLibrary.saveToLibraryAsync(uri);
  return "saved";
}
