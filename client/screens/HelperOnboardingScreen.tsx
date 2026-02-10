import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput, Alert, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Spacing, BorderRadius, BrandColors, Colors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

type HelperOnboardingScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

type DocumentType = 'businessCert' | 'driverLicense' | 'cargoLicense' | 'vehicleCert' | 'transportContract';

type DocumentState = {
  uri: string | null;
  uploaded: boolean;
  url: string | null;
  uploading: boolean;
};

const VEHICLE_TYPES = [
  { id: '1톤하이탑', label: '1톤 하이탑' },
  { id: '1톤정탑', label: '1톤 정탑' },
  { id: '1톤저탑', label: '1톤 저탑' },
  { id: '1톤냉탑', label: '1톤 냉탑' },
  { id: '쓰리밴', label: '쓰리밴' },
];

const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

const PLATE_LETTERS = ['아', '바', '사', '자'];

export default function HelperOnboardingScreen({ navigation }: HelperOnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { user, refreshUser } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [documents, setDocuments] = useState<Record<DocumentType, DocumentState>>({
    businessCert: { uri: null, uploaded: false, url: null, uploading: false },
    driverLicense: { uri: null, uploaded: false, url: null, uploading: false },
    cargoLicense: { uri: null, uploaded: false, url: null, uploading: false },
    vehicleCert: { uri: null, uploaded: false, url: null, uploading: false },
    transportContract: { uri: null, uploaded: false, url: null, uploading: false },
  });

  const [businessInfo, setBusinessInfo] = useState({
    businessNumber: '',
    businessName: '',
    representativeName: '',
    businessAddress: '',
    businessType: '',
    businessCategory: '',
    email: '',
  });

  const [vehicleInfo, setVehicleInfo] = useState({
    region: '서울',
    plateNumber1: '',
    plateLetter: '아',
    plateNumber2: '',
    vehicleType: '',
  });

  const getFullPlateNumber = () => {
    const { region, plateNumber1, plateLetter, plateNumber2 } = vehicleInfo;
    if (plateNumber1 && plateLetter && plateNumber2) {
      return `${region} ${plateNumber1}${plateLetter} ${plateNumber2}`;
    }
    return '';
  };

  const pickImage = async (docType: DocumentType) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setDocuments(prev => ({
        ...prev,
        [docType]: { ...prev[docType], uri: result.assets[0].uri, uploaded: false },
      }));
      handleUploadDocument(docType, result.assets[0].uri);
    }
  };

  const takePhoto = async (docType: DocumentType) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      if (Platform.OS !== 'web') {
        Alert.alert('권한 필요', '카메라 권한이 필요합니다.');
      }
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setDocuments(prev => ({
        ...prev,
        [docType]: { ...prev[docType], uri: result.assets[0].uri, uploaded: false },
      }));
      handleUploadDocument(docType, result.assets[0].uri);
    }
  };

  const handleSelectImage = useCallback(async (docType: DocumentType) => {
    if (Platform.OS === 'web') {
      await pickImage(docType);
    } else {
      Alert.alert(
        '이미지 선택',
        '이미지를 어떻게 추가하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '갤러리에서 선택', onPress: () => pickImage(docType) },
          { text: '카메라로 촬영', onPress: () => takePhoto(docType) },
        ]
      );
    }
  }, []);

  const handleUploadDocument = useCallback(async (docType: DocumentType, uri: string) => {
    setDocuments(prev => ({
      ...prev,
      [docType]: { ...prev[docType], uploading: true },
    }));

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const formData = new FormData();
      
      const uriParts = uri.split('.');
      const fileType = uriParts[uriParts.length - 1] || 'jpg';
      
      if (Platform.OS === 'web') {
        const blobResponse = await fetch(uri);
        const blob = await blobResponse.blob();
        formData.append('file', blob, `${docType}.${fileType}`);
      } else {
        formData.append('file', {
          uri: uri,
          name: `${docType}.${fileType}`,
          type: `image/${fileType}`,
        } as any);
      }
      formData.append('type', docType);

      const response = await fetch(
        new URL('/api/helpers/credential/upload', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const result = await response.json();
        setDocuments(prev => ({
          ...prev,
          [docType]: { ...prev[docType], uploaded: true, url: result.url, uploading: false },
        }));
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || '업로드 실패');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setDocuments(prev => ({
        ...prev,
        [docType]: { ...prev[docType], uploading: false, uri: null },
      }));
      if (Platform.OS === 'web') {
        alert('업로드 실패: ' + (error.message || '다시 시도해주세요.'));
      } else {
        Alert.alert('업로드 실패', error.message || '다시 시도해주세요.');
      }
    }
  }, []);

  const canSubmit = () => {
    return !!(
      businessInfo.businessNumber &&
      businessInfo.businessName &&
      businessInfo.representativeName &&
      businessInfo.businessAddress &&
      businessInfo.businessType &&
      businessInfo.businessCategory &&
      businessInfo.email &&
      vehicleInfo.vehicleType &&
      vehicleInfo.plateNumber1 &&
      vehicleInfo.plateNumber2 &&
      documents.businessCert.uploaded &&
      documents.driverLicense.uploaded &&
      documents.cargoLicense.uploaded &&
      documents.vehicleCert.uploaded
    );
  };

  const handleSaveAndContinue = async () => {
    if (!canSubmit()) {
      const missing: string[] = [];
      if (!businessInfo.businessNumber) missing.push('사업자등록번호');
      if (!businessInfo.businessName) missing.push('상호명');
      if (!businessInfo.representativeName) missing.push('대표자명');
      if (!businessInfo.businessAddress) missing.push('사업장 주소');
      if (!businessInfo.businessType) missing.push('업태');
      if (!businessInfo.businessCategory) missing.push('업종');
      if (!businessInfo.email) missing.push('이메일');
      if (!vehicleInfo.vehicleType) missing.push('차량 종류');
      if (!vehicleInfo.plateNumber1 || !vehicleInfo.plateNumber2) missing.push('차량번호');
      if (!documents.businessCert.uploaded) missing.push('사업자등록증');
      if (!documents.driverLicense.uploaded) missing.push('운전면허증');
      if (!documents.cargoLicense.uploaded) missing.push('화물운송자격증');
      if (!documents.vehicleCert.uploaded) missing.push('차량등록증');

      const message = `다음 항목을 확인해주세요:\n${missing.join(', ')}`;
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('필수 항목 누락', message);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');

      const businessResponse = await fetch(
        new URL('/api/helpers/me/business', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            businessNumber: businessInfo.businessNumber,
            businessName: businessInfo.businessName,
            representativeName: businessInfo.representativeName,
            address: businessInfo.businessAddress,
            businessType: businessInfo.businessType,
            businessCategory: businessInfo.businessCategory,
            email: businessInfo.email,
            businessImageUrl: documents.businessCert.url,
          }),
        }
      );

      if (!businessResponse.ok) {
        throw new Error('사업자 정보 저장 실패');
      }

      const licenseResponse = await fetch(
        new URL('/api/helpers/me/license', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            driverLicenseImageUrl: documents.driverLicense.url,
            cargoLicenseImageUrl: documents.cargoLicense.url,
          }),
        }
      );

      if (!licenseResponse.ok) {
        throw new Error('면허증 정보 저장 실패');
      }

      const vehicleResponse = await fetch(
        new URL('/api/helpers/me/vehicle', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            vehicleType: vehicleInfo.vehicleType,
            plateNumber: getFullPlateNumber(),
            vehicleImageUrl: documents.vehicleCert.url,
          }),
        }
      );

      if (!vehicleResponse.ok) {
        throw new Error('차량 정보 저장 실패');
      }

      navigation.navigate('ContractSigning');
    } catch (error: any) {
      console.error('Save error:', error);
      if (Platform.OS === 'web') {
        alert('저장 실패: ' + (error.message || '다시 시도해주세요.'));
      } else {
        Alert.alert('저장 실패', error.message || '다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDocumentUploader = (
    docType: DocumentType,
    title: string,
    description: string,
    icon: string,
    required: boolean = true
  ) => {
    const doc = documents[docType];
    
    return (
      <Card variant="glass" padding="md" style={styles.documentCard}>
        <View style={styles.documentHeader}>
          <View style={[styles.documentIcon, { backgroundColor: BrandColors.helperLight }]}>
            <Icon name={icon as any} size={20} color={BrandColors.helper} />
          </View>
          <View style={styles.documentInfo}>
            <View style={styles.documentTitleRow}>
              <ThemedText style={[styles.documentTitle, { color: theme.text }]}>{title}</ThemedText>
              {required ? <ThemedText style={styles.requiredBadge}>필수</ThemedText> : null}
            </View>
            <ThemedText style={[styles.documentDescription, { color: theme.tabIconDefault }]}>{description}</ThemedText>
          </View>
          {doc.uploaded ? (
            <View style={[styles.statusBadge, { backgroundColor: BrandColors.successLight }]}>
              <Icon name="checkmark-outline" size={14} color={BrandColors.success} />
            </View>
          ) : doc.uploading ? (
            <ActivityIndicator size="small" color={BrandColors.helper} />
          ) : null}
        </View>

        {doc.uri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: doc.uri }} style={styles.previewImage} resizeMode="cover" />
            <Pressable
              style={[styles.changeButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => handleSelectImage(docType)}
            >
              <Icon name="refresh-outline" size={14} color={theme.text} />
              <ThemedText style={[styles.changeButtonText, { color: theme.text }]}>변경</ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.uploadButton, { borderColor: BrandColors.helper }]}
            onPress={() => handleSelectImage(docType)}
          >
            <Icon name="camera-outline" size={20} color={BrandColors.helper} />
            <ThemedText style={[styles.uploadButtonText, { color: BrandColors.helper }]}>
              사진 촬영 / 이미지 선택
            </ThemedText>
          </Pressable>
        )}
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content, 
          { 
            paddingTop: headerHeight + Spacing.lg + 94,
            paddingBottom: insets.bottom + 100,
          }
        ]}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.headerSection}>
          <ThemedText style={[styles.mainTitle, { color: theme.text }]}>헬퍼 서류 제출</ThemedText>
          <ThemedText style={[styles.mainSubtitle, { color: theme.tabIconDefault }]}>
            모든 서류를 등록하고 제출해주세요. 관리자 승인 후 오더 신청이 가능합니다.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>1. 사업자 정보</ThemedText>
          
          <View style={styles.formGroup}>
            <ThemedText style={[styles.label, { color: theme.text }]}>사업자등록번호 <ThemedText style={styles.required}>*</ThemedText></ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary }]}
              placeholder="000-00-00000"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={businessInfo.businessNumber}
              onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessNumber: text }))}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <ThemedText style={[styles.label, { color: theme.text }]}>상호명 <ThemedText style={styles.required}>*</ThemedText></ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary }]}
                placeholder="상호명"
                placeholderTextColor={Colors.light.tabIconDefault}
                value={businessInfo.businessName}
                onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessName: text }))}
              />
            </View>
            <View style={[styles.formGroup, { flex: 1, marginLeft: Spacing.md }]}>
              <ThemedText style={[styles.label, { color: theme.text }]}>대표자명 <ThemedText style={styles.required}>*</ThemedText></ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary }]}
                placeholder="대표자"
                placeholderTextColor={Colors.light.tabIconDefault}
                value={businessInfo.representativeName}
                onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, representativeName: text }))}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={[styles.label, { color: theme.text }]}>사업장 주소 <ThemedText style={styles.required}>*</ThemedText></ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary }]}
              placeholder="사업장 주소"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={businessInfo.businessAddress}
              onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessAddress: text }))}
            />
          </View>

          <View style={styles.formRow}>
            <View style={[styles.formGroup, { flex: 1 }]}>
              <ThemedText style={[styles.label, { color: theme.text }]}>업태 <ThemedText style={styles.required}>*</ThemedText></ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary }]}
                placeholder="운수업"
                placeholderTextColor={Colors.light.tabIconDefault}
                value={businessInfo.businessType}
                onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessType: text }))}
              />
            </View>
            <View style={[styles.formGroup, { flex: 1, marginLeft: Spacing.md }]}>
              <ThemedText style={[styles.label, { color: theme.text }]}>업종 <ThemedText style={styles.required}>*</ThemedText></ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary }]}
                placeholder="화물운송"
                placeholderTextColor={Colors.light.tabIconDefault}
                value={businessInfo.businessCategory}
                onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessCategory: text }))}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={[styles.label, { color: theme.text }]}>이메일 <ThemedText style={styles.required}>*</ThemedText></ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary }]}
              placeholder="example@email.com"
              placeholderTextColor={Colors.light.tabIconDefault}
              keyboardType="email-address"
              autoCapitalize="none"
              value={businessInfo.email}
              onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, email: text }))}
            />
          </View>

          {renderDocumentUploader('businessCert', '사업자등록증', '사업자등록증 전체가 보이도록', 'file-document-outline')}
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>2. 면허증</ThemedText>
          {renderDocumentUploader('driverLicense', '운전면허증', '운전면허증 앞면', 'credit-card-outline')}
          {renderDocumentUploader('cargoLicense', '화물운송자격증', '화물운송종사자격증', 'medal-outline')}
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>3. 차량 정보</ThemedText>
          
          <View style={styles.formGroup}>
            <ThemedText style={[styles.label, { color: theme.text }]}>차량 종류 <ThemedText style={styles.required}>*</ThemedText></ThemedText>
            <View style={styles.vehicleTypeGrid}>
              {VEHICLE_TYPES.map((type) => (
                <Pressable
                  key={type.id}
                  style={[
                    styles.vehicleTypeButton,
                    { 
                      backgroundColor: vehicleInfo.vehicleType === type.id ? BrandColors.helper : theme.backgroundDefault,
                      borderColor: vehicleInfo.vehicleType === type.id ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary),
                    }
                  ]}
                  onPress={() => setVehicleInfo(prev => ({ ...prev, vehicleType: type.id }))}
                >
                  <ThemedText style={[
                    styles.vehicleTypeText,
                    { color: vehicleInfo.vehicleType === type.id ? Colors.light.buttonText : theme.text }
                  ]}>
                    {type.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <ThemedText style={[styles.label, { color: theme.text }]}>차량번호 <ThemedText style={styles.required}>*</ThemedText></ThemedText>
            <View style={styles.plateInputRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionScroll}>
                {REGIONS.slice(0, 5).map((region) => (
                  <Pressable
                    key={region}
                    style={[
                      styles.regionButton,
                      { 
                        backgroundColor: vehicleInfo.region === region ? BrandColors.helper : theme.backgroundDefault,
                        borderColor: vehicleInfo.region === region ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary),
                      }
                    ]}
                    onPress={() => setVehicleInfo(prev => ({ ...prev, region }))}
                  >
                    <ThemedText style={{ color: vehicleInfo.region === region ? Colors.light.buttonText : theme.text, fontSize: 12 }}>
                      {region}
                    </ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={styles.plateInputRow}>
              <TextInput
                style={[styles.plateInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary }]}
                placeholder="12"
                placeholderTextColor={Colors.light.tabIconDefault}
                keyboardType="number-pad"
                maxLength={2}
                value={vehicleInfo.plateNumber1}
                onChangeText={(text) => setVehicleInfo(prev => ({ ...prev, plateNumber1: text }))}
              />
              <View style={styles.letterButtons}>
                {PLATE_LETTERS.map((letter) => (
                  <Pressable
                    key={letter}
                    style={[
                      styles.letterButton,
                      { 
                        backgroundColor: vehicleInfo.plateLetter === letter ? BrandColors.helper : theme.backgroundDefault,
                        borderColor: vehicleInfo.plateLetter === letter ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary),
                      }
                    ]}
                    onPress={() => setVehicleInfo(prev => ({ ...prev, plateLetter: letter }))}
                  >
                    <ThemedText style={{ color: vehicleInfo.plateLetter === letter ? Colors.light.buttonText : theme.text, fontSize: 14 }}>
                      {letter}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={[styles.plateInput, styles.plateInputLarge, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary }]}
                placeholder="0000"
                placeholderTextColor={Colors.light.tabIconDefault}
                keyboardType="number-pad"
                maxLength={4}
                value={vehicleInfo.plateNumber2}
                onChangeText={(text) => setVehicleInfo(prev => ({ ...prev, plateNumber2: text }))}
              />
            </View>
            {getFullPlateNumber() ? (
              <View style={[styles.platePreview, { backgroundColor: BrandColors.helperLight }]}>
                <ThemedText style={{ color: BrandColors.helper, fontWeight: '600' }}>{getFullPlateNumber()}</ThemedText>
              </View>
            ) : null}
          </View>

          {renderDocumentUploader('vehicleCert', '차량등록증', '차량등록증 전체가 보이도록', 'truck')}
        </View>

      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundRoot }]}>
        <Pressable
          style={[
            styles.submitButton,
            { 
              backgroundColor: canSubmit() ? BrandColors.helper : 'Colors.light.textTertiary',
              opacity: isSubmitting ? 0.7 : 1,
            }
          ]}
          onPress={handleSaveAndContinue}
          disabled={isSubmitting || !canSubmit()}
        >
          <ThemedText style={styles.submitButtonText}>다음: 계약서 서명</ThemedText>
          <Icon name="arrow-forward-outline" size={20} color={Colors.light.buttonText} />
        </Pressable>
      </View>
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
  headerSection: {
    marginBottom: Spacing.xl,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  mainSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  formRow: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  required: {
    color: BrandColors.error,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  documentCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  requiredBadge: {
    fontSize: 10,
    color: BrandColors.error,
    marginLeft: Spacing.xs,
    fontWeight: '600',
  },
  documentDescription: {
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
  vehicleTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  vehicleTypeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  vehicleTypeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  plateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  regionScroll: {
    flexGrow: 0,
  },
  regionButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  plateInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    width: 60,
    textAlign: 'center',
  },
  plateInputLarge: {
    width: 80,
  },
  letterButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  letterButton: {
    width: 32,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platePreview: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  verificationCard: {
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  verificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  termsText: {
    fontSize: 14,
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundTertiary,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  submitButtonText: {
    color: Colors.light.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
});
