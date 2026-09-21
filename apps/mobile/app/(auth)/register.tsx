import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { useRegister } from "@/lib/api/hooks/use-auth";
import { ApiError } from "@/lib/api/client";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { withAlpha } from "@/lib/color";

export default function RegisterScreen() {
  const { colors } = useTheme();
  const register = useRegister();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    try {
      await register.mutateAsync({ email, password, name: name || undefined });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
      <AmbientOrbs />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <Surface style={styles.iconTile}>
              <Ionicons name="notifications" size={26} color={colors.brand} />
            </Surface>
            <View style={styles.wordmarkWrap}>
              <ThemedText variant="subtitle">CoinRadar</ThemedText>
              <ThemedText variant="subtle">Price alerts for every coin</ThemedText>
            </View>
          </View>

          <ThemedText variant="title" style={[styles.centerText, styles.heading]}>
            Start tracking free
          </ThemedText>
          <ThemedText variant="muted" style={[styles.subtitle, styles.centerText]}>
            15 active alerts, no credit card.
          </ThemedText>

          <Surface style={styles.card}>
            <View style={styles.form}>
              <View style={styles.field}>
                <ThemedText variant="label">Name</ThemedText>
                <Input icon="person-outline" value={name} onChangeText={setName} autoComplete="name" placeholder="Your name" />
              </View>
              <View style={styles.field}>
                <ThemedText variant="label">Email</ThemedText>
                <Input
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </View>
              <View style={styles.field}>
                <ThemedText variant="label">Password</ThemedText>
                <PasswordInput icon="lock-closed-outline" value={password} onChangeText={setPassword} autoComplete="password-new" placeholder="••••••••" />
                <ThemedText variant="subtle">At least 8 characters.</ThemedText>
              </View>

              {error && (
                <View style={[styles.errorBanner, { backgroundColor: withAlpha(colors.negative, 0.12) }]}>
                  <Ionicons name="alert-circle" size={15} color={colors.negative} />
                  <ThemedText style={[styles.errorText, { color: colors.negative }]}>{error}</ThemedText>
                </View>
              )}

              <Button
                title="Create Account"
                onPress={handleSubmit}
                loading={register.isPending}
                trailingIcon={<Ionicons name="arrow-forward" size={18} color={colors.brandForeground} />}
                style={styles.submit}
              />
            </View>
          </Surface>

          <View style={styles.footer}>
            <ThemedText variant="muted">Already have an account? </ThemedText>
            <Link href="/(auth)/login">
              <ThemedText style={{ color: colors.brand, fontWeight: "600" }}>Log in</ThemedText>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 24 },
  centerText: { textAlign: "center" },
  logoWrap: { alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 24 },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#a855f7",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  wordmarkWrap: { alignItems: "center", gap: 2 },
  heading: { fontSize: 26 },
  subtitle: { marginTop: 6, marginBottom: 28 },
  card: { padding: 20, marginTop: 4 },
  form: { gap: 16 },
  field: { gap: 6 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: radius.md },
  errorText: { flex: 1, fontSize: 13 },
  submit: { marginTop: 2 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
});
