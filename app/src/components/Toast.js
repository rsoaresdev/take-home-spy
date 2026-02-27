import { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const TYPE_STYLES = {
  success: { borderColor: "#10b981", color: "#6ee7b7" },
  error: { borderColor: "#ef4444", color: "#fca5a5" },
  info: { borderColor: "#3b82f6", color: "#93c5fd" },
  center: { borderColor: "#10b981", color: "#6ee7b7" },
  centerOff: { borderColor: "#64748b", color: "#94a3b8" },
  default: { borderColor: "#475569", color: "#94a3b8" },
};

/**
 * Toast Component — glassmorphism style
 */
export default function Toast({ visible, message, type = "success", onHide }) {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 140 });
      opacity.value = withTiming(1, { duration: 180 });

      const timeout = setTimeout(() => hideToast(), 2200);
      return () => clearTimeout(timeout);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    translateY.value = withTiming(-100, { duration: 220 });
    opacity.value = withTiming(0, { duration: 220 }, () => {
      if (onHide) scheduleOnRN(onHide);
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  const styles = TYPE_STYLES[type] || TYPE_STYLES.default;
  const isCenter = type === "center" || type === "centerOff";

  return (
    <Animated.View
      className="absolute left-5 right-5 rounded-2xl border bg-slate-950/80 backdrop-blur-xl"
      style={[
        isCenter
          ? {
              top: "45%",
              left: 40,
              right: 40,
              paddingVertical: 18,
              paddingHorizontal: 24,
            }
          : { top: 60, paddingVertical: 14, paddingHorizontal: 20 },
        {
          borderColor: styles.borderColor,
          shadowColor: styles.borderColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
          zIndex: 9999,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <Text
        className={
          isCenter ? "text-base font-bold text-center" : "text-sm font-semibold"
        }
        style={{ color: styles.color }}
      >
        {message}
      </Text>
    </Animated.View>
  );
}
