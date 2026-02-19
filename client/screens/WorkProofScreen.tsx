import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform, ActivityIndicator, Image, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { getToken } from '@/utils/secure-token-storage';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { takePhoto, pickImage, uploadImageWithRetry } from '@/lib/image-upload';
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from '@/constants/theme';

type WorkProofScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route?: {
    params?: {
      orderId?: string;
      contractId?: string;
      type?: 'pickup' | 'delivery' | 'other';
    };
  };
};

type ProofImage = {
  uri: string;
  uploaded: boolean;
  uploadUrl?: string;
  error?: string;
};

export default function WorkProofScreen({ navigation, route }: WorkProofScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const orderId = route?.params?.orderId;
  const contractId = route?.params?.contractId;
  const proofType = route?.params?.type || 'delivery';

  const [images, setImages] = useState<ProofImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [note, setNote] = useState('');
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  const proofTypeLabels: Record<string, string> = {
    pickup: '픽업 증빙',
    delivery: '배달 완료 증빙',
    other: '기타 증빙',
  };

  const handleTakePhoto = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        if (Platform.OS !== 'web') {
          Alert.alert('권한 필요', '사진 촬영을 위해 카메라 권한이 필요합니다.');
        }
        return;
      }
    }

    const uri = await takePhoto({ quality: 0.8 });
    if (uri) {
      setImages(prev => [...prev, { uri, uploaded: false }]);
    }
  }, [cameraPermission, requestCameraPermission]);

  const handlePickImage = useCallback(async () => {
    const uri = await pickImage({ source: 'library', quality: 0.8 });
    if (uri) {
      setImages(prev => [...prev, { uri, uploaded: false }]);
    }
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUploadAll = useCallback(async () => {
    if (images.length === 0) {
      if (Platform.OS !== 'web') {
        Alert.alert('알림', '업로드할 사진이 없습니다.');
      }
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const token = await getToken();
    const updatedImages = [...images];

    for (let i = 0; i < updatedImages.length; i++) {
      if (!updatedImages[i].uploaded) {
        const result = await uploadImageWithRetry(
          updatedImages[i].uri,
          '/api/work-proof/upload',
          'file',
          {
            orderId: orderId || '',
            contractId: contractId || '',
            type: proofType,
            note,
          },
          3,
          token
        );

        if (result.success) {
          updatedImages[i] = { ...updatedImages[i], uploaded: true, uploadUrl: result.url };
        } else {
          updatedImages[i] = { ...updatedImages[i], error: result.error };
        }
      }
      setUploadProgress(((i + 1) / updatedImages.length) * 100);
    }

    setImages(updatedImages);
    setIsUploading(false);

    const allUploaded = updatedImages.every(img => img.uploaded);
    if (allUploaded) {
      if (Platform.OS !== 'web') {
        Alert.alert('완료', '모든 사진이 업로드되었습니다.', [
          { text: '확인', onPress: () => navigation.goBack() }
        ]);
      } else {
        navigation.goBack();
      }
    }
  }, [images, orderId, contractId, proofType, note, navigation]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }]}
        >
          <Card style={styles.webCard}>
            <View style={[styles.iconContainer, { backgroundColor: BrandColors.helperLight }]}>
              <Icon name="cellphone" size={48} color={BrandColors.helper} />
            </View>
            <ThemedText style={[styles.webTitle, { color: theme.text }]}>
              모바일 앱에서 사용해주세요
            </ThemedText>
            <ThemedText style={[styles.webSubtitle, { color: theme.tabIconDefault }]}>
              업무증빙 사진 촬영은 Expo Go 앱에서 사용하시면
              {'\n'}더 편리하게 이용하실 수 있습니다.
            </ThemedText>
            <Pressable
              style={[styles.backButton, { backgroundColor: BrandColors.helper }]}
              onPress={() => navigation.goBack()}
            >
              <ThemedText style={styles.backButtonText}>돌아가기</ThemedText>
            </Pressable>
          </Card>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }
        ]}
      >
        <Card style={styles.headerCard}>
          <View style={[styles.iconContainer, { backgroundColor: BrandColors.helperLight }]}>
            <Icon name="camera-outline" size={32} color={BrandColors.helper} />
          </View>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            {proofTypeLabels[proofType]}
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.tabIconDefault }]}>
            배달 완료를 증명할 사진을 촬영해주세요
          </ThemedText>
        </Card>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: BrandColors.helper }]}
            onPress={handleTakePhoto}
            testID="button-take-photo"
          >
            <Icon name="camera-outline" size={20} color="#FFFFFF" />
            <ThemedText style={styles.actionButtonText}>사진 촬영</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: theme.backgroundDefault, borderWidth: 1, borderColor: BrandColors.helper }]}
            onPress={handlePickImage}
            testID="button-pick-image"
          >
            <Icon name="image-outline" size={20} color={BrandColors.helper} />
            <ThemedText style={[styles.actionButtonText, { color: BrandColors.helper }]}>갤러리</ThemedText>
          </Pressable>
        </View>

        {images.length > 0 ? (
          <>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              촬영한 사진 ({images.length})
            </ThemedText>
            <View style={styles.imageGrid}>
              {images.map((image, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri: image.uri }} style={styles.previewImage} />
                  {image.uploaded ? (
                    <View style={[styles.uploadBadge, { backgroundColor: BrandColors.success }]}>
                      <Icon name="checkmark-outline" size={14} color="#FFFFFF" />
                    </View>
                  ) : image.error ? (
                    <View style={[styles.uploadBadge, { backgroundColor: BrandColors.error }]}>
                      <Icon name="close-outline" size={14} color="#FFFFFF" />
                    </View>
                  ) : null}
                  <Pressable
                    style={styles.removeButton}
                    onPress={() => handleRemoveImage(index)}
                    testID={`button-remove-${index}`}
                  >
                    <Icon name="close-outline" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </View>

            {isUploading ? (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: theme.backgroundDefault }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: BrandColors.helper, width: `${uploadProgress}%` }
                    ]}
                  />
                </View>
                <ThemedText style={[styles.progressText, { color: theme.tabIconDefault }]}>
                  업로드 중... {Math.round(uploadProgress)}%
                </ThemedText>
              </View>
            ) : (
              <Pressable
                style={[styles.uploadButton, { backgroundColor: BrandColors.helper }]}
                onPress={handleUploadAll}
                testID="button-upload-all"
              >
                <Icon name="cloud-upload-outline" size={20} color="#FFFFFF" />
                <ThemedText style={styles.uploadButtonText}>업로드하기</ThemedText>
              </Pressable>
            )}
          </>
        ) : (
          <Card style={styles.emptyCard}>
            <View style={[styles.emptyIconContainer, { backgroundColor: theme.backgroundDefault }]}>
              <Icon name="image-outline" size={40} color={theme.tabIconDefault} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              촬영한 사진이 없습니다
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
              위 버튼을 눌러 사진을 촬영하거나 갤러리에서 선택하세요
            </ThemedText>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  headerCard: {
    padding: Spacing['2xl'],
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
  },
  headerSubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  imageWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.sm,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    marginBottom: Spacing.xl,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    ...Typography.small,
    textAlign: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xl,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
  emptyCard: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    ...Typography.small,
    textAlign: 'center',
    lineHeight: 20,
  },
  webCard: {
    padding: Spacing['3xl'],
    alignItems: 'center',
    marginTop: Spacing['3xl'],
  },
  webTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  webSubtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  backButton: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  backButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
});
