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
import { useTheme } from '@/hooks/useTheme';
import { Spacing } from '@/constants/theme';

export type SystemAlertType = 'info' | 'success' | 'warning' | 'error';

export interface SystemAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'primary' | 'secondary' | 'destructive';
}

export interface SystemAlertConfig {
  type: SystemAlertType;
  title: string;
  message: string;
  buttons?: SystemAlertButton[];
  cancelable?: boolean;
}

interface SystemAlertProps {
  visible: boolean;
  config: SystemAlertConfig;
  onDismiss: () => void;
}

// 타입별 색상 설정 (헤더용)
const ALERT_TYPE_CONFIG: Record<SystemAlertType, {
  headerColor: string;
  iconName: string;
  iconColor: string;
}> = {
  info: {
    headerColor: '#3B82F6', // 파란색
    iconName: 'information-circle',
    iconColor: '#FFFFFF',
  },
  success: {
    headerColor: '#10B981', // 초록색
    iconName: 'checkmark-circle',
    iconColor: '#FFFFFF',
  },
  warning: {
    headerColor: '#F59E0B', // 노란색
    iconName: 'warning',
    iconColor: '#FFFFFF',
  },
  error: {
    headerColor: '#EF4444', // 빨간색
    iconName: 'close-circle',
    iconColor: '#FFFFFF',
  },
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

export const SystemAlert = React.memo(({ visible, config, onDismiss }: SystemAlertProps) => {
  const { theme } = useTheme();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  // Entry animation
  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, springConfig);
      opacity.value = withSpring(1, fadeConfig);
    }
  }, [visible]);

  const handleDismiss = () => {
    // Exit animation
    scale.value = withSpring(0.9, springConfig);
    opacity.value = withSpring(0, fadeConfig);
    setTimeout(() => {
      onDismiss();
    }, 200);
  };

  const handleBackdropPress = () => {
    if (config.cancelable !== false) {
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

  const typeConfig = ALERT_TYPE_CONFIG[config.type];
  const buttons = config.buttons || [{ text: '확인', style: 'primary' as const }];

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
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
          <View style={styles.alertContainer}>
            {/* 색상 헤더 */}
            <View style={[styles.header, { backgroundColor: typeConfig.headerColor }]}>
              <Icon
                name={typeConfig.iconName}
                size={32}
                color={typeConfig.iconColor}
              />
              <ThemedText type="h3" style={styles.headerTitle}>
                {config.title}
              </ThemedText>
            </View>

            {/* 화이트/회색 톤 본문 */}
            <View style={[styles.body, { backgroundColor: theme.backgroundRoot }]}>
              <ThemedText type="body" style={styles.message}>
                {config.message}
              </ThemedText>

              {/* 버튼 영역 */}
              <View style={styles.buttonContainer}>
                {buttons.map((button, index) => (
                  <AlertButton
                    key={index}
                    button={button}
                    typeConfig={typeConfig}
                    onPress={() => {
                      button.onPress?.();
                      handleDismiss();
                    }}
                  />
                ))}
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

SystemAlert.displayName = 'SystemAlert';

// Alert button component
interface AlertButtonProps {
  button: SystemAlertButton;
  typeConfig: typeof ALERT_TYPE_CONFIG[SystemAlertType];
  onPress: () => void;
}

function AlertButton({ button, typeConfig, onPress }: AlertButtonProps) {
  const { theme } = useTheme();
  const style = button.style || 'primary';

  const getButtonStyle = () => {
    switch (style) {
      case 'primary':
        return {
          backgroundColor: typeConfig.headerColor,
          borderWidth: 0,
          textColor: '#FFFFFF',
        };
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: theme.backgroundTertiary,
          textColor: theme.text,
        };
      case 'destructive':
        return {
          backgroundColor: '#EF4444',
          borderWidth: 0,
          textColor: '#FFFFFF',
        };
      default:
        return {
          backgroundColor: typeConfig.headerColor,
          borderWidth: 0,
          textColor: '#FFFFFF',
        };
    }
  };

  const buttonStyle = getButtonStyle();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: buttonStyle.backgroundColor,
          borderWidth: buttonStyle.borderWidth,
          borderColor: buttonStyle.borderColor,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <ThemedText
        type="h4"
        style={[styles.buttonText, { color: buttonStyle.textColor }]}
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
  alertContainer: {
    width: '88%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
  },
  body: {
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing['2xl'],
  },
  message: {
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
    lineHeight: 24,
    color: '#6B7280', // 회색 톤
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: Spacing.md,
  },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  buttonText: {
    fontWeight: '600',
  },
});
