import React, { ReactNode } from "react";
import {
  StyleSheet,
  Pressable,
  Platform,
  ViewStyle,
  StyleProp,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { LinearGradient } from 'expo-linear-gradient';

import {
  Spacing,
  BorderRadius,
  PremiumGradients,
  PremiumShadows,
} from "@/constants/theme";

type FABVariant = "default" | "premium" | "gradient";
type FABPosition = "bottom-right" | "bottom-left" | "bottom-center";
type FABSize = "md" | "lg";

interface FloatingActionButtonProps {
  variant?: FABVariant;
  icon: ReactNode;
  position?: FABPosition;
  size?: FABSize;
  gradient?: string[];
  shadow?: "small" | "medium" | "large";
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function FloatingActionButton({
  variant = "default",
  icon,
  position = "bottom-right",
  size = "lg",
  gradient,
  shadow = "large",
  onPress,
  style,
}: FloatingActionButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  // Get position style
  const getPositionStyle = (): ViewStyle => {
    const offset = Spacing.xl;
    switch (position) {
      case "bottom-right":
        return { bottom: offset, right: offset };
      case "bottom-left":
        return { bottom: offset, left: offset };
      case "bottom-center":
        return { bottom: offset, alignSelf: 'center' };
      default:
        return { bottom: offset, right: offset };
    }
  };

  // Get size dimensions
  const getSizeDimensions = () => {
    switch (size) {
      case "md":
        return { width: 56, height: 56 };
      case "lg":
        return { width: 64, height: 64 };
      default:
        return { width: 64, height: 64 };
    }
  };

  // Get gradient colors
  const getGradientColors = (): string[] => {
    if (gradient) return gradient;
    if (variant === "premium") return PremiumGradients.gold;
    return PremiumGradients.blue;
  };

  const dimensions = getSizeDimensions();
  const gradientColors = getGradientColors();
  const positionStyle = getPositionStyle();

  // Get shadow style
  const getShadowStyle = () => {
    switch (shadow) {
      case "small":
        return Platform.select({
          ios: PremiumShadows.small.ios,
          android: PremiumShadows.small.android,
        });
      case "medium":
        return Platform.select({
          ios: PremiumShadows.medium.ios,
          android: PremiumShadows.medium.android,
        });
      case "large":
        return Platform.select({
          ios: PremiumShadows.large.ios,
          android: PremiumShadows.large.android,
        });
      default:
        return Platform.select({
          ios: PremiumShadows.large.ios,
          android: PremiumShadows.large.android,
        });
    }
  };

  const shadowStyle = getShadowStyle();

  // Premium/Gradient variant
  if (variant === "premium" || variant === "gradient") {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.fab,
          positionStyle,
          {
            width: dimensions.width,
            height: dimensions.height,
            borderRadius: dimensions.width / 2,
            overflow: 'hidden',
          },
          variant === "premium" && Platform.select({
            ios: PremiumShadows.glow.ios,
            android: PremiumShadows.glow.android,
          }),
          variant !== "premium" && shadowStyle,
          animatedStyle,
          style,
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
        >
          {icon}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  // Default variant (not implemented in this minimal version)
  return null;
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Export as FAB for convenience
export const FAB = FloatingActionButton;
