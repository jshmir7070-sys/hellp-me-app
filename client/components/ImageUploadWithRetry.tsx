import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Image, Pressable, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Icon } from "@/components/Icon";
import { ThemedText } from './ThemedText';
import { Spacing, BorderRadius, BrandColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { getApiUrl } from '@/lib/query-client';

interface UploadedImage {
  uri: string;
  serverPath?: string;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  retryCount: number;
  errorMessage?: string;
}

interface ImageUploadWithRetryProps {
  uploadEndpoint?: string;
  maxImages?: number;
  maxRetries?: number;
  onUploadComplete?: (images: Array<{ uri: string; serverPath: string }>) => void;
  onUploadError?: (error: string) => void;
  label?: string;
  required?: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export function ImageUploadWithRetry({
  uploadEndpoint = '/api/upload',
  maxImages = 5,
  maxRetries = MAX_RETRIES,
  onUploadComplete,
  onUploadError,
  label = '이미지 업로드',
  required = false,
}: ImageUploadWithRetryProps) {
  const { theme } = useTheme();
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const uploadImage = useCallback(async (imageUri: string, index: number): Promise<boolean> => {
    try {
      setImages(prev => prev.map((img, i) => 
        i === index ? { ...img, status: 'uploading' } : img
      ));

      const formData = new FormData();
      const file = new File(imageUri);
      formData.append('file', file);

      const response = await fetch(new URL(uploadEndpoint, getApiUrl()).toString(), {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const result = await response.json();
      const serverPath = result.path || result.url || result.filePath;

      setImages(prev => prev.map((img, i) => 
        i === index ? { ...img, status: 'success', serverPath, errorMessage: undefined } : img
      ));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '업로드 실패';
      
      setImages(prev => prev.map((img, i) => 
        i === index ? { 
          ...img, 
          status: 'failed', 
          retryCount: img.retryCount + 1,
          errorMessage,
        } : img
      ));

      return false;
    }
  }, [uploadEndpoint]);

  const retryUpload = useCallback(async (index: number) => {
    const image = images[index];
    if (!image || image.retryCount >= maxRetries) {
      Alert.alert('재시도 제한', `최대 ${maxRetries}회까지 재시도할 수 있습니다.`);
      return;
    }

    let attempts = 0;
    let success = false;

    while (attempts < 2 && !success) {
      if (attempts > 0) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempts));
      }
      success = await uploadImage(image.uri, index);
      attempts++;
    }

    if (success) {
      checkAllUploadsComplete();
    }
  }, [images, maxRetries, uploadImage]);

  const checkAllUploadsComplete = useCallback(() => {
    setImages(current => {
      const allSuccessful = current.every(img => img.status === 'success');
      if (allSuccessful && onUploadComplete) {
        const successfulImages = current
          .filter(img => img.serverPath)
          .map(img => ({ uri: img.uri, serverPath: img.serverPath! }));
        onUploadComplete(successfulImages);
      }
      return current;
    });
  }, [onUploadComplete]);

  const pickImage = useCallback(async () => {
    if (isPickerOpen) return;
    if (images.length >= maxImages) {
      Alert.alert('제한 초과', `최대 ${maxImages}개의 이미지만 업로드할 수 있습니다.`);
      return;
    }

    setIsPickerOpen(true);

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      setIsPickerOpen(false);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    setIsPickerOpen(false);

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const newImage: UploadedImage = {
      uri: result.assets[0].uri,
      status: 'pending',
      retryCount: 0,
    };

    const newIndex = images.length;
    setImages(prev => [...prev, newImage]);

    setTimeout(() => {
      uploadImage(result.assets[0].uri, newIndex);
    }, 100);
  }, [images.length, maxImages, isPickerOpen, uploadImage]);

  const takePhoto = useCallback(async () => {
    if (images.length >= maxImages) {
      Alert.alert('제한 초과', `최대 ${maxImages}개의 이미지만 업로드할 수 있습니다.`);
      return;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const newImage: UploadedImage = {
      uri: result.assets[0].uri,
      status: 'pending',
      retryCount: 0,
    };

    const newIndex = images.length;
    setImages(prev => [...prev, newImage]);

    setTimeout(() => {
      uploadImage(result.assets[0].uri, newIndex);
    }, 100);
  }, [images.length, maxImages, uploadImage]);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const retryAllFailed = useCallback(async () => {
    const failedIndices = images
      .map((img, index) => img.status === 'failed' ? index : -1)
      .filter(i => i >= 0);

    for (const index of failedIndices) {
      await retryUpload(index);
    }
  }, [images, retryUpload]);

  const failedCount = images.filter(img => img.status === 'failed').length;
  const uploadingCount = images.filter(img => img.status === 'uploading').length;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <ThemedText style={styles.label}>
          {label}
          {required && <ThemedText style={{ color: BrandColors.error }}> *</ThemedText>}
        </ThemedText>
        {failedCount > 0 && (
          <Pressable onPress={retryAllFailed} style={styles.retryAllButton}>
            <Icon name="refresh-outline" size={14} color={BrandColors.primary} />
            <ThemedText style={[styles.retryAllText, { color: BrandColors.primary }]}>
              실패 {failedCount}건 재시도
            </ThemedText>
          </Pressable>
        )}
      </View>

      <View style={styles.imageGrid}>
        {images.map((image, index) => (
          <View key={`${image.uri}-${index}`} style={styles.imageWrapper}>
            <Image source={{ uri: image.uri }} style={styles.thumbnail} />
            
            {image.status === 'uploading' && (
              <View style={styles.overlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            
            {image.status === 'success' && (
              <View style={[styles.statusBadge, styles.successBadge]}>
                <Icon name="checkmark-outline" size={12} color="#fff" />
              </View>
            )}
            
            {image.status === 'failed' && (
              <>
                <View style={styles.overlay}>
                  <Pressable 
                    onPress={() => retryUpload(index)}
                    style={styles.retryButton}
                  >
                    <Icon name="refresh-outline" size={20} color="#fff" />
                    <ThemedText style={styles.retryText}>
                      재시도 ({image.retryCount}/{maxRetries})
                    </ThemedText>
                  </Pressable>
                </View>
                <View style={[styles.statusBadge, styles.failedBadge]}>
                  <Icon name="close-outline" size={12} color="#fff" />
                </View>
              </>
            )}

            <Pressable
              onPress={() => removeImage(index)}
              style={styles.removeButton}
            >
              <Icon name="close-outline" size={16} color="#fff" />
            </Pressable>
          </View>
        ))}

        {images.length < maxImages && (
          <View style={styles.addButtonsRow}>
            <Pressable
              onPress={pickImage}
              style={[styles.addButton, { borderColor: theme.backgroundTertiary }]}
              disabled={uploadingCount > 0}
            >
              <Icon name="image-outline" size={24} color={theme.tabIconDefault} />
              <ThemedText style={[styles.addButtonText, { color: theme.tabIconDefault }]}>
                갤러리
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={takePhoto}
              style={[styles.addButton, { borderColor: theme.backgroundTertiary }]}
              disabled={uploadingCount > 0}
            >
              <Icon name="camera-outline" size={24} color={theme.tabIconDefault} />
              <ThemedText style={[styles.addButtonText, { color: theme.tabIconDefault }]}>
                카메라
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>

      {failedCount > 0 && (
        <ThemedText style={styles.errorHint}>
          업로드에 실패한 이미지가 있습니다. 재시도 버튼을 눌러주세요.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  retryAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  retryAllText: {
    fontSize: 12,
    fontWeight: '500',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  imageWrapper: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBadge: {
    backgroundColor: BrandColors.success,
  },
  failedBadge: {
    backgroundColor: BrandColors.error,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    alignItems: 'center',
    padding: Spacing.xs,
  },
  retryText: {
    color: '#fff',
    fontSize: 10,
    marginTop: 2,
  },
  addButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  addButton: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 12,
  },
  errorHint: {
    fontSize: 12,
    color: BrandColors.error,
    marginTop: Spacing.xs,
  },
});
