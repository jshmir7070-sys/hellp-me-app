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

type CardVariant =
  | "legacy"      // 기존 스타일 (하위 호환)
  | "elevated"    // 그림자 강조
  | "gradient"    // 그라데이션 배경
  | "glass"       // Glass morphism
  | "outline"     // 아웃라인만
  | "flat";       // 평면 (그림자 없음)

type CardPadding = "none" | "sm" | "md" | "lg" | "xl";

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;

  // Legacy props (하위 호환)
  elevation?: number;
  title?: string;
  description?: string;

  // 🎨 Premium Props
  variant?: CardVariant;
  padding?: CardPadding;
  gradient?: string[];  // 커스텀 그라데이션
  borderless?: boolean;

  // Header/Footer
  header?: ReactNode;
  footer?: ReactNode;

  // Interactive
  pressable?: boolean;
  disabled?: boolean;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const getBackgroundColorForElevation = (
  elevation: number,
  theme: any,
): string => {
  switch (elevation) {
    case 1:
      return theme.backgroundDefault;
    case 2:
      return theme.backgroundSecondary;
    case 3:
      return theme.backgroundTertiary;
    default:
      return theme.backgroundRoot;
  }
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedView = Animated.createAnimatedComponent(View);

export function Card({
  children,
  style,
  onPress,
  elevation = 1,
  title,
  description,
  variant = "legacy",
  padding = "lg",
  gradient,
  borderless = false,
  header,
  footer,
  pressable = true,
  disabled = false,
}: CardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const cardBackgroundColor = getBackgroundColorForElevation(elevation, theme);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (pressable && !disabled && onPress) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    if (pressable && !disabled && onPress) {
      scale.value = withSpring(1, springConfig);
    }
  };

  // Get padding value
  const getPaddingValue = (): number => {
    switch (padding) {
      case "none": return 0;
      case "sm": return Spacing.md;
      case "md": return Spacing.lg;
      case "lg": return Spacing.xl;
      case "xl": return Spacing["2xl"];
      default: return Spacing.xl;
    }
  };

  // Get gradient colors
  const getGradient = (): string[] | null => {
    if (gradient) return gradient;
    if (variant === "gradient") {
      return PremiumGradients.blue;
    }
    return null;
  };

  const paddingValue = getPaddingValue();
  const gradientColors = getGradient();

  // Legacy variant (기존 스타일 - 하위 호환)
  if (variant === "legacy") {
    const Component = onPress ? AnimatedPressable : AnimatedView;
    return (
      <Component
        onPress={onPress}
        onPressIn={onPress ? handlePressIn : undefined}
        onPressOut={onPress ? handlePressOut : undefined}
        style={[
          styles.card,
          {
            backgroundColor: cardBackgroundColor,
            padding: paddingValue,
          },
          animatedStyle,
          style,
        ]}
      >
        {title ? (
          <ThemedText type="h4" style={styles.cardTitle}>
            {title}
          </ThemedText>
        ) : null}
        {description ? (
          <ThemedText type="small" style={styles.cardDescription}>
            {description}
          </ThemedText>
        ) : null}
        {children}
      </Component>
    );
  }

  // Glass variant (Toss-style)
  if (variant === "glass") {
    const Component = onPress && pressable ? AnimatedPressable : AnimatedView;
    return (
      <Component
        onPress={disabled ? undefined : onPress}
        onPressIn={onPress && pressable ? handlePressIn : undefined}
        onPressOut={onPress && pressable ? handlePressOut : undefined}
        disabled={disabled}
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? PremiumColors.glassDarkMedium
              : PremiumColors.glassMedium,
            borderColor: PremiumColors.borderLight,
            borderRadius: BorderRadius.sm,
            padding: paddingValue,
            opacity: disabled ? 0.5 : 1,
            borderWidth: borderless ? 0 : 1,
          },
          Platform.select({
            ios: PremiumShadows.small.ios,
            android: PremiumShadows.small.android,
          }),
          animatedStyle,
          style,
        ]}
      >
        {Platform.OS === 'ios' && (
          <BlurView
            intensity={isDark ? 30 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.glassContent}>
          {header && <View style={styles.header}>{header}</View>}

          {(title || description) && (
            <View style={styles.headerText}>
              {title && (
                <ThemedText type="h4" style={styles.cardTitle}>
                  {title}
                </ThemedText>
              )}
              {description && (
                <ThemedText
                  type="small"
                  style={[
                    styles.cardDescription,
                    { color: isDark ? 'rgba(255, 255, 255, 0.7)' : theme.textSecondary }
                  ]}
                >
                  {description}
                </ThemedText>
              )}
            </View>
          )}

          <View style={styles.content}>{children}</View>

          {footer && <View style={styles.footer}>{footer}</View>}
        </View>
      </Component>
    );
  }

  // Outline variant
  if (variant === "outline") {
    const Component = onPress && pressable ? AnimatedPressable : AnimatedView;
    return (
      <Component
        onPress={disabled ? undefined : onPress}
        onPressIn={onPress && pressable ? handlePressIn : undefined}
        onPressOut={onPress && pressable ? handlePressOut : undefined}
        disabled={disabled}
        style={[
          styles.card,
          styles.outlineCard,
          {
            borderColor: theme.link,
            padding: paddingValue,
            opacity: disabled ? 0.5 : 1,
            borderWidth: borderless ? 0 : 2,
          },
          animatedStyle,
          style,
        ]}
      >
        {header && <View style={styles.header}>{header}</View>}

        {(title || description) && (
          <View style={styles.headerText}>
            {title && (
              <ThemedText type="h4" style={styles.cardTitle}>
                {title}
              </ThemedText>
            )}
            {description && (
              <ThemedText type="small" style={styles.cardDescription}>
                {description}
              </ThemedText>
            )}
          </View>
        )}

        <View style={styles.content}>{children}</View>

        {footer && <View style={styles.footer}>{footer}</View>}
      </Component>
    );
  }

  // Flat variant (no shadow)
  if (variant === "flat") {
    const Component = onPress && pressable ? AnimatedPressable : AnimatedView;
    return (
      <Component
        onPress={disabled ? undefined : onPress}
        onPressIn={onPress && pressable ? handlePressIn : undefined}
        onPressOut={onPress && pressable ? handlePressOut : undefined}
        disabled={disabled}
        style={[
          styles.card,
          {
            backgroundColor: theme.backgroundDefault,
            padding: paddingValue,
            opacity: disabled ? 0.5 : 1,
          },
          animatedStyle,
          style,
        ]}
      >
        {header && <View style={styles.header}>{header}</View>}

        {(title || description) && (
          <View style={styles.headerText}>
            {title && (
              <ThemedText type="h4" style={styles.cardTitle}>
                {title}
              </ThemedText>
            )}
            {description && (
              <ThemedText type="small" style={styles.cardDescription}>
                {description}
              </ThemedText>
            )}
          </View>
        )}

        <View style={styles.content}>{children}</View>

        {footer && <View style={styles.footer}>{footer}</View>}
      </Component>
    );
  }

  // Elevated variant (with premium shadow)
  if (variant === "elevated") {
    const Component = onPress && pressable ? AnimatedPressable : AnimatedView;
    return (
      <Component
        onPress={disabled ? undefined : onPress}
        onPressIn={onPress && pressable ? handlePressIn : undefined}
        onPressOut={onPress && pressable ? handlePressOut : undefined}
        disabled={disabled}
        style={[
          styles.card,
          {
            backgroundColor: theme.backgroundRoot,
            padding: paddingValue,
            opacity: disabled ? 0.5 : 1,
          },
          Platform.select({
            ios: PremiumShadows.large.ios,
            android: PremiumShadows.large.android,
          }),
          animatedStyle,
          style,
        ]}
      >
        {header && <View style={styles.header}>{header}</View>}

        {(title || description) && (
          <View style={styles.headerText}>
            {title && (
              <ThemedText type="h4" style={styles.cardTitle}>
                {title}
              </ThemedText>
            )}
            {description && (
              <ThemedText type="small" style={styles.cardDescription}>
                {description}
              </ThemedText>
            )}
          </View>
        )}

        <View style={styles.content}>{children}</View>

        {footer && <View style={styles.footer}>{footer}</View>}
      </Component>
    );
  }

  // Gradient variant
  if (variant === "gradient") {
    const Component = onPress && pressable ? AnimatedPressable : AnimatedView;
    return (
      <Component
        onPress={disabled ? undefined : onPress}
        onPressIn={onPress && pressable ? handlePressIn : undefined}
        onPressOut={onPress && pressable ? handlePressOut : undefined}
        disabled={disabled}
        style={[
          styles.card,
          {
            padding: paddingValue,
            opacity: disabled ? 0.5 : 1,
            overflow: 'hidden',
          },
          Platform.select({
            ios: PremiumShadows.medium.ios,
            android: PremiumShadows.medium.android,
          }),
          animatedStyle,
          style,
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
          {header && <View style={styles.header}>{header}</View>}

          {(title || description) && (
            <View style={styles.headerText}>
              {title && (
                <ThemedText type="h4" style={[styles.cardTitle, { color: '#FFFFFF' }]}>
                  {title}
                </ThemedText>
              )}
              {description && (
                <ThemedText type="small" style={[styles.cardDescription, { color: 'rgba(255, 255, 255, 0.9)' }]}>
                  {description}
                </ThemedText>
              )}
            </View>
          )}

          <View style={styles.content}>{children}</View>

          {footer && <View style={styles.footer}>{footer}</View>}
        </View>
      </Component>
    );
  }

  // Default fallback to elevated
  const Component = onPress && pressable ? AnimatedPressable : AnimatedView;
  return (
    <Component
      onPress={disabled ? undefined : onPress}
      onPressIn={onPress && pressable ? handlePressIn : undefined}
      onPressOut={onPress && pressable ? handlePressOut : undefined}
      disabled={disabled}
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundRoot,
          padding: paddingValue,
          opacity: disabled ? 0.5 : 1,
        },
        Platform.select({
          ios: PremiumShadows.medium.ios,
          android: PremiumShadows.medium.android,
        }),
        animatedStyle,
        style,
      ]}
    >
      {header && <View style={styles.header}>{header}</View>}

      {(title || description) && (
        <View style={styles.headerText}>
          {title && (
            <ThemedText type="h4" style={styles.cardTitle}>
              {title}
            </ThemedText>
          )}
          {description && (
            <ThemedText type="small" style={styles.cardDescription}>
              {description}
            </ThemedText>
          )}
        </View>
      )}

      <View style={styles.content}>{children}</View>

      {footer && <View style={styles.footer}>{footer}</View>}
    </Component>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius["2xl"],
    position: 'relative',
  },
  cardTitle: {
    marginBottom: Spacing.sm,
  },
  cardDescription: {
    opacity: 0.7,
  },
  glassContent: {
    position: 'relative',
    overflow: 'hidden',
  },
  outlineCard: {
    backgroundColor: 'transparent',
  },
  gradientContent: {
    position: 'relative',
  },
  header: {
    marginBottom: Spacing.md,
  },
  headerText: {
    marginBottom: Spacing.md,
  },
  content: {
    // Content wrapper for better control
  },
  footer: {
    marginTop: Spacing.md,
  },
});
