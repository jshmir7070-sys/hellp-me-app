import React, { useEffect } from 'react';
import { StyleSheet, View, Modal, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  WithSpringConfig,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BrandColors } from '@/constants/theme';
import type { AlertInstance, AlertIconType, AlertButton as AlertButtonType } from '@/types/notification';

interface AlertProps {
  instance: AlertInstance;
  onDismiss: () => void;
}

const ICON_CONFIG: Record<AlertIconType, { name: string; color: string }> = {
  info: { name: 'information-circle-outline', color: BrandColors.info },
  warning: { name: 'warning-outline', color: BrandColors.warning },
  error: { name: 'alert-circle-outline', color: BrandColors.error },
  question: { name: 'help-circle-outline', color: BrandColors.primary },
};

const springConfig: WithSpringConfig = {
  damping: 15,
  stiffness: 150,
  mass: 0.3,
};

const fadeConfig: WithSpringConfig = {
  damping: 20,
  stiffness: 200,
};

export const Alert = React.memo(({ instance, onDismiss }: AlertProps) => {
  const { theme } = useTheme();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  // Entry animation
  useEffect(() => {
    scale.value = withSpring(1, springConfig);
    opacity.value = withSpring(1, fadeConfig);
  }, []);

  const handleDismiss = () => {
    // Exit animation
    scale.value = withSpring(0.9, springConfig);
    opacity.value = withSpring(0, fadeConfig);
    setTimeout(() => {
      onDismiss();
    }, 200);
  };

  const handleBackdropPress = () => {
    if (instance.config.cancelable) {
      handleDismiss();
    }
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const iconConfig = instance.config.icon ? ICON_CONFIG[instance.config.icon] : null;

  return (
    <Modal transparent visible animationType="none">
      {/* Backdrop with blur */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
        />
      </Animated.View>

      {/* Alert dialog */}
      <View style={styles.centerContainer} pointerEvents="box-none">
        <Animated.View style={containerStyle}>
          <View
            style={[
              styles.alert,
              { backgroundColor: theme.backgroundRoot },
            ]}
          >
            {/* Icon */}
            {iconConfig && (
              <View style={styles.iconContainer}>
                <Icon
                  name={iconConfig.name}
                  size={48}
                  color={iconConfig.color}
                />
              </View>
            )}

            {/* Title */}
            <ThemedText type="h3" style={styles.title}>
              {instance.config.title}
            </ThemedText>

            {/* Message */}
            <ThemedText type="body" style={styles.message}>
              {instance.config.message}
            </ThemedText>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {instance.config.buttons.map((button, index) => (
                <AlertButton
                  key={index}
                  button={button}
                  onPress={() => {
                    button.onPress?.();
                    handleDismiss();
                  }}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

Alert.displayName = 'Alert';

// Alert button component
interface AlertButtonComponentProps {
  button: AlertButtonType;
  onPress: () => void;
}

function AlertButton({ button, onPress }: AlertButtonComponentProps) {
  const { theme } = useTheme();
  const style = button.style || 'default';

  const buttonStyles: Record<string, { backgroundColor: string; color: string; borderWidth?: number; borderColor?: string }> = {
    default: {
      backgroundColor: BrandColors.primary,
      color: '#FFFFFF',
    },
    cancel: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.backgroundTertiary,
      color: theme.text,
    },
    destructive: {
      backgroundColor: BrandColors.error,
      color: '#FFFFFF',
    },
  };

  const currentStyle = buttonStyles[style];

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        {
          backgroundColor: currentStyle.backgroundColor,
          borderWidth: currentStyle.borderWidth || 0,
          borderColor: currentStyle.borderColor,
        },
      ]}
    >
      <ThemedText
        type="h4"
        style={[styles.buttonText, { color: currentStyle.color }]}
      >
        {button.text}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alert: {
    width: '90%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: 24,
    padding: Spacing['2xl'],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  message: {
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
    opacity: 0.8,
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: Spacing.md,
  },
  button: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  buttonText: {
    fontWeight: '600',
  },
});
