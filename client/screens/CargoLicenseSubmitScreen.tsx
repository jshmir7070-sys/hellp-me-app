import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Platform, Image, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
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

type CargoLicenseSubmitScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface DocumentData {
  id?: number;
  type: 'cargoLicense';
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'not_submitted';
  imageUrl?: string;
  uploadedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  licenseNumber?: string;
  issueDate?: string;
}

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function CargoLicenseSubmitScreen({ navigation }: CargoLicenseSubmitScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const { data: document } = useQuery<DocumentData>({
    queryKey: ['/api/helpers/documents/cargoLicense'],
  });

  React.useEffect(() => {
    if (document) {
      if (document.imageUrl) setSelectedImage(document.imageUrl);
      setLicenseNumber(document.licenseNumber || '');
      setIssueDate(document.issueDate || '');
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

  const openDatePicker = () => {
    setTempDate(issueDate ? new Date(issueDate) : new Date());
    setShowDatePicker(true);
  };

  const handleDateSelect = (date: Date) => {
    setIssueDate(formatDate(date));
    setShowDatePicker(false);
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      Alert.alert('알림', '화물운송종사자격증 이미지를 선택해주세요');
      return;
    }
    if (!licenseNumber.trim()) {
      Alert.alert('알림', '자격증 번호를 입력해주세요');
      return;
    }
    if (!issueDate) {
      Alert.alert('알림', '발급일을 선택해주세요');
      return;
    }

    setIsUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        formData.append('file', blob, 'cargoLicense.jpg');
      } else {
        const uriParts = selectedImage.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        formData.append('file', { uri: selectedImage, name: `cargoLicense.${fileType}`, type: `image/${fileType}` } as any);
      }

      formData.append('licenseNumber', licenseNumber);
      formData.append('issueDate', issueDate);

      const uploadResponse = await fetch(
        new URL('/api/helpers/documents/cargoLicense', getApiUrl()).toString(),
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData }
      );

      if (uploadResponse.ok) {
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents/status'] });
        Alert.alert('완료', '저장되었습니다.', [{ text: '확인', onPress: () => navigation.goBack() }]);
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

  const canResubmit = true; // 승인 후에도 수정 가능
  const isReadOnly = document?.status === 'reviewing'; // 검토중일 때만 읽기전용

  // 이미지 URL 처리 (상대 경로면 전체 URL로 변환)
  const displayImageUrl = React.useMemo(() => {
    if (!selectedImage) return null;
    if (selectedImage.startsWith('http') || selectedImage.startsWith('file://')) {
      return selectedImage;
    }
    return `${getApiUrl()}${selectedImage}`;
  }, [selectedImage]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl + 60,
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
        <View style={styles.cardTitleRow}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>화물운송종사자격증 이미지</ThemedText>
          <View style={[styles.optionalBadge, { backgroundColor: '#DBEAFE' }]}>
            <ThemedText style={[styles.optionalBadgeText, { color: '#3B82F6' }]}>선택</ThemedText>
          </View>
        </View>
        {selectedImage ? (
          <View style={styles.imagePreview}>
            <Image source={{ uri: displayImageUrl || selectedImage }} style={styles.previewImage} resizeMode="contain" />
            {!isReadOnly && (
              <Pressable style={({ pressed }) => [styles.removeImageButton, { opacity: pressed ? 0.7 : 1 }]} onPress={() => setSelectedImage(null)}>
                <Icon name="close-circle" size={28} color="#EF4444" />
              </Pressable>
            )}
          </View>
        ) : (
          <View style={[styles.uploadPlaceholder, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
            <Icon name="cloud-upload-outline" size={48} color={theme.tabIconDefault} />
            <ThemedText style={[styles.uploadHint, { color: theme.tabIconDefault }]}>화물운송종사자격증을 촬영하거나 선택해주세요</ThemedText>
          </View>
        )}
        {!isReadOnly && (
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
        )}
      </Card>

      <Card style={styles.infoCard}>
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>자격증 정보</ThemedText>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>자격증 번호 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText></ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: isReadOnly ? (isDark ? '#1F2937' : '#F9FAFB') : theme.backgroundDefault, color: theme.text, borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}
            placeholder="자격증 번호를 입력하세요"
            placeholderTextColor={theme.tabIconDefault}
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            editable={!isReadOnly}
          />
        </View>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>발급일 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText></ThemedText>
          <Pressable
            style={[styles.dateButton, { backgroundColor: isReadOnly ? (isDark ? '#1F2937' : '#F9FAFB') : theme.backgroundDefault, borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}
            onPress={() => !isReadOnly && openDatePicker()}
            disabled={isReadOnly}
          >
            <Icon name="calendar-outline" size={18} color={issueDate ? theme.text : theme.tabIconDefault} />
            <ThemedText style={{ color: issueDate ? theme.text : theme.tabIconDefault, marginLeft: Spacing.sm }}>{issueDate || '발급일 선택'}</ThemedText>
          </Pressable>
        </View>
      </Card>

      <Card style={[styles.guideCard, { backgroundColor: BrandColors.helperLight }]}>
        <View style={styles.guideHeader}>
          <Icon name="information-circle-outline" size={20} color={BrandColors.helper} />
          <ThemedText style={[styles.guideTitle, { color: BrandColors.helper }]}>제출 안내</ThemedText>
        </View>
        <ThemedText style={[styles.guideText, { color: theme.tabIconDefault }]}>
          • 화물자동차 운송사업 종사자격증을 제출해주세요{'\n'}
          • 자격증 전체가 선명하게 보이도록 촬영해주세요{'\n'}
          • 이 서류는 선택 제출 항목입니다
        </ThemedText>
      </Card>

      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          {
            backgroundColor: isReadOnly ? (isDark ? '#374151' : '#E5E7EB') : BrandColors.helper,
            opacity: (pressed || isUploading) ? 0.7 : 1
          }
        ]}
        onPress={isReadOnly ? () => navigation.goBack() : handleSubmit}
        disabled={isUploading}
      >
        {isUploading ? <ActivityIndicator color="#fff" /> : (
          <>
            <Icon name={isReadOnly ? "checkmark-outline" : "checkmark-circle-outline"} size={20} color={isReadOnly ? theme.text : "#fff"} />
            <ThemedText style={[styles.submitButtonText, { color: isReadOnly ? theme.text : '#fff' }]}>
              {isReadOnly ? '확인' : document?.status === 'rejected' ? '재제출하기' : document?.status === 'approved' ? '수정하기' : '제출하기'}
            </ThemedText>
          </>
        )}
      </Pressable>

      {Platform.OS === 'web' && showDatePicker && (
        <WebCalendar visible onClose={() => setShowDatePicker(false)} onSelect={handleDateSelect} selectedDate={tempDate} title="발급일 선택" />
      )}
      {Platform.OS !== 'web' && showDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="fade">
            <Pressable style={styles.datePickerOverlay} onPress={() => setShowDatePicker(false)}>
              <View style={[styles.datePickerContainer, { backgroundColor: theme.backgroundRoot }]}>
                <View style={styles.datePickerHeader}>
                  <ThemedText style={[styles.datePickerTitle, { color: theme.text }]}>발급일 선택</ThemedText>
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <ThemedText style={{ color: BrandColors.helper, fontWeight: '600' }}>완료</ThemedText>
                  </Pressable>
                </View>
                <DateTimePicker value={tempDate} mode="date" display="spinner" onChange={(_, d) => d && handleDateSelect(d)} locale="ko" />
              </View>
            </Pressable>
          </Modal>
        ) : (
          <DateTimePicker value={tempDate} mode="date" display="default" onChange={(_, d) => { if (d) handleDateSelect(d); setShowDatePicker(false); }} />
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
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  optionalBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.xs },
  optionalBadgeText: { fontSize: 10, fontWeight: '600' },
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
