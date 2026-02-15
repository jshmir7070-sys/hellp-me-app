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

type TransportContractSubmitScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface DocumentData {
  id?: number;
  type: 'transportContract';
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'not_submitted';
  imageUrl?: string;
  uploadedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  contractCompanyName?: string;
  contractDate?: string;
}

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function TransportContractSubmitScreen({ navigation }: TransportContractSubmitScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [contractCompanyName, setContractCompanyName] = useState('');
  const [contractDate, setContractDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const { data: document } = useQuery<DocumentData>({
    queryKey: ['/api/helpers/documents/transportContract'],
  });

  React.useEffect(() => {
    if (document) {
      if (document.imageUrl) setSelectedImage(document.imageUrl);
      setContractCompanyName(document.contractCompanyName || '');
      setContractDate(document.contractDate || '');
    }
  }, [document]);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
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
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]) setSelectedImage(result.assets[0].uri);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('오류', '카메라 실행에 실패했습니다');
    }
  };

  const openDatePicker = () => {
    setTempDate(contractDate ? new Date(contractDate) : new Date());
    setShowDatePicker(true);
  };

  const handleDateSelect = (date: Date) => {
    setContractDate(formatDate(date));
    setShowDatePicker(false);
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      Alert.alert('알림', '용달계약서 이미지를 선택해주세요');
      return;
    }
    if (!contractCompanyName.trim()) {
      Alert.alert('알림', '계약 회사명을 입력해주세요');
      return;
    }
    if (!contractDate) {
      Alert.alert('알림', '계약일을 선택해주세요');
      return;
    }

    setIsUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        formData.append('file', blob, 'transportContract.jpg');
      } else {
        const uriParts = selectedImage.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        formData.append('file', { uri: selectedImage, name: `transportContract.${fileType}`, type: `image/${fileType}` } as any);
      }

      formData.append('contractCompanyName', contractCompanyName);
      formData.append('contractDate', contractDate);

      const uploadResponse = await fetch(
        new URL('/api/helpers/documents/transportContract', getApiUrl()).toString(),
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData }
      );

      if (uploadResponse.ok) {
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents/status'] });
        Alert.alert('완료', '용달계약서가 제출되었습니다', [{ text: '확인', onPress: () => navigation.goBack() }]);
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
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
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
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>용달계약서 이미지</ThemedText>
          <View style={[styles.optionalBadge, { backgroundColor: '#DBEAFE' }]}>
            <ThemedText style={[styles.optionalBadgeText, { color: '#3B82F6' }]}>선택</ThemedText>
          </View>
        </View>
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
            <ThemedText style={[styles.uploadHint, { color: theme.tabIconDefault }]}>용달계약서를 촬영하거나 선택해주세요</ThemedText>
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
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>계약 정보</ThemedText>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>계약 회사명 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText></ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}
            placeholder="운송사업 위수탁 계약 회사명"
            placeholderTextColor={theme.tabIconDefault}
            value={contractCompanyName}
            onChangeText={setContractCompanyName}
          />
        </View>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>계약일 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText></ThemedText>
          <Pressable style={[styles.dateButton, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? '#4B5563' : '#D1D5DB' }]} onPress={openDatePicker}>
            <Icon name="calendar-outline" size={18} color={contractDate ? theme.text : theme.tabIconDefault} />
            <ThemedText style={{ color: contractDate ? theme.text : theme.tabIconDefault, marginLeft: Spacing.sm }}>{contractDate || '계약일 선택'}</ThemedText>
          </Pressable>
        </View>
      </Card>

      <Card style={[styles.guideCard, { backgroundColor: BrandColors.helperLight }]}>
        <View style={styles.guideHeader}>
          <Icon name="information-circle-outline" size={20} color={BrandColors.helper} />
          <ThemedText style={[styles.guideTitle, { color: BrandColors.helper }]}>제출 안내</ThemedText>
        </View>
        <ThemedText style={[styles.guideText, { color: theme.tabIconDefault }]}>
          • 운송사업 위수탁 계약서를 제출해주세요{'\n'}
          • 계약서 전체가 선명하게 보이도록 촬영해주세요{'\n'}
          • 이 서류는 선택 제출 항목입니다
        </ThemedText>
      </Card>

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

      {Platform.OS === 'web' && showDatePicker && (
        <WebCalendar visible onClose={() => setShowDatePicker(false)} onSelect={handleDateSelect} selectedDate={tempDate} title="계약일 선택" />
      )}
      {Platform.OS !== 'web' && showDatePicker && (
        Platform.OS === 'ios' ? (
          <Modal visible transparent animationType="fade">
            <Pressable style={styles.datePickerOverlay} onPress={() => setShowDatePicker(false)}>
              <View style={[styles.datePickerContainer, { backgroundColor: theme.backgroundRoot }]}>
                <View style={styles.datePickerHeader}>
                  <ThemedText style={[styles.datePickerTitle, { color: theme.text }]}>계약일 선택</ThemedText>
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
