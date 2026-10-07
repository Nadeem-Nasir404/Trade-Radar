import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassPressable } from "./glass-pressable";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** The one square glass icon button used in screen headers (back, close, delete, shortcuts). */
export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 44,
}: {
  icon: IconName;
  onPress: () => void;
  /** Read out by screen readers. */
  label: string;
  color?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <GlassPressable onPress={onPress} hitSlop={8} accessibilityLabel={label} style={{ width: size, height: size, borderRadius: radius.md }}>
      <Ionicons name={icon} size={20} color={color ?? colors.foreground} />
    </GlassPressable>
  );
}
