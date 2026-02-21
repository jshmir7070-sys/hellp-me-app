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
import { Spacing, BorderRadius, BrandColors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type VehicleCertSubmitScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

type VehicleType = '1톤하이탑' | '1톤정탑' | '1톤저탑' | '1톤냉탑' | '쓰리밴';

interface DocumentData {
  id?: number;
  type: 'vehicleCert';
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'not_submitted';
  imageUrl?: string;
  uploadedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  plateNumber?: string;
  vehicleType?: VehicleType;
  vehicleOwnerName?: string;
}

const VEHICLE_TYPES: { id: VehicleType; label: string }[] = [
  { id: '1톤하이탑', label: '1톤 하이탑' },
  { id: '1톤정탑', label: '1톤 정탑' },
  { id: '1톤저탑', label: '1톤 저탑' },
  { id: '1톤냉탑', label: '1톤 냉탑' },
  { id: '쓰리밴', label: '쓰리밴' },
];

export default function VehicleCertSubmitScreen({ navigation }: VehicleCertSubmitScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('1톤하이탑');
  const [vehicleOwnerName, setVehicleOwnerName] = useState('');

  const { data: document } = useQuery<DocumentData>({
    queryKey: ['/api/helpers/documents/vehicleCert'],
  });

  React.useEffect(() => {
    if (document) {
      if (document.imageUrl) setSelectedImage(document.imageUrl);
      setVehicleType((document.vehicleType as VehicleType) || '1톤하이탑');
      setVehicleOwnerName(document.vehicleOwnerName || '');
      setPlateNumber(document.plateNumber || '');
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

  const handleSubmit = async () => {
    if (!selectedImage) {
      Alert.alert('알림', '차량등록증 이미지를 선택해주세요');
      return;
    }
    if (!plateNumber.trim()) {
      Alert.alert('알림', '차량번호를 입력해주세요 (예: 서울 12가 3456)');
      return;
    }
    if (!vehicleOwnerName.trim()) {
      Alert.alert('알림', '차량 소유자명을 입력해주세요');
      return;
    }

    setIsUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(selectedImage);
        const blob = await response.blob();
        formData.append('file', blob, 'vehicleCert.jpg');
      } else {
        const uriParts = selectedImage.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        formData.append('file', { uri: selectedImage, name: `vehicleCert.${fileType}`, type: `image/${fileType}` } as any);
      }

      formData.append('plateNumber', plateNumber.trim());
      formData.append('vehicleType', vehicleType);
      formData.append('vehicleOwnerName', vehicleOwnerName);

      const uploadResponse = await fetch(
        new URL('/api/helpers/documents/vehicleCert', getApiUrl()).toString(),
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData }
      );

      if (uploadResponse.ok) {
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents/status'] });
        Alert.alert('완료', '차량등록증이 제출되었습니다', [{ text: '확인', onPress: () => navigation.goBack() }]);
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
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>차량등록증 이미지</ThemedText>
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
            <ThemedText style={[styles.uploadHint, { color: theme.tabIconDefault }]}>차량등록증을 촬영하거나 선택해주세요</ThemedText>
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
        <ThemedText style={[styles.cardTitle, { color: theme.text }]}>차량 정보</ThemedText>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>차량번호 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText></ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}
            placeholder="서울 12가 3456"
            placeholderTextColor={theme.tabIconDefault}
            value={plateNumber}
            onChangeText={setPlateNumber}
          />
          <ThemedText style={[styles.plateHint, { color: theme.tabIconDefault }]}>지역 + 번호 형식 (예: 서울 12가 3456)</ThemedText>
        </View>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>차량 종류 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText></ThemedText>
          <View style={styles.vehicleTypeGrid}>
            {VEHICLE_TYPES.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.vehicleTypeButton, { backgroundColor: vehicleType === t.id ? BrandColors.helperLight : (isDark ? '#374151' : '#F3F4F6'), borderColor: vehicleType === t.id ? BrandColors.helper : (isDark ? '#4B5563' : '#D1D5DB') }]}
                onPress={() => setVehicleType(t.id)}
              >
                <ThemedText style={{ color: vehicleType === t.id ? BrandColors.helper : theme.text, fontWeight: '600', fontSize: 13 }}>{t.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>차량 소유자명 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText></ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? '#4B5563' : '#D1D5DB' }]}
            placeholder="차량 소유자명을 입력하세요"
            placeholderTextColor={theme.tabIconDefault}
            value={vehicleOwnerName}
            onChangeText={setVehicleOwnerName}
          />
        </View>
      </Card>

      <Card style={[styles.guideCard, { backgroundColor: BrandColors.helperLight }]}>
        <View style={styles.guideHeader}>
          <Icon name="information-circle-outline" size={20} color={BrandColors.helper} />
          <ThemedText style={[styles.guideTitle, { color: BrandColors.helper }]}>제출 안내</ThemedText>
        </View>
        <ThemedText style={[styles.guideText, { color: theme.tabIconDefault }]}>
          • 차량등록증 전체가 선명하게 보이도록 촬영해주세요{'\n'}
          • 차량번호는 지역+번호+한글+숫자 형식입니다 (예: 서울 12가 3456){'\n'}
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
  plateHint: { fontSize: 12, marginTop: Spacing.sm },
  vehicleTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  vehicleTypeButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1 },
  guideCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  guideTitle: { fontSize: 14, fontWeight: '600' },
  guideText: { fontSize: 13, lineHeight: 20 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: BorderRadius.md },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
