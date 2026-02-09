import React, { ReactNode } from "react";
import {
  Modal as RNModal,
  View,
  StyleSheet,
  Pressable,
  ViewStyle,
  StyleProp,
  Platform,
  Dimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import {
  BorderRadius,
  Spacing,
  PremiumGradients,
  PremiumColors,
  PremiumShadows,
} from "@/constants/theme";

type ModalVariant = "default" | "fullscreen" | "bottom" | "premium";
type AnimationType = "slide" | "fade" | "scale";

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  variant?: ModalVariant;
  animation?: AnimationType;
  backdropBlur?: boolean;
  style?: StyleProp<ViewStyle>;
  closeOnBackdrop?: boolean;
}

interface ModalHeaderProps {
  children: ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
}

interface ModalBodyProps {
  children: ReactNode;
}

interface ModalFooterProps {
  children: ReactNode;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function Modal({
  visible,
  onClose,
  children,
  variant = "default",
  animation = "slide",
  backdropBlur = false,
  style,
  closeOnBackdrop = true,
}: ModalProps) {
  const { theme, isDark } = useTheme();

  // Get animation based on type
  const getEnterAnimation = () => {
    switch (animation) {
      case "slide":
        return SlideInUp;
      case "fade":
        return FadeIn;
      case "scale":
        return ZoomIn;
      default:
        return SlideInUp;
    }
  };

  const getExitAnimation = () => {
    switch (animation) {
      case "slide":
        return SlideOutDown;
      case "fade":
        return FadeOut;
      case "scale":
        return ZoomOut;
      default:
        return SlideOutDown;
    }
  };

  // Fullscreen variant
  if (variant === "fullscreen") {
    return (
      <RNModal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <Animated.View
          entering={SlideInUp}
          exiting={SlideOutDown}
          style={[
            styles.fullscreenContainer,
            { backgroundColor: theme.backgroundRoot },
            style,
          ]}
        >
          {children}
        </Animated.View>
      </RNModal>
    );
  }

  // Bottom sheet variant
  if (variant === "bottom") {
    return (
      <RNModal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={closeOnBackdrop ? onClose : undefined}
        >
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={StyleSheet.absoluteFill}
          >
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

        {/* Bottom Content */}
        <Animated.View
          entering={SlideInUp}
          exiting={SlideOutDown}
          style={[
            styles.bottomContainer,
            {
              backgroundColor: theme.backgroundRoot,
            },
            style,
          ]}
        >
          {children}
        </Animated.View>
      </RNModal>
    );
  }

  // Premium variant
  if (variant === "premium") {
    return (
      <RNModal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        {/* Backdrop */}
        <Pressable
          style={styles.backdrop}
          onPress={closeOnBackdrop ? onClose : undefined}
        >
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            style={StyleSheet.absoluteFill}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 40 : 60}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Pressable>

        {/* Premium Content */}
        <Animated.View
          entering={getEnterAnimation()}
          exiting={getExitAnimation()}
          style={styles.centerContainer}
        >
          <View
            style={[
              styles.premiumContent,
              Platform.select({
                ios: PremiumShadows.premium.ios,
                android: PremiumShadows.premium.android,
              }),
              style,
            ]}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 20 : 40}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.premiumInner,
                {
                  backgroundColor: PremiumColors.glassMedium,
                  borderColor: PremiumColors.borderLight,
                },
              ]}
            >
              {children}
            </View>
          </View>
        </Animated.View>
      </RNModal>
    );
  }

  // Default variant
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable
        style={styles.backdrop}
        onPress={closeOnBackdrop ? onClose : undefined}
      >
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={StyleSheet.absoluteFill}
        >
          {backdropBlur ? (
            <BlurView
              intensity={Platform.OS === 'ios' ? 30 : 50}
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

      {/* Default Content */}
      <Animated.View
        entering={getEnterAnimation()}
        exiting={getExitAnimation()}
        style={styles.centerContainer}
      >
        <View
          style={[
            styles.defaultContent,
            {
              backgroundColor: theme.backgroundRoot,
            },
            Platform.select({
              ios: PremiumShadows.large.ios,
              android: PremiumShadows.large.android,
            }),
            style,
          ]}
        >
          {children}
        </View>
      </Animated.View>
    </RNModal>
  );
}

// Modal Header Component
Modal.Header = function ModalHeader({
  children,
  onClose,
  showCloseButton = true,
}: ModalHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.header}>
      <ThemedText type="h3" style={styles.headerText}>
        {children}
      </ThemedText>
      {showCloseButton && onClose && (
        <Pressable onPress={onClose} style={styles.closeButton}>
          <ThemedText style={{ fontSize: 24, color: theme.text }}>×</ThemedText>
        </Pressable>
      )}
    </View>
  );
};

// Modal Body Component
Modal.Body = function ModalBody({ children }: ModalBodyProps) {
  return <View style={styles.body}>{children}</View>;
};

// Modal Footer Component
Modal.Footer = function ModalFooter({ children }: ModalFooterProps) {
  return <View style={styles.footer}>{children}</View>;
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
  },
  fullscreenContainer: {
    flex: 1,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingBottom: Platform.OS === 'ios' ? Spacing['2xl'] : Spacing.lg,
  },
  defaultContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius['2xl'],
    overflow: 'hidden',
  },
  premiumContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius['2xl'],
    overflow: 'hidden',
  },
  premiumInner: {
    borderWidth: 1,
    borderRadius: BorderRadius['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: PremiumColors.borderLight,
  },
  headerText: {
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },
  body: {
    padding: Spacing.xl,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: Spacing.xl,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: PremiumColors.borderLight,
  },
});
