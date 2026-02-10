import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, SpringConfigs } from '@/constants/theme';

interface CategorySectionProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  isExpanded?: boolean; // External control for accordion
  onToggle?: () => void; // Callback for accordion
  badge?: string; // Badge text (e.g., "🔴 1건 미완료")
  badgeColor?: string;
}

export function CategorySection({
  title,
  icon,
  children,
  collapsible = true, // Changed default to true for accordion
  defaultExpanded = false, // Changed default to false for accordion
  isExpanded: externalIsExpanded,
  onToggle,
  badge,
  badgeColor,
}: CategorySectionProps) {
  const { theme } = useTheme();
  const [internalIsExpanded, setInternalIsExpanded] = useState(defaultExpanded);

  // Use external state if provided (for accordion), otherwise use internal state
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;

  const rotation = useSharedValue(isExpanded ? 0 : -90);
  const contentHeight = useSharedValue(isExpanded ? 1 : 0);

  const toggleExpanded = () => {
    if (onToggle) {
      // External control (accordion mode)
      onToggle();
    } else {
      // Internal control (independent mode)
      const newExpanded = !internalIsExpanded;
      setInternalIsExpanded(newExpanded);
    }
  };

  // Update animation when isExpanded changes
  React.useEffect(() => {
    rotation.value = withSpring(isExpanded ? 0 : -90, SpringConfigs.gentle);
    contentHeight.value = withSpring(isExpanded ? 1 : 0, SpringConfigs.gentle);
  }, [isExpanded]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentHeight.value,
    transform: [{ scaleY: contentHeight.value }],
  }));

  return (
    <Card variant="glass" padding="none" style={styles.card}>
      {/* Section Header */}
      <Pressable
        onPress={collapsible ? toggleExpanded : undefined}
        disabled={!collapsible}
        style={({ pressed }) => [
          styles.header,
          pressed && collapsible && styles.headerPressed,
        ]}
      >
        <View style={styles.headerLeft}>
          {icon && (
            <View style={[styles.iconContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <Icon name={icon} size={20} color={theme.text} />
            </View>
          )}
          <ThemedText style={styles.title}>{title}</ThemedText>
          {badge && (
            <View
              style={[
                styles.badgeContainer,
                { backgroundColor: badgeColor || theme.textSecondary },
              ]}
            >
              <ThemedText style={styles.badgeText}>{badge}</ThemedText>
            </View>
          )}
        </View>
        {collapsible && (
          <Animated.View style={chevronStyle}>
            <Icon name="chevron-down" size={20} color={theme.textSecondary} />
          </Animated.View>
        )}
      </Pressable>

      {/* Section Content */}
      {collapsible ? (
        isExpanded && (
          <Animated.View style={[styles.content, contentStyle]}>
            {children}
          </Animated.View>
        )
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerPressed: {
    opacity: 0.7,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: Spacing.sm,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    overflow: 'hidden',
  },
});
