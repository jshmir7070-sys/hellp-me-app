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
}

export function CategorySection({
  title,
  icon,
  children,
  collapsible = false,
  defaultExpanded = true,
}: CategorySectionProps) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const rotation = useSharedValue(defaultExpanded ? 0 : -90);
  const contentHeight = useSharedValue(defaultExpanded ? 1 : 0);

  const toggleExpanded = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    // Animate chevron rotation
    rotation.value = withSpring(newExpanded ? 0 : -90, SpringConfigs.gentle);

    // Animate content visibility
    contentHeight.value = withSpring(newExpanded ? 1 : 0, SpringConfigs.gentle);
  };

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
  content: {
    overflow: 'hidden',
  },
});
