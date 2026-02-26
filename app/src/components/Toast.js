import { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/**
 * Toast Component
 */
export default function Toast({ visible, message, type = "success", onHide }) {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Mostrar toast
      translateY.value = withSpring(0, {
        damping: 15,
        stiffness: 150,
      });
      opacity.value = withTiming(1, { duration: 200 });

      // Auto-hide após 2 segundos
      const timeout = setTimeout(() => {
        hideToast();
      }, 2000);

      return () => clearTimeout(timeout);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    translateY.value = withTiming(-100, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, () => {
      if (onHide) {
        scheduleOnRN(onHide);
      }
    });
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  const getStyles = () => {
    switch (type) {
      case "success":
        return {
          backgroundColor: "#0f172a",
          borderColor: "#10b981",
          color: "#10b981",
        };
      case "error":
        return {
          backgroundColor: "#0f172a",
          borderColor: "#ef4444",
          color: "#ef4444",
        };
      case "info":
        return {
          backgroundColor: "#0f172a",
          borderColor: "#3b82f6",
          color: "#3b82f6",
        };
      case "center":
        return {
          backgroundColor: "#0f172a",
          borderColor: "#10b981",
          color: "#10b981",
        };
      case "centerOff":
        return {
          backgroundColor: "#0f172a",
          borderColor: "#64748b",
          color: "#64748b",
        };
      default:
        return {
          backgroundColor: "#0f172a",
          borderColor: "#64748b",
          color: "#94a3b8",
        };
    }
  };

  if (!visible) return null;

  const styles = getStyles();
  const isCenter = type === "center" || type === "centerOff";

  return (
    <Animated.View
      className="absolute left-5 right-5 py-4 px-5 rounded-2xl border bg-slate-900"
      style={[
        isCenter ? { top: "45%", left: 40, right: 40 } : { top: 60 },
        {
          borderColor: styles.borderColor,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
          zIndex: 9999,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      <Text
        className={isCenter ? "text-lg font-bold text-center" : "text-sm font-semibold"}
        style={{ color: styles.color }}
      >
        {message}
      </Text>
    </Animated.View>
  );
}
