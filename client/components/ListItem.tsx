import React, { ReactNode } from "react";
import {
  StyleSheet,
  Pressable,
  View,
  ViewStyle,
  StyleProp,
  Platform,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { BlurView } from 'expo-blur';

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  BorderRadius,
  Spacing,
  PremiumColors,
  PremiumShadows,
} from "@/constants/theme";

type ListItemVariant = "default" | "glass";

interface ListItemProps {
  variant?: ListItemVariant;
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  badge?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ListItem({
  variant = "default",
  left,
  title,
  subtitle,
  right,
  badge,
  onPress,
  disabled = false,
  style,
}: ListItemProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig);
    }
  };

  // Glass variant
  if (variant === "glass") {
    return (
      <AnimatedPressable
        onPress={disabled ? undefined : onPress}
        onPressIn={onPress ? handlePressIn : undefined}
        onPressOut={onPress ? handlePressOut : undefined}
        disabled={disabled}
        style={[
          styles.listItem,
          styles.glassItem,
          {
            opacity: disabled ? 0.5 : 1,
          },
          Platform.select({
            ios: PremiumShadows.small.ios,
            android: PremiumShadows.small.android,
          }),
          animatedStyle,
          style,
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 20 : 40}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          {/* Left */}
          {left && <View style={styles.left}>{left}</View>}

          {/* Center */}
          <View style={styles.center}>
            <View style={styles.titleRow}>
              <ThemedText
                type="body"
                style={[styles.title, { color: theme.text }]}
              >
                {title}
              </ThemedText>
              {badge && <View style={styles.badge}>{badge}</View>}
            </View>
            {subtitle && (
              <ThemedText
                type="small"
                style={[
                  styles.subtitle,
                  { color: theme.tabIconDefault },
                ]}
              >
                {subtitle}
              </ThemedText>
            )}
          </View>

          {/* Right */}
          {right && <View style={styles.right}>{right}</View>}
        </View>
      </AnimatedPressable>
    );
  }

  // Default variant
  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={onPress ? handlePressIn : undefined}
      onPressOut={onPress ? handlePressOut : undefined}
      disabled={disabled}
      style={[
        styles.listItem,
        {
          backgroundColor: theme.backgroundRoot,
          opacity: disabled ? 0.5 : 1,
        },
        Platform.select({
          ios: PremiumShadows.small.ios,
          android: PremiumShadows.small.android,
        }),
        animatedStyle,
        style,
      ]}
    >
      <View style={styles.content}>
        {/* Left */}
        {left && <View style={styles.left}>{left}</View>}

        {/* Center */}
        <View style={styles.center}>
          <View style={styles.titleRow}>
            <ThemedText
              type="body"
              style={[styles.title, { color: theme.text }]}
            >
              {title}
            </ThemedText>
            {badge && <View style={styles.badge}>{badge}</View>}
          </View>
          {subtitle && (
            <ThemedText
              type="small"
              style={[styles.subtitle, { color: theme.tabIconDefault }]}
            >
              {subtitle}
            </ThemedText>
          )}
        </View>

        {/* Right */}
        {right && <View style={styles.right}>{right}</View>}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  listItem: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  glassItem: {
    backgroundColor: PremiumColors.glassMedium,
    borderWidth: 1,
    borderColor: PremiumColors.borderLight,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  left: {
    marginRight: Spacing.md,
  },
  center: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs / 2,
  },
  title: {
    flex: 1,
  },
  badge: {
    marginLeft: Spacing.sm,
  },
  subtitle: {
    lineHeight: 18,
  },
  right: {
    marginLeft: Spacing.md,
  },
});
