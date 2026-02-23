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
import { Spacing } from '@/constants/theme';

export type SystemToastType = 'info' | 'success' | 'warning' | 'error';

export interface SystemToastConfig {
    type: SystemToastType;
    title?: string;
    message: string;
    duration?: number;
}

interface SystemToastProps {
    id: string;
    config: SystemToastConfig;
    index: number;
    onDismiss: (id: string) => void;
}

// 타입별 색상 설정
const TOAST_TYPE_CONFIG: Record<SystemToastType, {
    headerColor: string;
    iconName: string;
    iconColor: string;
    borderColor: string;
}> = {
    info: {
        headerColor: '#3B82F6', // 파란색
        iconName: 'information-circle',
        iconColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    success: {
        headerColor: '#10B981', // 초록색
        iconName: 'checkmark-circle',
        iconColor: '#10B981',
        borderColor: '#10B981',
    },
    warning: {
        headerColor: '#F59E0B', // 노란색
        iconName: 'warning',
        iconColor: '#F59E0B',
        borderColor: '#F59E0B',
    },
    error: {
        headerColor: '#EF4444', // 빨간색
        iconName: 'close-circle',
        iconColor: '#EF4444',
        borderColor: '#EF4444',
    },
};

const TOAST_HEIGHT = 88; // Includes margin
const SWIPE_THRESHOLD = -50;

const springConfig: WithSpringConfig = {
    damping: 15,
    stiffness: 150,
    mass: 0.3,
};

export const SystemToast = React.memo(({ id, config, index, onDismiss }: SystemToastProps) => {
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

    // Auto dismiss
    useEffect(() => {
        const duration = config.duration || 4000;
        const timer = setTimeout(() => {
            handleDismiss();
        }, duration);

        return () => clearTimeout(timer);
    }, []);

    const handleDismiss = () => {
        translateY.value = withSpring(-100, springConfig);
        opacity.value = withSpring(0, springConfig);
        setTimeout(() => {
            onDismiss(id);
        }, 300);
    };

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
                handleDismiss();
            } else {
                // Return to original position
                translateY.value = withSpring(targetY, springConfig);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value,
    }));

    const typeConfig = TOAST_TYPE_CONFIG[config.type];

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.toast, animatedStyle]}>
                <Pressable
                    onPress={handleDismiss}
                    style={[
                        styles.container,
                        { borderLeftColor: typeConfig.borderColor },
                    ]}
                >
                    {/* 색상 아이콘 영역 */}
                    <View style={[styles.iconContainer, { backgroundColor: `${typeConfig.headerColor}15` }]}>
                        <Icon
                            name={typeConfig.iconName}
                            size={24}
                            color={typeConfig.iconColor}
                        />
                    </View>

                    {/* 화이트/회색 톤 텍스트 영역 */}
                    <View style={styles.textContainer}>
                        {config.title && (
                            <ThemedText
                                type="h4"
                                style={[styles.title, { color: typeConfig.headerColor }]}
                            >
                                {config.title}
                            </ThemedText>
                        )}
                        <ThemedText
                            type="body"
                            style={styles.message}
                            numberOfLines={2}
                        >
                            {config.message}
                        </ThemedText>
                    </View>

                    {/* 닫기 버튼 */}
                    <Pressable onPress={handleDismiss} style={styles.closeButton}>
                        <Icon
                            name="close"
                            size={20}
                            color="#9CA3AF"
                        />
                    </Pressable>
                </Pressable>
            </Animated.View>
        </GestureDetector>
    );
});

SystemToast.displayName = 'SystemToast';

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
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderLeftWidth: 4,
        minHeight: 72,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        marginLeft: Spacing.md,
        marginRight: Spacing.sm,
    },
    title: {
        marginBottom: 2,
        fontWeight: '600',
    },
    message: {
        color: '#6B7280', // 회색 톤
        lineHeight: 20,
    },
    closeButton: {
        padding: Spacing.sm,
    },
});
