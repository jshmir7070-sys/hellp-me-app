import React, { ReactNode } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  PremiumGradients,
  PremiumColors,
  PremiumShadows,
} from "@/constants/theme";

type HeaderVariant = "default" | "glass" | "gradient" | "transparent";

interface HeaderProps {
  variant?: HeaderVariant;
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
  gradient?: string[];
  blur?: boolean;
  transparent?: boolean;
  scrollY?: Animated.SharedValue<number>; // For dynamic header on scroll
  style?: StyleProp<ViewStyle>;
}

export function Header({
  variant = "default",
  title,
  left,
  right,
  gradient,
  blur = true,
  transparent = false,
  scrollY,
  style,
}: HeaderProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Get gradient colors
  const getGradientColors = (): string[] => {
    if (gradient) return gradient;
    return PremiumGradients.blue;
  };

  const gradientColors = getGradientColors();

  // Animated header based on scroll
  const animatedStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};

    const opacity = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      Extrapolate.CLAMP
    );

    return {
      opacity: variant === "transparent" ? opacity : 1,
    };
  });

  const headerHeight = 56 + insets.top;

  // Transparent variant
  if (variant === "transparent") {
    return (
      <Animated.View
        style={[
          styles.header,
          {
            height: headerHeight,
            paddingTop: insets.top,
            backgroundColor: 'transparent',
          },
          animatedStyle,
          style,
        ]}
      >
        <View style={styles.content}>
          {/* Left */}
          {left && <View style={styles.left}>{left}</View>}

          {/* Title */}
          {title && (
            <View style={styles.center}>
              <ThemedText type="h4" style={{ color: theme.text }}>
                {title}
              </ThemedText>
            </View>
          )}

          {/* Right */}
          {right && <View style={styles.right}>{right}</View>}
        </View>
      </Animated.View>
    );
  }

  // Glass variant
  if (variant === "glass") {
    return (
      <Animated.View
        style={[
          styles.header,
          {
            height: headerHeight,
            paddingTop: insets.top,
            backgroundColor: PremiumColors.glassMedium,
            borderBottomWidth: 1,
            borderBottomColor: PremiumColors.borderLight,
          },
          Platform.select({
            ios: PremiumShadows.small.ios,
            android: { elevation: 4 },
          }),
          animatedStyle,
          style,
        ]}
      >
        {blur && Platform.OS === 'ios' && (
          <BlurView
            intensity={20}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.content}>
          {/* Left */}
          {left && <View style={styles.left}>{left}</View>}

          {/* Title */}
          {title && (
            <View style={styles.center}>
              <ThemedText type="h4" style={{ color: theme.text }}>
                {title}
              </ThemedText>
            </View>
          )}

          {/* Right */}
          {right && <View style={styles.right}>{right}</View>}
        </View>
      </Animated.View>
    );
  }

  // Gradient variant
  if (variant === "gradient") {
    return (
      <Animated.View
        style={[
          styles.header,
          {
            height: headerHeight,
            paddingTop: insets.top,
            overflow: 'hidden',
          },
          Platform.select({
            ios: PremiumShadows.medium.ios,
            android: { elevation: 8 },
          }),
          animatedStyle,
          style,
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          {/* Left */}
          {left && <View style={styles.left}>{left}</View>}

          {/* Title */}
          {title && (
            <View style={styles.center}>
              <ThemedText
                type="h4"
                style={{ color: '#FFFFFF', fontWeight: '700' }}
              >
                {title}
              </ThemedText>
            </View>
          )}

          {/* Right */}
          {right && <View style={styles.right}>{right}</View>}
        </View>
      </Animated.View>
    );
  }

  // Default variant
  return (
    <Animated.View
      style={[
        styles.header,
        {
          height: headerHeight,
          paddingTop: insets.top,
          backgroundColor: theme.backgroundRoot,
          borderBottomWidth: 1,
          borderBottomColor: theme.backgroundSecondary,
        },
        Platform.select({
          ios: PremiumShadows.small.ios,
          android: { elevation: 2 },
        }),
        animatedStyle,
        style,
      ]}
    >
      <View style={styles.content}>
        {/* Left */}
        {left && <View style={styles.left}>{left}</View>}

        {/* Title */}
        {title && (
          <View style={styles.center}>
            <ThemedText type="h4" style={{ color: theme.text }}>
              {title}
            </ThemedText>
          </View>
        )}

        {/* Right */}
        {right && <View style={styles.right}>{right}</View>}
      </View>
    </Animated.View>
  );
}

// Back Button Component
export function HeaderBackButton({ onPress }: { onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={styles.backButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <ThemedText style={{ fontSize: 28, color: theme.text }}>‹</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    position: 'relative',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    minHeight: 56,
  },
  left: {
    width: 44,
    height: 56,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  right: {
    width: 44,
    height: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
