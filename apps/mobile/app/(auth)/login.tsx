import { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText } from "@/components/ui/themed-text";
import { Surface } from "@/components/ui/surface";
import { AmbientOrbs } from "@/components/ui/ambient-orbs";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useLogin } from "@/lib/api/hooks/use-auth";
import { ApiError } from "@/lib/api/client";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { withAlpha } from "@/lib/color";

export default function LoginScreen() {
  const { colors } = useTheme();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    try {
      await login.mutateAsync({ email, password });
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
            <LinearGradient
              colors={[colors.brand, colors.brandGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconTile}
            >
              <Ionicons name="pulse" size={30} color={colors.brandForeground} />
            </LinearGradient>
          </View>

          <ThemedText variant="title" style={[styles.centerText, styles.heading]}>
            Welcome back
          </ThemedText>
          <ThemedText variant="muted" style={[styles.subtitle, styles.centerText]}>
            Log in to keep watching your levels.
          </ThemedText>

          <Surface style={styles.card}>
            <View style={styles.form}>
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
                <PasswordInput icon="lock-closed-outline" value={password} onChangeText={setPassword} autoComplete="password" placeholder="••••••••" />
              </View>

              {error && (
                <View style={[styles.errorBanner, { backgroundColor: withAlpha(colors.negative, 0.12) }]}>
                  <Ionicons name="alert-circle" size={15} color={colors.negative} />
                  <ThemedText style={[styles.errorText, { color: colors.negative }]}>{error}</ThemedText>
                </View>
              )}

              <Button title="Log in" onPress={handleSubmit} loading={login.isPending} style={styles.submit} />
            </View>
          </Surface>

          <View style={styles.footer}>
            <ThemedText variant="muted">New to CoinRadar? </ThemedText>
            <Link href="/(auth)/register">
              <ThemedText style={{ color: colors.brand, fontWeight: "600" }}>Create an account</ThemedText>
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
  logoWrap: { alignItems: "center", justifyContent: "center", marginBottom: 20 },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#a855f7",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heading: { fontSize: 28 },
  subtitle: { marginTop: 6, marginBottom: 28 },
  card: { padding: 20, marginTop: 4 },
  form: { gap: 16 },
  field: { gap: 6 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: radius.md },
  errorText: { flex: 1, fontSize: 13 },
  submit: { marginTop: 2 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
});
