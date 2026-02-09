import React, { useState, useCallback, ReactNode } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  BorderRadius,
  Spacing,
  PremiumGradients,
  PremiumColors,
  PremiumShadows,
  BrandColors,
  SpringConfigs,
} from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ToastVariant = "success" | "error" | "warning" | "info";
type ToastPosition = "top" | "bottom";

interface ToastConfig {
  variant: ToastVariant;
  title?: string;
  message: string;
  icon?: ReactNode;
  duration?: number;
  position?: ToastPosition;
  gradient?: boolean;
}

interface ToastItem extends ToastConfig {
  id: string;
}

// Toast Manager (Singleton)
class ToastManager {
  private listeners: ((toast: ToastItem) => void)[] = [];

  subscribe(listener: (toast: ToastItem) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  show(config: ToastConfig) {
    const toast: ToastItem = {
      id: Math.random().toString(36).substr(2, 9),
      duration: 3000,
      position: "top",
      gradient: false,
      ...config,
    };

    this.listeners.forEach((listener) => listener(toast));
  }
}

export const toastManager = new ToastManager();

// Toast Provider Component
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  React.useEffect(() => {
    const unsubscribe = toastManager.subscribe((toast) => {
      setToasts((prev) => [...prev, toast]);

      // Auto remove after duration
      if (toast.duration) {
        setTimeout(() => {
          removeToast(toast.id);
        }, toast.duration);
      }
    });

    return unsubscribe;
  }, [removeToast]);

  return (
    <>
      {children}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </View>
    </>
  );
}

// Toast Item Component
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const translateY = useSharedValue(toast.position === "top" ? -100 : 100);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    // Enter animation
    translateY.value = withSpring(0, SpringConfigs.gentle);
    opacity.value = withTiming(1, { duration: 250 });

    // Exit animation
    if (toast.duration) {
      const exitDelay = toast.duration - 250;
      translateY.value = withDelay(
        exitDelay,
        withTiming(toast.position === "top" ? -100 : 100, { duration: 250 })
      );
      opacity.value = withDelay(
        exitDelay,
        withTiming(0, { duration: 250 }, () => {
          runOnJS(onDismiss)();
        })
      );
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Get colors based on variant
  const getColors = () => {
    switch (toast.variant) {
      case "success":
        return {
          gradient: PremiumGradients.success,
          solid: BrandColors.success,
          light: BrandColors.successLight,
        };
      case "error":
        return {
          gradient: PremiumGradients.error,
          solid: BrandColors.error,
          light: BrandColors.errorLight,
        };
      case "warning":
        return {
          gradient: PremiumGradients.warning,
          solid: BrandColors.warning,
          light: BrandColors.warningLight,
        };
      case "info":
        return {
          gradient: PremiumGradients.blue,
          solid: BrandColors.info,
          light: BrandColors.infoLight,
        };
      default:
        return {
          gradient: PremiumGradients.blue,
          solid: BrandColors.info,
          light: BrandColors.infoLight,
        };
    }
  };

  const colors = getColors();

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          [toast.position === "top" ? "top" : "bottom"]:
            Platform.OS === "ios" ? 60 : 20,
        },
        Platform.select({
          ios: PremiumShadows.medium.ios,
          android: PremiumShadows.medium.android,
        }),
        animatedStyle,
      ]}
    >
      {/* Gradient Background */}
      {toast.gradient ? (
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.backgroundRoot },
          ]}
        />
      )}

      {/* Content */}
      <View style={styles.toastContent}>
        {/* Icon */}
        {toast.icon && <View style={styles.iconContainer}>{toast.icon}</View>}

        {/* Text */}
        <View style={styles.textContainer}>
          {toast.title && (
            <ThemedText
              type="small"
              style={[
                styles.toastTitle,
                {
                  color: toast.gradient ? '#FFFFFF' : theme.text,
                  fontWeight: '600',
                },
              ]}
            >
              {toast.title}
            </ThemedText>
          )}
          <ThemedText
            type="small"
            style={[
              styles.toastMessage,
              {
                color: toast.gradient
                  ? 'rgba(255, 255, 255, 0.9)'
                  : theme.text,
              },
            ]}
          >
            {toast.message}
          </ThemedText>
        </View>

        {/* Color indicator (when not gradient) */}
        {!toast.gradient && (
          <View
            style={[
              styles.colorIndicator,
              { backgroundColor: colors.solid },
            ]}
          />
        )}
      </View>
    </Animated.View>
  );
}

// Convenience methods
export const Toast = {
  show: (config: ToastConfig) => toastManager.show(config),
  success: (message: string, title?: string) =>
    toastManager.show({ variant: "success", message, title }),
  error: (message: string, title?: string) =>
    toastManager.show({ variant: "error", message, title }),
  warning: (message: string, title?: string) =>
    toastManager.show({ variant: "warning", message, title }),
  info: (message: string, title?: string) =>
    toastManager.show({ variant: "info", message, title }),
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    position: 'absolute',
    width: SCREEN_WIDTH - Spacing['2xl'] * 2,
    maxWidth: 400,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    position: 'relative',
  },
  iconContainer: {
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  toastTitle: {
    marginBottom: Spacing.xs / 2,
  },
  toastMessage: {
    lineHeight: 18,
  },
  colorIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
});
