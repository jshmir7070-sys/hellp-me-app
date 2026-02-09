import React from 'react';
import { View, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Icon } from "@/components/Icon";

import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, BrandColors } from '@/constants/theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionText?: string;
  onAction?: () => void;
  isHelper?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon = 'inbox-outline',
  title,
  subtitle,
  actionText,
  onAction,
  isHelper = true,
  style,
}: EmptyStateProps) {
  const { theme } = useTheme();
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;
  const lightColor = isHelper ? BrandColors.helperLight : BrandColors.requesterLight;

  return (
    <Card style={StyleSheet.flatten([styles.container, style])}>
      <View style={[styles.iconContainer, { backgroundColor: lightColor }]}>
        <Icon name={icon} size={32} color={primaryColor} />
      </View>
      <ThemedText style={[styles.title, { color: theme.text }]}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          {subtitle}
        </ThemedText>
      ) : null}
      {actionText && onAction ? (
        <Pressable
          onPress={onAction}
          style={[styles.actionButton, { backgroundColor: primaryColor }]}
        >
          <ThemedText style={styles.actionButtonText}>{actionText}</ThemedText>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    marginVertical: Spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EmptyState;
