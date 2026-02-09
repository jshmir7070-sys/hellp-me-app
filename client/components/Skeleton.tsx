import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from "@/hooks/useTheme";
import {
  BorderRadius,
  Spacing,
  PremiumColors,
} from "@/constants/theme";

type SkeletonVariant = "text" | "card" | "avatar" | "list" | "custom";

interface SkeletonProps {
  variant?: SkeletonVariant;
  animated?: boolean;
  gradient?: boolean;
  width?: number | string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  variant = "text",
  animated = true,
  gradient = true,
  width,
  height,
  style,
}: SkeletonProps) {
  const { theme, isDark } = useTheme();
  const opacity = useSharedValue(1);

  // Pulse animation
  useEffect(() => {
    if (animated) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
    }
  }, [animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const baseColor = isDark
    ? theme.backgroundSecondary
    : theme.backgroundDefault;

  const gradientColors = gradient
    ? [
        baseColor,
        isDark ? PremiumColors.glassDarkMedium : PremiumColors.glassLight,
        baseColor,
      ]
    : [baseColor, baseColor];

  // Text variant
  if (variant === "text") {
    return (
      <Animated.View
        style={[
          styles.text,
          {
            width: width || '100%',
            height: height || 16,
            backgroundColor: baseColor,
          },
          animated && animatedStyle,
          style,
        ]}
      >
        {gradient && (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        )}
      </Animated.View>
    );
  }

  // Avatar variant
  if (variant === "avatar") {
    const avatarSize = height || 48;
    return (
      <Animated.View
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: baseColor,
          },
          animated && animatedStyle,
          style,
        ]}
      >
        {gradient && (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        )}
      </Animated.View>
    );
  }

  // Card variant
  if (variant === "card") {
    return (
      <Animated.View
        style={[
          styles.card,
          {
            width: width || '100%',
            height: height || 120,
            backgroundColor: baseColor,
          },
          animated && animatedStyle,
          style,
        ]}
      >
        {gradient && (
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        )}
      </Animated.View>
    );
  }

  // List variant
  if (variant === "list") {
    return (
      <View style={[styles.listItem, style]}>
        <Skeleton variant="avatar" animated={animated} gradient={gradient} />
        <View style={styles.listContent}>
          <Skeleton
            variant="text"
            width="60%"
            height={16}
            animated={animated}
            gradient={gradient}
            style={{ marginBottom: Spacing.sm }}
          />
          <Skeleton
            variant="text"
            width="40%"
            height={12}
            animated={animated}
            gradient={gradient}
          />
        </View>
      </View>
    );
  }

  // Custom variant
  return (
    <Animated.View
      style={[
        {
          width: width || '100%',
          height: height || 20,
          borderRadius: BorderRadius.xs,
          backgroundColor: baseColor,
        },
        animated && animatedStyle,
        style,
      ]}
    >
      {gradient && (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}
    </Animated.View>
  );
}

// Skeleton Group component for multiple skeletons
export function SkeletonGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  text: {
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
  },
  avatar: {
    overflow: 'hidden',
  },
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  listContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
});
