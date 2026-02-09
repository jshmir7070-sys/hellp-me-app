import React, { ReactNode, useEffect } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from "@/hooks/useTheme";
import {
  BorderRadius,
  Spacing,
  PremiumColors,
  PremiumShadows,
  SpringConfigs,
} from "@/constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type BottomSheetVariant = "default" | "glass";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: BottomSheetVariant;
  snapPoints?: string[];  // e.g., ['25%', '50%', '90%']
  backdropBlur?: boolean;
  enablePanDownToClose?: boolean;
}

export function BottomSheet({
  visible,
  onClose,
  children,
  variant = "default",
  snapPoints = ['50%', '90%'],
  backdropBlur = false,
  enablePanDownToClose = true,
}: BottomSheetProps) {
  const { theme } = useTheme();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const context = useSharedValue(0);

  // Convert percentage to pixels
  const getSnapPointValue = (snapPoint: string): number => {
    const percentage = parseInt(snapPoint.replace('%', ''));
    return SCREEN_HEIGHT * (1 - percentage / 100);
  };

  // Initial snap point (first in array)
  const initialSnapPoint = getSnapPointValue(snapPoints[0]);

  // Open/Close animation
  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(initialSnapPoint, SpringConfigs.gentle);
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
    }
  }, [visible]);

  // Pan gesture handler
  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = translateY.value;
    })
    .onUpdate((event) => {
      const newValue = context.value + event.translationY;
      // Don't allow dragging above the top
      translateY.value = Math.max(0, newValue);
    })
    .onEnd((event) => {
      const velocity = event.velocityY;
      const currentPosition = translateY.value;

      // If dragging down fast or past threshold, close
      if (enablePanDownToClose && (velocity > 500 || currentPosition > SCREEN_HEIGHT * 0.5)) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
        runOnJS(onClose)();
        return;
      }

      // Otherwise snap to nearest snap point
      const snapPointValues = snapPoints.map(getSnapPointValue);
      let nearestSnapPoint = snapPointValues[0];
      let minDistance = Math.abs(currentPosition - nearestSnapPoint);

      snapPointValues.forEach((point) => {
        const distance = Math.abs(currentPosition - point);
        if (distance < minDistance) {
          minDistance = distance;
          nearestSnapPoint = point;
        }
      });

      translateY.value = withSpring(nearestSnapPoint, SpringConfigs.gentle);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const opacity = 1 - translateY.value / SCREEN_HEIGHT;
    return {
      opacity: withTiming(opacity, { duration: 250 }),
    };
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropAnimatedStyle]}>
          {backdropBlur ? (
            <BlurView
              intensity={Platform.OS === 'ios' ? 40 : 60}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: PremiumColors.overlayMedium },
              ]}
            />
          )}
        </Animated.View>
      </Pressable>

      {/* Bottom Sheet Content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.sheetContainer,
            animatedStyle,
            variant === "glass" && styles.glassSheet,
            variant === "glass"
              ? {
                  backgroundColor: PremiumColors.glassMedium,
                  borderColor: PremiumColors.borderLight,
                }
              : {
                  backgroundColor: theme.backgroundRoot,
                },
            Platform.select({
              ios: PremiumShadows.large.ios,
              android: PremiumShadows.large.android,
            }),
          ]}
        >
          {/* Glass Blur Effect */}
          {variant === "glass" && (
            <BlurView
              intensity={Platform.OS === 'ios' ? 20 : 40}
              style={StyleSheet.absoluteFill}
            />
          )}

          {/* Handle */}
          <View style={styles.handleContainer}>
            <View
              style={[
                styles.handle,
                { backgroundColor: theme.tabIconDefault },
              ]}
            />
          </View>

          {/* Content */}
          <View style={styles.content}>{children}</View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    overflow: 'hidden',
  },
  glassSheet: {
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? Spacing['2xl'] : Spacing.lg,
  },
});
