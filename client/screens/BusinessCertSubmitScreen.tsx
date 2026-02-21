import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Platform, Image, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { getToken } from '@/utils/secure-token-storage';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, BrandColors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type BusinessCertSubmitScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface DocumentData {
  id?: number;
  type: 'businessCert';
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'not_submitted';
  imageUrl?: string;
  uploadedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  businessNumber?: string;
  businessName?: string;
  representativeName?: string;
  businessType?: string;
  businessCategory?: string;
  email?: string;
}

export default function BusinessCertSubmitScreen({ navigation }: BusinessCertSubmitScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [businessInfo, setBusinessInfo] = useState({
    businessNumber: '',
    businessName: '',
    representativeName: '',
    businessType: '',
    businessCategory: '',
    email: '',
  });

  // 기존 서류 조회
  const { data: document, isLoading } = useQuery<DocumentData>({
    queryKey: ['/api/helpers/documents/businessCert'],
  });

  React.useEffect(() => {
    if (document) {
      if (document.imageUrl) {
        setSelectedImage(document.imageUrl);
      }
      setBusinessInfo({
        businessNumber: document.businessNumber || '',
        businessName: document.businessName || '',
        representativeName: document.representativeName || '',
        businessType: document.businessType || '',
        businessCategory: document.businessCategory || '',
        email: document.email || '',
      });
    }
  }, [document]);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('오류', '이미지 선택에 실패했습니다');
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('알림', '웹에서는 카메라를 사용할 수 없습니다');
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '카메라 권한이 필요합니다');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('오류', '카메라 실행에 실패했습니다');
    }
  };

  const handleSelectImage = () => {
    if (Platform.OS === 'web') {
      handlePickImage();
    } else {
      Alert.alert(
        '이미지 선택',
        '사업자등록증을 어떻게 추가하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '갤러리에서 선택', onPress: handlePickImage },
          { text: '카메라로 촬영', onPress: handleTakePhoto },
        ]
      );
    }
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      Alert.alert('알림', '사업자등록증 이미지를 선택해주세요');
      return;
    }

    if (!businessInfo.businessNumber || !businessInfo.businessName || !businessInfo.representativeName || !businessInfo.businessType || !businessInfo.businessCategory || !businessInfo.email) {
      Alert.alert('알림', '필수 사업자 정보를 모두 입력해주세요');
      return;
    }

    setIsUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();

      // 이미지 파일 추가
      if (Platform.OS === 'web') {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        formData.append('file', blob, 'businessCert.jpg');
      } else {
        const uriParts = selectedImage.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        formData.append('file', { uri: selectedImage, name: `businessCert.${fileType}`, type: `image/${fileType}` } as any);
      }

      // 사업자 정보 추가
      formData.append('businessNumber', businessInfo.businessNumber);
      formData.append('businessName', businessInfo.businessName);
      formData.append('representativeName', businessInfo.representativeName);
      formData.append('businessType', businessInfo.businessType);
      formData.append('businessCategory', businessInfo.businessCategory);
      formData.append('email', businessInfo.email);

      const uploadResponse = await fetch(
        new URL('/api/helpers/documents/businessCert', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (uploadResponse.ok) {
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents/status'] });
        Alert.alert('완료', '사업자등록증이 제출되었습니다', [
          { text: '확인', onPress: () => navigation.goBack() }
        ]);
      } else {
        const data = await uploadResponse.json();
        Alert.alert('오류', data.message || '제출에 실패했습니다');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('오류', '제출에 실패했습니다');
    } finally {
      setIsUploading(false);
    }
  };

  const canResubmit = document?.status === 'rejected' || !document;
  const inputStyle = [styles.textInput, {
    backgroundColor: theme.backgroundDefault,
    color: theme.text,
    borderColor: isDark ? '#4B5563' : '#D1D5DB'
  }];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      {/* 상태 카드 */}
      {document && document.status !== 'not_submitted' && (
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            {document.status === 'approved' && (
              <>
                <Icon name="checkmark-circle" size={24} color="#10B981" />
                <ThemedText style={[styles.statusTitle, { color: '#10B981' }]}>
                  승인완료
                </ThemedText>
              </>
            )}
            {document.status === 'reviewing' && (
              <>
                <Icon name="time-outline" size={24} color="#3B82F6" />
                <ThemedText style={[styles.statusTitle, { color: '#3B82F6' }]}>
                  검토중
                </ThemedText>
              </>
            )}
            {document.status === 'rejected' && (
              <>
                <Icon name="close-circle" size={24} color="#EF4444" />
                <ThemedText style={[styles.statusTitle, { color: '#EF4444' }]}>
                  반려됨
                </ThemedText>
              </>
            )}
          </View>

          {document.status === 'rejected' && document.rejectionReason && (
            <View style={[styles.rejectionBox, { backgroundColor: '#FEE2E2' }]}>
              <ThemedText style={[styles.rejectionLabel, { color: '#991B1B' }]}>
                반려 사유:
              </ThemedText>
              <ThemedText style={[styles.rejectionText, { color: '#991B1B' }]}>
                {document.rejectionReason}
              </ThemedText>
            </View>
          )}

          {document.status === 'approved' && (
            <ThemedText style={[styles.statusDescription, { color: theme.tabIconDefault }]}>
              서류가 승인되었습니다. 필요시 업데이트할 수 있습니다.
            </ThemedText>
          )}
        </Card>
      )}

      {/* 이미지 업로드 */}
      <Card style={styles.uploadCard}>
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
          사업자등록증 이미지
        </ThemedText>

        {selectedImage ? (
          <View style={styles.imagePreview}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <Pressable
              style={({ pressed }) => [
                styles.removeImageButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => setSelectedImage(null)}
            >
              <Icon name="close-circle" size={28} color="#EF4444" />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.uploadPlaceholder, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
            <Icon name="cloud-upload-outline" size={48} color={theme.tabIconDefault} />
            <ThemedText style={[styles.uploadHint, { color: theme.tabIconDefault }]}>
              사업자등록증을 촬영하거나 선택해주세요
            </ThemedText>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.uploadButton,
            {
              backgroundColor: BrandColors.helperLight,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={handleSelectImage}
        >
          <Icon name="camera-outline" size={20} color={BrandColors.helper} />
          <ThemedText style={[styles.uploadButtonText, { color: BrandColors.helper }]}>
            사진 촬영 / 이미지 선택
          </ThemedText>
        </Pressable>
      </Card>

      {/* 사업자 정보 입력 */}
      <Card style={styles.infoCard}>
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
          사업자 정보
        </ThemedText>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
            사업자번호 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="000-00-00000"
            placeholderTextColor={Colors.light.tabIconDefault}
            value={businessInfo.businessNumber}
            onChangeText={(text) => setBusinessInfo({ ...businessInfo, businessNumber: text })}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
            상호명 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="상호명을 입력하세요"
            placeholderTextColor={Colors.light.tabIconDefault}
            value={businessInfo.businessName}
            onChangeText={(text) => setBusinessInfo({ ...businessInfo, businessName: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
            대표자명 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="대표자명을 입력하세요"
            placeholderTextColor={Colors.light.tabIconDefault}
            value={businessInfo.representativeName}
            onChangeText={(text) => setBusinessInfo({ ...businessInfo, representativeName: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
            업태 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="업태를 입력하세요 (예: 운수업)"
            placeholderTextColor={Colors.light.tabIconDefault}
            value={businessInfo.businessType}
            onChangeText={(text) => setBusinessInfo({ ...businessInfo, businessType: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
            업종 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="업종을 입력하세요 (예: 화물운송)"
            placeholderTextColor={Colors.light.tabIconDefault}
            value={businessInfo.businessCategory}
            onChangeText={(text) => setBusinessInfo({ ...businessInfo, businessCategory: text })}
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
            이메일 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
          </ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="이메일을 입력하세요"
            placeholderTextColor={Colors.light.tabIconDefault}
            value={businessInfo.email}
            onChangeText={(text) => setBusinessInfo({ ...businessInfo, email: text })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
      </Card>

      {/* 안내사항 */}
      <Card style={[styles.guideCard, { backgroundColor: BrandColors.helperLight }]}>
        <View style={styles.guideHeader}>
          <Icon name="information-circle-outline" size={20} color={BrandColors.helper} />
          <ThemedText style={[styles.guideTitle, { color: BrandColors.helper }]}>
            제출 안내
          </ThemedText>
        </View>
        <ThemedText style={[styles.guideText, { color: theme.tabIconDefault }]}>
          • 사업자등록증 전체가 선명하게 보이도록 촬영해주세요{'\n'}
          • 개인사업자 또는 법인사업자 모두 가능합니다{'\n'}
          • 사업자번호는 하이픈(-)을 포함하여 입력해주세요{'\n'}
          • 서류 검토는 영업일 기준 1-2일 소요됩니다
        </ThemedText>
      </Card>

      {/* 제출 버튼 */}
      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          {
            backgroundColor: BrandColors.helper,
            opacity: (pressed || isUploading || !canResubmit) ? 0.7 : 1,
          },
        ]}
        onPress={handleSubmit}
        disabled={isUploading || !canResubmit}
      >
        {isUploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Icon name="checkmark-circle-outline" size={20} color="#fff" />
            <ThemedText style={styles.submitButtonText}>
              {document?.status === 'rejected' ? '재제출하기' : '제출하기'}
            </ThemedText>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusDescription: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  rejectionBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 14,
  },
  uploadCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  imagePreview: {
    position: 'relative',
    width: '100%',
    height: 250,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BorderRadius.full,
  },
  uploadPlaceholder: {
    height: 200,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  uploadHint: {
    fontSize: 14,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  guideCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  guideText: {
    fontSize: 13,
    lineHeight: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
