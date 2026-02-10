import React from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Image } from 'react-native';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, BrandColors } from '@/constants/theme';
import { DocumentState, DocumentType } from '@/hooks/useDocumentUpload';

interface DocumentUploaderProps {
  document: DocumentState;
  title: string;
  description: string;
  icon: string;
  required?: boolean;
  onSelect: () => void;
}

export function DocumentUploader({
  document,
  title,
  description,
  icon,
  required = true,
  onSelect,
}: DocumentUploaderProps) {
  const { theme } = useTheme();

  return (
    <Card variant="glass" padding="md" style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: BrandColors.helperLight }]}>
          <Icon name={icon as any} size={20} color={BrandColors.helper} />
        </View>
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <ThemedText style={[styles.title, { color: theme.text }]}>{title}</ThemedText>
            {required && <ThemedText style={styles.requiredBadge}>필수</ThemedText>}
          </View>
          <ThemedText style={[styles.description, { color: theme.tabIconDefault }]}>
            {description}
          </ThemedText>
        </View>
        {document.uploaded ? (
          <View style={[styles.statusBadge, { backgroundColor: BrandColors.successLight }]}>
            <Icon name="checkmark-outline" size={14} color={BrandColors.success} />
          </View>
        ) : document.uploading ? (
          <ActivityIndicator size="small" color={BrandColors.helper} />
        ) : null}
      </View>

      {document.uri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: document.uri }} style={styles.previewImage} resizeMode="cover" />
          <Pressable
            style={[styles.changeButton, { backgroundColor: theme.backgroundDefault }]}
            onPress={onSelect}
          >
            <Icon name="refresh-outline" size={14} color={theme.text} />
            <ThemedText style={[styles.changeButtonText, { color: theme.text }]}>변경</ThemedText>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.uploadButton, { borderColor: BrandColors.helper }]}
          onPress={onSelect}
        >
          <Icon name="camera-outline" size={20} color={BrandColors.helper} />
          <ThemedText style={[styles.uploadButtonText, { color: BrandColors.helper }]}>
            사진 촬영 / 이미지 선택
          </ThemedText>
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  requiredBadge: {
    fontSize: 10,
    color: BrandColors.error,
    marginLeft: Spacing.xs,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 120,
    borderRadius: BorderRadius.md,
  },
  changeButton: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  changeButtonText: {
    fontSize: 12,
  },
  uploadButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
