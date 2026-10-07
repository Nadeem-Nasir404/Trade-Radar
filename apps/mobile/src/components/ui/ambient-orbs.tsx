import { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "@/lib/use-theme";

/**
 * Soft colour orbs drifting slowly behind a screen. They give the frosted-glass panels something
 * to blur (glass over a flat fill looks like a plain grey box). Each orb is a static radial
 * gradient cached as a texture and only moved, so the motion runs on the UI thread and stays cheap.
 */
export function AmbientOrbs() {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const strength = isDark ? 0.34 : 0.26;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Orb color={colors.brand} size={width * 1.2} left={width * 0.35} top={-width * 0.45} opacity={strength} drift={28} duration={11000} />
      <Orb color="#EC4899" size={width * 0.95} left={-width * 0.45} top={height * 0.32} opacity={strength * 0.75} drift={22} duration={13000} delay={1500} />
      <Orb color="#22D3EE" size={width * 1.05} left={width * 0.4} top={height * 0.72} opacity={strength * 0.6} drift={26} duration={15000} delay={3000} />
    </View>
  );
}

function Orb({
  color,
  size,
  left,
  top,
  opacity,
  drift,
  duration,
  delay = 0,
}: {
  color: string;
  size: number;
  left: number;
  top: number;
  opacity: number;
  drift: number;
  duration: number;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setTimeout(() => {
      t.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
    }, delay);
    return () => clearTimeout(timer);
  }, [reduceMotion, duration, delay, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: (t.value - 0.5) * drift * 2 }, { translateY: (0.5 - t.value) * drift * 1.4 }, { scale: 1 + t.value * 0.06 }],
  }));

  const id = `orb-${color.replace("#", "")}`;
  return (
    <Animated.View renderToHardwareTextureAndroid shouldRasterizeIOS style={[{ position: "absolute", left, top, width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}
