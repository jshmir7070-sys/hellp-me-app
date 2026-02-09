import React, { ReactNode } from "react";
import { StyleSheet, View, ViewStyle, StyleProp, Platform } from "react-native";
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

type StatTrend = "up" | "down" | "neutral";

interface StatCardProps {
  variant?: "default" | "gradient";
  label: string;
  value: string | number;
  change?: string;
  trend?: StatTrend;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  gradient?: string[];
}

export function StatCard({
  variant = "default",
  label,
  value,
  change,
  trend = "neutral",
  icon,
  style,
  gradient,
}: StatCardProps) {
  const { theme } = useTheme();

  // Get trend color
  const getTrendColor = () => {
    switch (trend) {
      case "up":
        return BrandColors.success;
      case "down":
        return BrandColors.error;
      default:
        return theme.tabIconDefault;
    }
  };

  // Get gradient colors
  const getGradientColors = (): string[] => {
    if (gradient) return gradient;
    return PremiumGradients.blue;
  };

  const gradientColors = getGradientColors();
  const trendColor = getTrendColor();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: variant === "gradient" ? 'transparent' : theme.backgroundRoot,
        },
        Platform.select({
          ios: PremiumShadows.medium.ios,
          android: PremiumShadows.medium.android,
        }),
        style,
      ]}
    >
      {/* Gradient Background */}
      {variant === "gradient" && (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Top Row */}
        <View style={styles.topRow}>
          <ThemedText
            type="small"
            style={[
              styles.label,
              {
                color:
                  variant === "gradient"
                    ? 'rgba(255, 255, 255, 0.8)'
                    : theme.tabIconDefault,
              },
            ]}
          >
            {label}
          </ThemedText>
          {icon && (
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    variant === "gradient"
                      ? 'rgba(255, 255, 255, 0.2)'
                      : theme.backgroundSecondary,
                },
              ]}
            >
              {icon}
            </View>
          )}
        </View>

        {/* Value */}
        <ThemedText
          type="h2"
          style={[
            styles.value,
            { color: variant === "gradient" ? '#FFFFFF' : theme.text },
          ]}
        >
          {value}
        </ThemedText>

        {/* Change */}
        {change && (
          <View style={styles.changeRow}>
            <ThemedText
              type="small"
              style={[
                styles.change,
                {
                  color:
                    variant === "gradient"
                      ? 'rgba(255, 255, 255, 0.9)'
                      : trendColor,
                  fontWeight: '600',
                },
              ]}
            >
              {trend === "up" && "↑ "}
              {trend === "down" && "↓ "}
              {change}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 120,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    marginBottom: Spacing.xs,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  change: {
    fontSize: 14,
  },
});
