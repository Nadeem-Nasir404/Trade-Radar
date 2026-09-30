import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, Pressable, StyleSheet, type PressableProps, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import Animated, { FadeIn, FadeOut, useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useAlertTriggeredListener } from "@/lib/ws/use-alert-triggered-listener";
import { useTheme } from "@/lib/use-theme";
import { radius } from "@/lib/theme";
import { withAlpha } from "@/lib/color";
import { haptics } from "@/lib/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const BAR_HEIGHT = 64;
const FAB_SIZE = 58;

export default function TabsLayout() {
  useAlertTriggeredListener();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const barBottom = Math.max(insets.bottom, 12) + 4;

  return (
    <>
      <Tabs
        screenListeners={{ tabPress: () => haptics.selection() }}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarButton: (props) => <TabBarButton {...props} />,
          tabBarStyle: {
            position: "absolute",
            left: 16,
            right: 16,
            bottom: barBottom,
            height: BAR_HEIGHT,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            elevation: 0,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.45,
            shadowRadius: 30,
          },
          // A blurred backdrop here would sit directly under a fully opaque fill (needed to stop
          // scrolled list content from showing through the pill), so it would never actually be
          // visible - skip it rather than pay Android's BlurView cost for nothing.
          tabBarBackground: () => (
            <View style={[StyleSheet.absoluteFill, styles.barBackground, { backgroundColor: colors.backgroundElevated }]} />
          ),
        }}
      >
        <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }} />
        <Tabs.Screen name="markets" options={{ tabBarIcon: ({ focused }) => <TabIcon name="grid" focused={focused} /> }} />
        {/*
          Not a real flex column - 5 real destinations means any slot this button occupies among
          them sits off-center (2 tabs on one side, 3 on the other, whichever side it's put on).
          It's zero-width here purely so Expo Router has a route to point at; the visible button
          is the absolutely-positioned CenterFab below, which centers on the screen independent
          of how the other 5 are split.
        */}
        <Tabs.Screen
          name="fab"
          options={{ tabBarItemStyle: { width: 0, flex: 0, padding: 0 }, tabBarButton: () => null }}
        />
        <Tabs.Screen name="alerts" options={{ tabBarIcon: ({ focused }) => <TabIcon name="notifications" focused={focused} /> }} />
        <Tabs.Screen name="watchlists" options={{ tabBarIcon: ({ focused }) => <TabIcon name="star" focused={focused} /> }} />
        <Tabs.Screen name="profile" options={{ tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} /> }} />
      </Tabs>

      <View pointerEvents="box-none" style={[styles.fabOverlay, { bottom: barBottom }]}>
        <Pressable
          onPress={() => {
            haptics.medium();
            router.push("/create-alert");
          }}
          style={styles.fabPressable}
        >
          <LinearGradient colors={[colors.brand, colors.brandGradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d="M12 5V19M5 12H19" stroke={colors.brandForeground} strokeWidth={2.75} strokeLinecap="round" />
            </Svg>
          </LinearGradient>
        </Pressable>
      </View>
    </>
  );
}

function TabBarButton(props: PressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...props}
      style={[props.style, styles.tabButton, animatedStyle]}
      onPressIn={(e: GestureResponderEvent) => {
        scale.value = withTiming(0.88, { duration: 100 });
        props.onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        scale.value = withTiming(1, { duration: 150 });
        props.onPressOut?.(e);
      }}
    />
  );
}

// Icon-only by design - a text label at this width either clips ("Watchlist" has no room in a
// 1/6-of-64px-tall pill slot) or forces the whole bar to grow. The active tab instead gets a
// filled icon over a soft tinted pill, which reads as clearly as a label without a fit problem.
function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const { colors } = useTheme();
  const iconName = (focused ? name : `${name}-outline`) as React.ComponentProps<typeof Ionicons>["name"];

  return (
    <View style={styles.tabIconWrap}>
      {focused && (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={[styles.activePill, { backgroundColor: withAlpha(colors.brand, 0.18) }]}
        />
      )}
      <Ionicons name={iconName} size={22} color={focused ? colors.brand : colors.foregroundSubtle} />
      {focused && (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={[styles.activeDot, { backgroundColor: colors.brand }]}
        />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  barBackground: { borderRadius: radius.full, overflow: "hidden" },
  tabIconWrap: { alignItems: "center", justifyContent: "center", width: "100%", height: "100%" },
  activePill: { position: "absolute", width: 40, height: 40, borderRadius: radius.full },
  activeDot: { position: "absolute", bottom: 6, width: 4, height: 4, borderRadius: radius.full },
  tabButton: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Full-width, centered content - true screen-center regardless of the tab bar's own slot count/split.
  fabOverlay: { position: "absolute", left: 0, right: 0, height: BAR_HEIGHT, alignItems: "center", justifyContent: "center" },
  fabPressable: { alignItems: "center", justifyContent: "center" },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
});
