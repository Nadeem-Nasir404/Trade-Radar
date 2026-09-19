import { useState } from "react";
import { View, Pressable, StyleSheet, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "./input";
import { useTheme } from "@/lib/use-theme";

/** An Input with a show/hide eye toggle - factored out so login and register can't drift apart. */
export function PasswordInput(props: Omit<TextInputProps, "secureTextEntry">) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <Input {...props} secureTextEntry={!visible} style={styles.input} />
      <Pressable hitSlop={10} onPress={() => setVisible((v) => !v)} style={styles.toggle}>
        <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={18} color={colors.foregroundSubtle} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", justifyContent: "center" },
  input: { paddingRight: 44 },
  toggle: { position: "absolute", right: 14 },
});
