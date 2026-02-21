import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Platform, Image, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { getToken } from '@/utils/secure-token-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, BrandColors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WebCalendar } from '@/components/WebCalendar';

type DriverLicenseSubmitScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

type LicenseType = '1종보통' | '2종보통';

interface DocumentData {
  id?: number;
  type: 'driverLicense';
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'not_submitted';
  imageUrl?: string;
  uploadedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  licenseNumber?: string;
  licenseType?: LicenseType;
  issueDate?: string;
  expiryDate?: string;
}

const LICENSE_TYPES: { id: LicenseType; label: string }[] = [
  { id: '1종보통', label: '1종보통' },
  { id: '2종보통', label: '2종보통' },
];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function DriverLicenseSubmitScreen({ navigation }: DriverLicenseSubmitScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseType, setLicenseType] = useState<LicenseType>('1종보통');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [showIssueDatePicker, setShowIssueDatePicker] = useState(false);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [datePickerTarget, setDatePickerTarget] = useState<'issue' | 'expiry'>('issue');

  const { data: document } = useQuery<DocumentData>({
    queryKey: ['/api/helpers/documents/driverLicense'],
  });

  React.useEffect(() => {
    if (document) {
      if (document.imageUrl) setSelectedImage(document.imageUrl);
      setLicenseNumber(document.licenseNumber || '');
      setLicenseType((document.licenseType as LicenseType) || '1종보통');
      setIssueDate(document.issueDate || '');
      setExpiryDate(document.expiryDate || '');
    }
  }, [document]);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) setSelectedImage(result.assets[0].uri);
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
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
      if (!result.canceled && result.assets[0]) setSelectedImage(result.assets[0].uri);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('오류', '카메라 실행에 실패했습니다');
    }
  };

  const openDatePicker = (target: 'issue' | 'expiry') => {
    setDatePickerTarget(target);
    const current = target === 'issue' ? (issueDate ? new Date(issueDate) : new Date()) : (expiryDate ? new Date(expiryDate) : new Date());
    setTempDate(current);
    setShowIssueDatePicker(target === 'issue');
    setShowExpiryDatePicker(target === 'expiry');
  };

  const handleDateSelect = (date: Date) => {
    const str = formatDate(date);
    if (datePickerTarget === 'issue') setIssueDate(str);
    else setExpiryDate(str);
    setShowIssueDatePicker(false);
    setShowExpiryDatePicker(false);
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      Alert.alert('알림', '운전면허증 이미지를 선택해주세요');
      return;
    }
    if (!licenseNumber.trim()) {
      Alert.alert('알림', '면허번호를 입력해주세요');
      return;
    }
    if (!issueDate || !expiryDate) {
      Alert.alert('알림', '발급일과 만료일을 선택해주세요');
      return;
    }

    setIsUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        formData.append('file', blob, 'driverLicense.jpg');
      } else {
        const uriParts = selectedImage.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        formData.append('file', { uri: selectedImage, name: `driverLicense.${fileType}`, type: `image/${fileType}` } as any);
      }

      formData.append('licenseNumber', licenseNumber);
      formData.append('licenseType', licenseType);
      formData.append('issueDate', issueDate);
      formData.append('expiryDate', expiryDate);

      const uploadResponse = await fetch(
        new URL('/api/helpers/documents/driverLicense', getApiUrl()).toString(),
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData }
      );

      if (uploadResponse.ok) {
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents/status'] });
        Alert.alert('완료', '운전면허증이 제출되었습니다', [{ text: '확인', onPress: () => navigation.goBack() }]);
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      {document && document.status !== 'not_submitted' && (
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            {document.status === 'approved' && (
              <>
                <Icon name="checkmark-circle" size={24} color="#10B981" />
                <ThemedText style={[styles.statusTitle, { color: '#10B981' }]}>승인완료</ThemedText>
              </>
            )}
            {document.status === 'reviewing' && (
              <>
                <Icon name="time-outline" size={24} color="#3B82F6" />
                <ThemedText style={[styles.statusTitle, { color: '#3B82F6' }]}>검토중</ThemedText>
              </>
            )}
            {document.status === 'rejected' && (
              <>
                <Icon name="close-circle" size={24} color="#EF4444" />
                <ThemedText style={[styles.statusTitle, { color: '#EF4444' }]}>반려됨</ThemedText>
              </>
            )}
          </View>
          {document.status === 'rejected' && document.rejectionReason && (
            <View style={[styles.rejectionBox, { backgroundColor: '#FEE2E2' }]}>
              <ThemedText style={[styles.rejectionLabel, { color: '#991B1B' }]}>반려 사유:</ThemedText>
              <ThemedText style={[styles.rejectionText, { color: '#991B1B' }]}>{document.rejectionReason}</ThemedText>
            </View>
          )}
          {document.status === 'approved' && (
            <ThemedText style={[styles.statusDescription, { color: theme.tabIconDefault }]}>
              서류가 승인되었습니다. 필요시 업데이트할 수 있습니다.
            </ThemedText>
          )}
        </Card>
      )}

      <Card style={styles.uploadCard}>
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>운전면허증 이미지</ThemedText>
        {selectedImage ? (
          <View style={styles.imagePreview}>
            <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
            <Pressable style={({ pressed }) => [styles.removeImageButton, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setSelectedImage(null)}>
              <Icon name="close-circle" size={28} color="#EF4444" />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.uploadPlaceholder, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
            <Icon name="cloud-upload-outline" size={48} color={theme.tabIconDefault} />
            <ThemedText style={[styles.uploadHint, { color: theme.tabIconDefault }]}>운전면허증을 촬영하거나 선택해주세요</ThemedText>
          </View>
        )}
        <View style={styles.uploadButtons}>
          <Pressable style={({ pressed }) => [styles.uploadButton, { backgroundColor: BrandColors.helperLight, opacity: pressed ? 0.7 : 1 }]} onPress={handlePickImage}>
            <Icon name="images-outline" size={20} color={BrandColors.helper} />
            <ThemedText style={[styles.uploadButtonText, { color: BrandColors.helper }]}>갤러리</ThemedText>
          </Pressable>
          {Platform.OS !== 'web' && (
            <Pressable style={({ pressed }) => [styles.uploadButton, { backgroundColor: BrandColors.helperLight, opacity: pressed ? 0.7 : 1 }]} onPress={handleTakePhoto}>
              <Icon name="camera-outline" size={20} color={BrandColors.helper} />
              <ThemedText style={[styles.uploadButtonText, { color: BrandColors.helper }]}>카메라</ThemedText>
            </Pressable>
          )}
        </View>
      </Card>

      <Card style={styles.infoCard}>
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>면허 정보</ThemedText>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>면허번호 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText></ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}
            placeholder="면허번호를 입력하세요"
            placeholderTextColor={theme.tabIconDefault}
            value={licenseNumber}
            onChangeText={setLicenseNumber}
          />
        </View>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>면허 종류 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText></ThemedText>
          <View style={styles.licenseTypeRow}>
            {LICENSE_TYPES.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.licenseTypeButton, { backgroundColor: licenseType === t.id ? BrandColors.helperLight : (isDark ? '#374151' : '#F3F4F6'), borderColor: licenseType === t.id ? BrandColors.helper : (isDark ? '#4B5563' : '#D1D5DB') }]}
                onPress={() => setLicenseType(t.id)}
              >
                <ThemedText style={{ color: licenseType === t.id ? BrandColors.helper : theme.text, fontWeight: '600' }}>{t.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>발급일 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText></ThemedText>
          <Pressable style={[styles.dateButton, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? '#4B5563' : '#D1D5DB' }]} onPress={() => openDatePicker('issue')}>
            <Icon name="calendar-outline" size={18} color={issueDate ? theme.text : theme.tabIconDefault} />
            <ThemedText style={{ color: issueDate ? theme.text : theme.tabIconDefault, marginLeft: Spacing.sm }}>{issueDate || '발급일 선택'}</ThemedText>
          </Pressable>
        </View>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>만료일 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText></ThemedText>
          <Pressable style={[styles.dateButton, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? '#4B5563' : '#D1D5DB' }]} onPress={() => openDatePicker('expiry')}>
            <Icon name="calendar-outline" size={18} color={expiryDate ? theme.text : theme.tabIconDefault} />
            <ThemedText style={{ color: expiryDate ? theme.text : theme.tabIconDefault, marginLeft: Spacing.sm }}>{expiryDate || '만료일 선택'}</ThemedText>
          </Pressable>
        </View>
      </Card>

      <Card style={[styles.guideCard, { backgroundColor: BrandColors.helperLight }]}>
        <View style={styles.guideHeader}>
          <Icon name="information-circle-outline" size={20} color={BrandColors.helper} />
          <ThemedText style={[styles.guideTitle, { color: BrandColors.helper }]}>제출 안내</ThemedText>
        </View>
        <ThemedText style={[styles.guideText, { color: theme.tabIconDefault }]}>
          • 1종보통 또는 2종보통 면허만 인정됩니다{'\n'}
          • 면허증 전체가 선명하게 보이도록 촬영해주세요{'\n'}
          • 서류 검토는 영업일 기준 1-2일 소요됩니다
        </ThemedText>
      </Card>

      {/* 제출 버튼 */}
      <Pressable
        style={({ pressed }) => [styles.submitButton, { backgroundColor: BrandColors.helper, opacity: (pressed || isUploading || !canResubmit) ? 0.7 : 1 }]}
        onPress={handleSubmit}
        disabled={isUploading || !canResubmit}
      >
        {isUploading ? <ActivityIndicator color="#fff" /> : (
          <>
            <Icon name="checkmark-circle-outline" size={20} color="#fff" />
            <ThemedText style={styles.submitButtonText}>{document?.status === 'rejected' ? '재제출하기' : '제출하기'}</ThemedText>
          </>
        )}
      </Pressable>

      {Platform.OS === 'web' && (showIssueDatePicker || showExpiryDatePicker) && (
        <WebCalendar visible onClose={() => { setShowIssueDatePicker(false); setShowExpiryDatePicker(false); }} onSelect={handleDateSelect} selectedDate={tempDate} title={datePickerTarget === 'issue' ? '발급일 선택' : '만료일 선택'} />
      )}
      {Platform.OS !== 'web' && (showIssueDatePicker || showExpiryDatePicker) && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="fade">
            <Pressable style={styles.datePickerOverlay} onPress={() => { setShowIssueDatePicker(false); setShowExpiryDatePicker(false); }}>
              <View style={[styles.datePickerContainer, { backgroundColor: theme.backgroundRoot }]}>
                <View style={styles.datePickerHeader}>
                  <ThemedText style={[styles.datePickerTitle, { color: theme.text }]}>{datePickerTarget === 'issue' ? '발급일 선택' : '만료일 선택'}</ThemedText>
                  <Pressable onPress={() => { setShowIssueDatePicker(false); setShowExpiryDatePicker(false); }}>
                    <ThemedText style={{ color: BrandColors.helper, fontWeight: '600' }}>완료</ThemedText>
                  </Pressable>
                </View>
                <DateTimePicker value={tempDate} mode="date" display="spinner" onChange={(_, d) => d && handleDateSelect(d)} locale="ko" />
              </View>
            </Pressable>
          </Modal>
        ) : (
          <DateTimePicker value={tempDate} mode="date" display="default" onChange={(_, d) => { if (d) handleDateSelect(d); setShowIssueDatePicker(false); setShowExpiryDatePicker(false); }} />
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statusCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  statusTitle: { fontSize: 18, fontWeight: '600' },
  statusDescription: { fontSize: 14, marginTop: Spacing.sm },
  rejectionBox: { padding: Spacing.md, borderRadius: BorderRadius.sm, marginTop: Spacing.sm },
  rejectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  rejectionText: { fontSize: 14 },
  uploadCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: Spacing.md },
  imagePreview: { position: 'relative', width: '100%', height: 250, borderRadius: BorderRadius.md, overflow: 'hidden', marginBottom: Spacing.md },
  previewImage: { width: '100%', height: '100%' },
  removeImageButton: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: BorderRadius.full },
  uploadPlaceholder: { height: 200, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  uploadHint: { fontSize: 14, marginTop: Spacing.md, textAlign: 'center' },
  uploadButtons: { flexDirection: 'row', gap: Spacing.md },
  uploadButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.sm },
  uploadButtonText: { fontSize: 14, fontWeight: '600' },
  infoCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  inputGroup: { marginBottom: Spacing.lg },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: Spacing.sm },
  input: { padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1, fontSize: 15 },
  licenseTypeRow: { flexDirection: 'row', gap: Spacing.md },
  licenseTypeButton: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center' },
  dateButton: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1 },
  guideCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  guideTitle: { fontSize: 14, fontWeight: '600' },
  guideText: { fontSize: 13, lineHeight: 20 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.md },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  datePickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  datePickerContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg },
  datePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  datePickerTitle: { fontSize: 18, fontWeight: '600' },
});
