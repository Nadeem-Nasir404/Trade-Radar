import { Component, type ReactNode } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { ThemedText } from "./themed-text";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";

interface Props {
  children: ReactNode;
  /** Short label for the section that failed, so the message says where it broke. */
  label: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors in one section so a bug there shows a readable message and a retry
 * button instead of closing the whole app (release builds have no red-screen fallback).
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}]`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorFallback label={this.props.label} error={this.state.error} onRetry={() => this.setState({ error: null })} />;
  }
}

function ErrorFallback({ label, error, onRetry }: { label: string; error: Error; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
      <ThemedText style={styles.title}>{label} could not be shown</ThemedText>
      <ThemedText variant="subtle" selectable>
        {error.message}
      </ThemedText>
      <Pressable onPress={onRetry} style={[styles.retry, { borderColor: colors.glassBorder }]}>
        <ThemedText style={{ fontWeight: "600" }}>Try again</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 16, gap: 8, borderRadius: radius.lg, borderWidth: 1 },
  title: { fontWeight: "700" },
  retry: { alignSelf: "flex-start", paddingHorizontal: 14, height: 36, justifyContent: "center", borderRadius: radius.full, borderWidth: 1 },
});
