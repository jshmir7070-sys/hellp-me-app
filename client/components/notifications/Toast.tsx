import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  WithSpringConfig,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { BrandColors, Spacing } from '@/constants/theme';
import type { ToastInstance, ToastVariant } from '@/types/notification';

interface ToastProps {
  instance: ToastInstance;
  index: number;
  onDismiss: (id: string) => void;
}

interface ToastVariantConfig {
  backgroundColor: string;
  iconColor: string;
  textColor: string;
  icon: string;
}

const TOAST_VARIANTS: Record<ToastVariant, ToastVariantConfig> = {
  success: {
    backgroundColor: BrandColors.success,
    iconColor: '#FFFFFF',
    textColor: '#FFFFFF',
    icon: 'checkmark-circle-outline',
  },
  error: {
    backgroundColor: BrandColors.error,
    iconColor: '#FFFFFF',
    textColor: '#FFFFFF',
    icon: 'close-circle-outline',
  },
  warning: {
    backgroundColor: BrandColors.warning,
    iconColor: '#FFFFFF',
    textColor: '#FFFFFF',
    icon: 'warning-outline',
  },
  info: {
    backgroundColor: BrandColors.info,
    iconColor: '#FFFFFF',
    textColor: '#FFFFFF',
    icon: 'information-circle-outline',
  },
  helper: {
    backgroundColor: BrandColors.helper,
    iconColor: '#FFFFFF',
    textColor: '#FFFFFF',
    icon: 'person-outline',
  },
  requester: {
    backgroundColor: BrandColors.requester,
    iconColor: '#FFFFFF',
    textColor: '#FFFFFF',
    icon: 'document-text-outline',
  },
};

const TOAST_HEIGHT = 76; // Includes 12px margin
const SWIPE_THRESHOLD = -50;

const springConfig: WithSpringConfig = {
  damping: 15,
  stiffness: 150,
  mass: 0.3,
};

export const Toast = React.memo(({ instance, index, onDismiss }: ToastProps) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  // Calculate target position
  const targetY = insets.top + 16 + index * TOAST_HEIGHT;

  // Entry animation
  useEffect(() => {
    translateY.value = withSpring(targetY, springConfig);
    opacity.value = withSpring(1, springConfig);
  }, [targetY]);

  // Update position when index changes
  useEffect(() => {
    translateY.value = withSpring(targetY, springConfig);
  }, [targetY]);

  // Swipe gesture
  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow upward swipe
      if (event.translationY < 0) {
        translateY.value = targetY + event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY < SWIPE_THRESHOLD) {
        // Dismiss - animate up
        translateY.value = withSpring(-100, springConfig);
        opacity.value = withSpring(0, springConfig);
        setTimeout(() => {
          runOnJS(onDismiss)(instance.id);
        }, 300);
      } else {
        // Return to original position
        translateY.value = withSpring(targetY, springConfig);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const variantConfig = TOAST_VARIANTS[instance.config.variant];

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.toast, animatedStyle]}>
        <Pressable
          onPress={() => onDismiss(instance.id)}
          style={[
            styles.container,
            { backgroundColor: variantConfig.backgroundColor },
          ]}
        >
          <Icon
            name={variantConfig.icon}
            size={24}
            color={variantConfig.iconColor}
          />
          <View style={styles.textContainer}>
            {instance.config.title && (
              <ThemedText
                type="h4"
                style={[styles.title, { color: variantConfig.textColor }]}
              >
                {instance.config.title}
              </ThemedText>
            )}
            <ThemedText
              type="body"
              style={[styles.message, { color: variantConfig.textColor }]}
              numberOfLines={2}
            >
              {instance.config.message}
            </ThemedText>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
});

Toast.displayName = 'Toast';

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 500,
    alignSelf: 'center',
    zIndex: 9999,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 24,
    minHeight: 64,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  textContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  title: {
    marginBottom: 2,
  },
  message: {
    opacity: 0.95,
  },
});
