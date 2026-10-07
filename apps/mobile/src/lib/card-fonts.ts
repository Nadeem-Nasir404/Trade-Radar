import { useFonts } from "expo-font";
// Per-weight entry points: the package roots require every weight and italic they ship, which
// would bundle dozens of unused font files into the app.
import { Anton_400Regular } from "@expo-google-fonts/anton/400Regular";
import { ArchivoBlack_400Regular } from "@expo-google-fonts/archivo-black/400Regular";
import { Fraunces_700Bold } from "@expo-google-fonts/fraunces/700Bold";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono/700Bold";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display/700Bold";
import { Sora_700Bold } from "@expo-google-fonts/sora/700Bold";
import { Unbounded_700Bold } from "@expo-google-fonts/unbounded/700Bold";

/**
 * Typefaces used only by the P&L card themes. Loaded when a card is first shown rather than at
 * app start, so they never delay launch. One weight each - the card only needs a display face.
 */
const CARD_FONT_FILES = {
  Anton_400Regular,
  ArchivoBlack_400Regular,
  Fraunces_700Bold,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
  PlayfairDisplay_700Bold,
  Sora_700Bold,
  Unbounded_700Bold,
};

/** "loading" until the files are registered; "failed" means fall back to the app's own fonts. */
export function useCardFonts(): "loading" | "ready" | "failed" {
  const [loaded, error] = useFonts(CARD_FONT_FILES);
  if (error) return "failed";
  return loaded ? "ready" : "loading";
}
