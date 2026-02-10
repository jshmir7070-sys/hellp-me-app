import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, SpringConfigs, BrandColors } from '@/constants/theme';

interface MenuItemProps {
  icon: string;
  label: string;
  description?: string;
  badge?: string;
  badgeColor?: string;
  onPress: () => void;
  variant?: 'default' | 'glass';
}

export function MenuItem({
  icon,
  label,
  description,
  badge,
  badgeColor,
  onPress,
  variant = 'default',
}: MenuItemProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.98, SpringConfigs.quick);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SpringConfigs.gentle);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={({ pressed }) => [
          styles.menuItem,
          {
            backgroundColor: theme.backgroundDefault,
            borderBottomWidth: 1,
            borderBottomColor: theme.border + '40',
          },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.menuItemLeft}>
          <Icon name={icon as any} size={20} color={theme.text} />
          <View style={styles.menuItemTextContainer}>
            <View style={styles.labelRow}>
              <ThemedText style={[styles.menuItemLabel, { color: theme.text }]}>
                {label}
              </ThemedText>
              {badge ? (
                <View
                  style={[
                    styles.badgeContainer,
                    { backgroundColor: badgeColor || BrandColors.error },
                  ]}
                >
                  <ThemedText style={styles.badgeText}>{badge}</ThemedText>
                </View>
              ) : null}
            </View>
            {description ? (
              <ThemedText
                style={[styles.menuItemDescription, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {description}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <Icon name="chevron-forward-outline" size={20} color={theme.textTertiary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 56,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  menuItemTextContainer: {
    flex: 1,
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  menuItemDescription: {
    fontSize: 13,
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
