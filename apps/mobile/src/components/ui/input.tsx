import { View, TextInput, StyleSheet, type TextInputProps } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/use-theme";
import { radius, fonts } from "@/lib/theme";

interface InputProps extends TextInputProps {
  icon?: keyof typeof Ionicons.glyphMap;
}

export function Input({ icon, style, ...props }: InputProps) {
  const { colors } = useTheme();

  if (icon) {
    return (
      <View style={[styles.iconWrap, { borderColor: colors.glassBorder, backgroundColor: colors.glass }]}>
        <Ionicons name={icon} size={17} color={colors.foregroundSubtle} style={styles.iconGlyph} />
        <TextInput
          placeholderTextColor={colors.foregroundSubtle}
          style={[styles.inputBare, { color: colors.foreground }, style]}
          {...props}
        />
      </View>
    );
  }

  return (
    <TextInput
      placeholderTextColor={colors.foregroundSubtle}
      style={[
        styles.input,
        { borderColor: colors.glassBorder, backgroundColor: colors.glass, color: colors.foreground },
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
  },
  iconWrap: {
    height: 50,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  iconGlyph: { marginRight: 10 },
  inputBare: { flex: 1, fontSize: 15, fontFamily: fonts.bodyMedium, height: "100%", padding: 0 },
});
