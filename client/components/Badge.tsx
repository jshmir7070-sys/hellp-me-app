import React, { ReactNode, useEffect } from "react";
import {
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
  Platform,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  BorderRadius,
  Spacing,
  PremiumGradients,
  PremiumColors,
  BrandColors,
} from "@/constants/theme";

type BadgeVariant = "solid" | "gradient" | "outline" | "glow";
type BadgeColor = "purple" | "pink" | "gold" | "green" | "red" | "blue" | "neutral";
type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  color?: BadgeColor;
  size?: BadgeSize;
  pulse?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export function Badge({
  children,
  variant = "solid",
  color = "purple",
  size = "md",
  pulse = false,
  style,
  icon,
}: BadgeProps) {
  const { theme, isDark } = useTheme();
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  // Pulse animation
  useEffect(() => {
    if (pulse) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
    }
  }, [pulse]);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Get color gradients
  const getColorGradient = (): string[] => {
    switch (color) {
      case "purple":
        return PremiumGradients.purple;
      case "pink":
        return PremiumGradients.pink;
      case "gold":
        return PremiumGradients.gold;
      case "green":
        return PremiumGradients.success;
      case "red":
        return PremiumGradients.error;
      case "blue":
        return PremiumGradients.blue;
      case "neutral":
        return [BrandColors.neutral, BrandColors.neutral];
      default:
        return PremiumGradients.purple;
    }
  };

  // Get solid color
  const getSolidColor = (): string => {
    switch (color) {
      case "purple":
        return PremiumGradients.purple[0];
      case "pink":
        return PremiumGradients.pink[0];
      case "gold":
        return PremiumGradients.gold[0];
      case "green":
        return BrandColors.success;
      case "red":
        return BrandColors.error;
      case "blue":
        return BrandColors.primary;
      case "neutral":
        return BrandColors.neutral;
      default:
        return PremiumGradients.purple[0];
    }
  };

  // Get size dimensions
  const getSizeDimensions = () => {
    switch (size) {
      case "sm":
        return {
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs / 2,
          fontSize: 10,
          height: 18,
        };
      case "md":
        return {
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
          fontSize: 12,
          height: 24,
        };
      case "lg":
        return {
          paddingHorizontal: Spacing.lg,
          paddingVertical: Spacing.sm,
          fontSize: 14,
          height: 32,
        };
      default:
        return {
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
          fontSize: 12,
          height: 24,
        };
    }
  };

  const dimensions = getSizeDimensions();
  const gradientColors = getColorGradient();
  const solidColor = getSolidColor();

  // Solid variant
  if (variant === "solid") {
    return (
      <Animated.View
        style={[
          styles.badge,
          {
            backgroundColor: solidColor,
            paddingHorizontal: dimensions.paddingHorizontal,
            paddingVertical: dimensions.paddingVertical,
            height: dimensions.height,
          },
          pulse && pulseAnimatedStyle,
          style,
        ]}
      >
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <ThemedText
          style={[
            styles.text,
            {
              fontSize: dimensions.fontSize,
              color: '#FFFFFF',
            },
          ]}
        >
          {children}
        </ThemedText>
      </Animated.View>
    );
  }

  // Gradient variant
  if (variant === "gradient") {
    return (
      <Animated.View
        style={[
          styles.badge,
          {
            paddingHorizontal: dimensions.paddingHorizontal,
            paddingVertical: dimensions.paddingVertical,
            height: dimensions.height,
            overflow: 'hidden',
          },
          pulse && pulseAnimatedStyle,
          style,
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.gradientContent}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <ThemedText
            style={[
              styles.text,
              {
                fontSize: dimensions.fontSize,
                color: '#FFFFFF',
              },
            ]}
          >
            {children}
          </ThemedText>
        </View>
      </Animated.View>
    );
  }

  // Outline variant
  if (variant === "outline") {
    return (
      <Animated.View
        style={[
          styles.badge,
          styles.outlineBadge,
          {
            borderColor: solidColor,
            paddingHorizontal: dimensions.paddingHorizontal,
            paddingVertical: dimensions.paddingVertical,
            height: dimensions.height,
          },
          pulse && pulseAnimatedStyle,
          style,
        ]}
      >
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <ThemedText
          style={[
            styles.text,
            {
              fontSize: dimensions.fontSize,
              color: solidColor,
            },
          ]}
        >
          {children}
        </ThemedText>
      </Animated.View>
    );
  }

  // Glow variant
  if (variant === "glow") {
    return (
      <Animated.View
        style={[
          styles.badge,
          styles.glowBadge,
          {
            paddingHorizontal: dimensions.paddingHorizontal,
            paddingVertical: dimensions.paddingVertical,
            height: dimensions.height,
            overflow: 'hidden',
          },
          Platform.select({
            ios: {
              shadowColor: solidColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 10,
            },
            android: {
              elevation: 8,
            },
          }),
          pulse && pulseAnimatedStyle,
          style,
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.gradientContent}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <ThemedText
            style={[
              styles.text,
              {
                fontSize: dimensions.fontSize,
                color: '#FFFFFF',
                fontWeight: '700',
              },
            ]}
          >
            {children}
          </ThemedText>
        </View>
      </Animated.View>
    );
  }

  // Default fallback
  return null;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    position: 'relative',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  outlineBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  glowBadge: {
    // Shadow added inline
  },
  gradientContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: Spacing.xs,
  },
});
