import React, { ReactNode, useState } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
  StyleProp,
  Platform,
  TextInputProps,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
  PremiumShadows,
  BrandColors,
} from "@/constants/theme";

type InputVariant = "default" | "outlined" | "filled" | "premium";

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  success?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  variant?: InputVariant;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export function Input({
  label,
  error,
  success,
  helperText,
  leftIcon,
  rightIcon,
  variant = "default",
  containerStyle,
  disabled = false,
  onFocus,
  onBlur,
  value,
  ...textInputProps
}: InputProps) {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  // Animation values
  const labelPosition = useSharedValue(value ? -20 : 0);
  const labelScale = useSharedValue(value ? 0.85 : 1);
  const borderColor = useSharedValue(0);

  // Animated styles
  const labelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: labelPosition.value },
      { scale: labelScale.value },
    ],
  }));

  const borderAnimatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: withTiming(
        isFocused && variant === "premium"
          ? PremiumGradients.blue[0]
          : error
          ? BrandColors.error
          : success
          ? BrandColors.success
          : theme.backgroundSecondary,
        { duration: 200 }
      ),
    };
  });

  const handleFocus = (e: any) => {
    setIsFocused(true);
    labelPosition.value = withSpring(-20);
    labelScale.value = withSpring(0.85);
    borderColor.value = withTiming(1, { duration: 200 });
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (!value) {
      labelPosition.value = withSpring(0);
      labelScale.value = withSpring(1);
    }
    borderColor.value = withTiming(0, { duration: 200 });
    onBlur?.(e);
  };

  // Get border width based on state
  const getBorderWidth = () => {
    if (error || success) return 2;
    if (isFocused && variant === "premium") return 2;
    return 1;
  };

  // Get background color
  const getBackgroundColor = () => {
    if (disabled) return theme.backgroundSecondary;
    if (variant === "filled") return theme.backgroundDefault;
    return theme.backgroundRoot;
  };

  // Get border color
  const getBorderColor = () => {
    if (error) return BrandColors.error;
    if (success) return BrandColors.success;
    if (isFocused && variant === "premium") return PremiumGradients.blue[0];
    if (isFocused) return theme.link;
    return theme.backgroundSecondary;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Floating Label */}
      {label && (
        <Animated.View
          style={[
            styles.labelContainer,
            labelAnimatedStyle,
          ]}
        >
          <ThemedText
            style={[
              styles.label,
              {
                color: error
                  ? BrandColors.error
                  : success
                  ? BrandColors.success
                  : isFocused && variant === "premium"
                  ? PremiumGradients.blue[0]
                  : isFocused
                  ? theme.link
                  : theme.text,
              },
            ]}
          >
            {label}
          </ThemedText>
        </Animated.View>
      )}

      {/* Input Container */}
      <Animated.View
        style={[
          styles.inputContainer,
          {
            backgroundColor: getBackgroundColor(),
            borderWidth: getBorderWidth(),
            borderColor: getBorderColor(),
            opacity: disabled ? 0.6 : 1,
          },
          variant === "premium" && isFocused && styles.premiumFocused,
          (error || success) && styles.statusBorder,
          borderAnimatedStyle,
        ]}
      >
        {/* Premium Gradient Border */}
        {variant === "premium" && isFocused && !error && !success && (
          <LinearGradient
            colors={PremiumGradients.blue}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        <View style={styles.inputWrapper}>
          {/* Left Icon */}
          {leftIcon && (
            <View style={styles.leftIconContainer}>{leftIcon}</View>
          )}

          {/* Text Input */}
          <TextInput
            {...textInputProps}
            value={value}
            onFocus={handleFocus}
            onBlur={handleBlur}
            editable={!disabled}
            placeholderTextColor={theme.tabIconDefault}
            style={[
              styles.input,
              {
                color: theme.text,
                paddingLeft: leftIcon ? 0 : Spacing.md,
                paddingRight: rightIcon ? 0 : Spacing.md,
              },
            ]}
          />

          {/* Right Icon */}
          {rightIcon && (
            <View style={styles.rightIconContainer}>{rightIcon}</View>
          )}
        </View>
      </Animated.View>

      {/* Helper/Error/Success Text */}
      {(error || success || helperText) && (
        <View style={styles.helperContainer}>
          <ThemedText
            style={[
              styles.helperText,
              {
                color: error
                  ? BrandColors.error
                  : success
                  ? BrandColors.success
                  : theme.tabIconDefault,
              },
            ]}
          >
            {error || success || helperText}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  labelContainer: {
    position: 'absolute',
    left: Spacing.md,
    top: Spacing.md,
    zIndex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.xs,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  premiumFocused: {
    ...Platform.select({
      ios: PremiumShadows.medium.ios,
      android: PremiumShadows.medium.android,
    }),
  },
  statusBorder: {
    borderWidth: 2,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    zIndex: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.md, // Extra padding for floating label
  },
  leftIconContainer: {
    marginRight: Spacing.sm,
  },
  rightIconContainer: {
    marginLeft: Spacing.sm,
  },
  helperContainer: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
