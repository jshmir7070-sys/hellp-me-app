import React, { ReactNode } from "react";
import { StyleSheet, View, ViewStyle, StyleProp, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  WithSpringConfig,
} from "react-native-reanimated";
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  BorderRadius,
  Spacing,
  PremiumGradients,
  PremiumShadows,
  BrandColors,
} from "@/constants/theme";

type OrderStatus = "pending" | "in_progress" | "completed" | "cancelled";

interface StatusCardProps {
  status: OrderStatus;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  gradient?: boolean;
  progress?: number; // 0-100
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
};

export function StatusCard({
  status,
  title,
  subtitle,
  icon,
  gradient = false,
  progress,
  style,
  onPress,
}: StatusCardProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, springConfig);
    }
  };

  // Get status colors
  const getStatusColors = () => {
    switch (status) {
      case "pending":
        return {
          gradient: PremiumGradients.warning,
          solid: BrandColors.warning,
          light: BrandColors.warningLight,
        };
      case "in_progress":
        return {
          gradient: PremiumGradients.blue,
          solid: BrandColors.inProgress,
          light: BrandColors.inProgressLight,
        };
      case "completed":
        return {
          gradient: PremiumGradients.success,
          solid: BrandColors.success,
          light: BrandColors.successLight,
        };
      case "cancelled":
        return {
          gradient: PremiumGradients.error,
          solid: BrandColors.error,
          light: BrandColors.errorLight,
        };
      default:
        return {
          gradient: PremiumGradients.blue,
          solid: BrandColors.info,
          light: BrandColors.infoLight,
        };
    }
  };

  const colors = getStatusColors();

  const Component = onPress ? Animated.createAnimatedComponent(View) : Animated.View;

  return (
    <Component
      style={[
        styles.card,
        {
          backgroundColor: gradient ? 'transparent' : theme.backgroundRoot,
        },
        Platform.select({
          ios: PremiumShadows.medium.ios,
          android: PremiumShadows.medium.android,
        }),
        animatedStyle,
        style,
      ]}
      onTouchStart={onPress ? handlePressIn : undefined}
      onTouchEnd={onPress ? handlePressOut : undefined}
    >
      {/* Gradient Background */}
      {gradient && (
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Icon */}
        {icon && (
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: gradient
                  ? 'rgba(255, 255, 255, 0.2)'
                  : colors.light,
              },
            ]}
          >
            {icon}
          </View>
        )}

        {/* Text */}
        <View style={styles.textContainer}>
          <ThemedText
            type="h4"
            style={[
              styles.title,
              { color: gradient ? '#FFFFFF' : theme.text },
            ]}
          >
            {title}
          </ThemedText>
          {subtitle && (
            <ThemedText
              type="small"
              style={[
                styles.subtitle,
                {
                  color: gradient
                    ? 'rgba(255, 255, 255, 0.8)'
                    : theme.tabIconDefault,
                },
              ]}
            >
              {subtitle}
            </ThemedText>
          )}
        </View>

        {/* Status Indicator */}
        {!gradient && (
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: colors.solid },
            ]}
          />
        )}
      </View>

      {/* Progress Bar */}
      {progress !== undefined && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBackground,
              {
                backgroundColor: gradient
                  ? 'rgba(255, 255, 255, 0.2)'
                  : colors.light,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: `${progress}%`,
                  backgroundColor: gradient ? '#FFFFFF' : colors.solid,
                },
              ]}
            />
          </View>
          <ThemedText
            type="small"
            style={[
              styles.progressText,
              { color: gradient ? '#FFFFFF' : theme.text },
            ]}
          >
            {progress}%
          </ThemedText>
        </View>
      )}
    </Component>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    marginBottom: Spacing.xs / 2,
  },
  subtitle: {
    lineHeight: 18,
  },
  statusIndicator: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  progressBackground: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
});
