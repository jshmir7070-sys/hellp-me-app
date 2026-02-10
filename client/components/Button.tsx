import React, { ReactNode } from "react";
import { StyleSheet, Pressable, ViewStyle, StyleProp, Platform, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, PremiumGradients, PremiumColors, PremiumShadows, SpringConfigs } from "@/constants/theme";

type ButtonVariant =
  | "legacy"      // 기존 스타일 (하위 호환)
  | "primary"     // 프리미엄 그라데이션
  | "secondary"   // 보조 액션
  | "outline"     // 아웃라인
  | "ghost"       // 텍스트만
  | "premium"     // 최고급 (glow 효과)
  | "glass";      // Glass 효과

type ButtonSize = "sm" | "md" | "lg" | "xl";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;

  // 🎨 프리미엄 Props
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  gradient?: string[];  // 커스텀 그라데이션
  loading?: boolean;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  onPress,
  children,
  style,
  disabled = false,
  variant = "primary",  // 기본값: Toss-style 블루 그라데이션
  size = "md",
  fullWidth = false,
  icon,
  iconPosition = "left",
  gradient,
  loading = false,
}: ButtonProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(1, springConfig);
    }
  };

  // Get gradient colors based on variant
  const getGradient = (): string[] | null => {
    if (gradient) return gradient;

    switch (variant) {
      case "primary":
        return PremiumGradients.blue;
      case "premium":
        return PremiumGradients.gold;
      case "secondary":
        return PremiumGradients.purple;
      default:
        return null;
    }
  };

  // Get button height based on size
  const getHeight = (): number => {
    switch (size) {
      case "sm": return 40;
      case "md": return Spacing.buttonHeight;
      case "lg": return 56;
      case "xl": return 64;
      default: return Spacing.buttonHeight;
    }
  };

  // Get text size based on button size
  const getTextSize = (): number => {
    switch (size) {
      case "sm": return 14;
      case "md": return 16;
      case "lg": return 18;
      case "xl": return 20;
      default: return 16;
    }
  };

  // Get padding based on size
  const getPadding = (): number => {
    switch (size) {
      case "sm": return Spacing.md;
      case "md": return Spacing.lg;
      case "lg": return Spacing.xl;
      case "xl": return Spacing["2xl"];
      default: return Spacing.lg;
    }
  };

  // Legacy variant (기존 스타일 - 하위 호환)
  if (variant === "legacy") {
    return (
      <AnimatedPressable
        onPress={disabled || loading ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.button,
          {
            backgroundColor: theme.link,
            opacity: disabled ? 0.5 : 1,
            height: getHeight(),
            paddingHorizontal: getPadding(),
            width: fullWidth ? '100%' : undefined,
          },
          style,
          animatedStyle,
        ]}
      >
        {icon && iconPosition === "left" && <View style={styles.iconLeft}>{icon}</View>}
        <ThemedText
          type="body"
          style={[styles.buttonText, { color: theme.buttonText, fontSize: getTextSize() }]}
        >
          {loading ? "로딩 중..." : children}
        </ThemedText>
        {icon && iconPosition === "right" && <View style={styles.iconRight}>{icon}</View>}
      </AnimatedPressable>
    );
  }

  // Glass variant
  if (variant === "glass") {
    return (
      <AnimatedPressable
        onPress={disabled || loading ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.button,
          styles.glassButton,
          {
            height: getHeight(),
            paddingHorizontal: getPadding(),
            width: fullWidth ? '100%' : undefined,
            opacity: disabled ? 0.5 : 1,
          },
          Platform.select({
            ios: PremiumShadows.medium.ios,
            android: PremiumShadows.medium.android,
          }),
          style,
          animatedStyle,
        ]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 20 : 40}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glassContent}>
          {icon && iconPosition === "left" && <View style={styles.iconLeft}>{icon}</View>}
          <ThemedText
            type="body"
            style={[styles.buttonText, { fontSize: getTextSize(), color: '#FFFFFF' }]}
          >
            {loading ? "로딩 중..." : children}
          </ThemedText>
          {icon && iconPosition === "right" && <View style={styles.iconRight}>{icon}</View>}
        </View>
      </AnimatedPressable>
    );
  }

  // Ghost variant
  if (variant === "ghost") {
    return (
      <AnimatedPressable
        onPress={disabled || loading ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.button,
          styles.ghostButton,
          {
            height: getHeight(),
            paddingHorizontal: getPadding(),
            width: fullWidth ? '100%' : undefined,
            opacity: disabled ? 0.5 : 1,
          },
          style,
          animatedStyle,
        ]}
      >
        {icon && iconPosition === "left" && <View style={styles.iconLeft}>{icon}</View>}
        <ThemedText
          type="body"
          style={[styles.buttonText, { fontSize: getTextSize(), color: theme.link }]}
        >
          {loading ? "로딩 중..." : children}
        </ThemedText>
        {icon && iconPosition === "right" && <View style={styles.iconRight}>{icon}</View>}
      </AnimatedPressable>
    );
  }

  // Outline variant
  if (variant === "outline") {
    return (
      <AnimatedPressable
        onPress={disabled || loading ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.button,
          styles.outlineButton,
          {
            borderColor: theme.link,
            height: getHeight(),
            paddingHorizontal: getPadding(),
            width: fullWidth ? '100%' : undefined,
            opacity: disabled ? 0.5 : 1,
          },
          style,
          animatedStyle,
        ]}
      >
        {icon && iconPosition === "left" && <View style={styles.iconLeft}>{icon}</View>}
        <ThemedText
          type="body"
          style={[styles.buttonText, { fontSize: getTextSize(), color: theme.link }]}
        >
          {loading ? "로딩 중..." : children}
        </ThemedText>
        {icon && iconPosition === "right" && <View style={styles.iconRight}>{icon}</View>}
      </AnimatedPressable>
    );
  }

  // Gradient variants (primary, secondary, premium)
  const gradientColors = getGradient();

  return (
    <AnimatedPressable
      onPress={disabled || loading ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          height: getHeight(),
          paddingHorizontal: getPadding(),
          width: fullWidth ? '100%' : undefined,
          opacity: disabled ? 0.5 : 1,
          overflow: 'hidden',
        },
        variant === "premium" && Platform.select({
          ios: PremiumShadows.glow.ios,
          android: PremiumShadows.glow.android,
        }),
        variant !== "premium" && Platform.select({
          ios: PremiumShadows.medium.ios,
          android: PremiumShadows.medium.android,
        }),
        style,
        animatedStyle,
      ]}
    >
      {gradientColors && (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={styles.gradientContent}>
        {icon && iconPosition === "left" && <View style={styles.iconLeft}>{icon}</View>}
        <ThemedText
          type="body"
          style={[
            styles.buttonText,
            {
              fontSize: getTextSize(),
              color: '#FFFFFF',
              fontWeight: variant === "premium" ? '700' : '600',
            }
          ]}
        >
          {loading ? "로딩 중..." : children}
        </ThemedText>
        {icon && iconPosition === "right" && <View style={styles.iconRight}>{icon}</View>}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    position: 'relative',
  },
  buttonText: {
    fontWeight: "600",
  },
  glassButton: {
    backgroundColor: PremiumColors.glassMedium,
    borderWidth: 1,
    borderColor: PremiumColors.borderLight,
    overflow: 'hidden',
  },
  glassContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  gradientContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: Spacing.sm,
  },
  iconRight: {
    marginLeft: Spacing.sm,
  },
});
