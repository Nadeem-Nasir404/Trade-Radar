import { TextInput, StyleSheet, type TextInputProps } from "react-native";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

export function Input(props: TextInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.foregroundSubtle}
      style={[
        styles.input,
        { borderColor: colors.glassBorder, backgroundColor: colors.glass, color: colors.foreground },
        props.style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
});
