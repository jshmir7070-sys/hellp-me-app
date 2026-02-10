import React, { useState } from "react";
import { View, StyleSheet, Alert, Platform, TextInput, ScrollView, Pressable, ActivityIndicator, Image, Dimensions, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { Icon } from "@/components/Icon";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/query-client";

const { width: screenWidth } = Dimensions.get('window');

type IncidentType = 'damage' | 'loss' | 'misdelivery' | 'delay' | 'other';

const INCIDENT_TYPES: { value: IncidentType; label: string; icon: string }[] = [
  { value: 'damage', label: '파손', icon: 'alert-outline' },
  { value: 'loss', label: '분실', icon: 'close-circle-outline' },
  { value: 'misdelivery', label: '오배송', icon: 'map-marker-outline' },
  { value: 'delay', label: '지연', icon: 'clock-outline' },
  { value: 'other', label: '기타', icon: 'help-circle-outline' },
];

type IncidentReportScreenProps = NativeStackScreenProps<any, 'IncidentReport'>;

export default function IncidentReportScreen({ route, navigation }: IncidentReportScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const { orderId } = route.params || {};

  const [incidentType, setIncidentType] = useState<IncidentType | null>(null);
  const [description, setDescription] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: orderDetail, isLoading: isLoadingOrder } = useQuery<any>({
    queryKey: [`/api/requester/orders/${orderId}`],
    enabled: !!orderId,
  });

  const { data: closingSummary } = useQuery<{
    deliveryHistoryImages: string[];
    etcImages: string[];
  }>({
    queryKey: [`/api/orders/${orderId}/closing-summary`],
    enabled: !!orderId,
  });

  const getImageUrl = (imagePath: string) => {
    if (imagePath.startsWith('http')) return imagePath;
    return new URL(imagePath, getApiUrl()).toString();
  };

  const pickImage = async () => {
    if (evidencePhotos.length >= 5) {
      Alert.alert("알림", "사진은 최대 5장까지 첨부할 수 있습니다.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      try {
        const formData = new FormData();
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop() || 'photo.jpg';
        
        formData.append('file', {
          uri,
          name: filename,
          type: 'image/jpeg',
        } as any);

        const token = await getAuthToken();
        const response = await fetch(`${getApiUrl()}/api/upload/evidence`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setEvidencePhotos(prev => [...prev, data.url]);
        } else {
          Alert.alert("오류", "사진 업로드에 실패했습니다.");
        }
      } catch (err) {
        console.error("Upload error:", err);
        Alert.alert("오류", "사진 업로드 중 오류가 발생했습니다.");
      } finally {
        setUploading(false);
      }
    }
  };

  const removePhoto = (index: number) => {
    setEvidencePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const allImages = [
        ...(closingSummary?.deliveryHistoryImages || []),
        ...evidencePhotos,
      ];
      const res = await apiRequest('POST', `/api/orders/${orderId}/incident`, {
        type: incidentType,
        description,
        additionalInfo: additionalInfo || undefined,
        trackingNumber: trackingNumber.trim(),
        deliveryAddress: deliveryAddress.trim(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        attachedImages: allImages,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/requester/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/incidents'] });
      if (Platform.OS === 'web') {
        alert('화물사고가 접수되었습니다.');
      } else {
        Alert.alert('접수 완료', '화물사고가 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.');
      }
      navigation.goBack();
    },
    onError: (err: any) => {
      if (Platform.OS === 'web') {
        alert(err.message || '접수에 실패했습니다.');
      } else {
        Alert.alert('오류', err.message || '접수에 실패했습니다.');
      }
    },
  });

  const handleSubmit = () => {
    if (!incidentType) {
      if (Platform.OS === 'web') {
        alert('사고 유형을 선택해주세요.');
      } else {
        Alert.alert('입력 오류', '사고 유형을 선택해주세요.');
      }
      return;
    }

    if (description.trim().length < 10) {
      if (Platform.OS === 'web') {
        alert('사고 내용을 10자 이상 입력해주세요.');
      } else {
        Alert.alert('입력 오류', '사고 내용을 10자 이상 입력해주세요.');
      }
      return;
    }

    if (!trackingNumber.trim()) {
      if (Platform.OS === 'web') {
        alert('송장번호를 입력해주세요.');
      } else {
        Alert.alert('입력 오류', '송장번호를 입력해주세요.');
      }
      return;
    }

    if (!deliveryAddress.trim()) {
      if (Platform.OS === 'web') {
        alert('배송지 주소를 입력해주세요.');
      } else {
        Alert.alert('입력 오류', '배송지 주소를 입력해주세요.');
      }
      return;
    }

    if (!customerName.trim()) {
      if (Platform.OS === 'web') {
        alert('수하인 이름을 입력해주세요.');
      } else {
        Alert.alert('입력 오류', '수하인 이름을 입력해주세요.');
      }
      return;
    }

    if (!customerPhone.trim()) {
      if (Platform.OS === 'web') {
        alert('수하인 연락처를 입력해주세요.');
      } else {
        Alert.alert('입력 오류', '수하인 연락처를 입력해주세요.');
      }
      return;
    }

    if (Platform.OS === 'web') {
      if (confirm('화물사고를 접수하시겠습니까?')) {
        submitMutation.mutate();
      }
    } else {
      Alert.alert(
        '사고 접수',
        '화물사고를 접수하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '접수', onPress: () => submitMutation.mutate() },
        ]
      );
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg + 94,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <Card variant="glass" padding="lg" style={styles.orderSummary}>
        <View style={styles.orderHeader}>
          <View style={styles.orderNumberBadge}>
            <ThemedText style={styles.orderNumberText}>
              {orderDetail?.orderNumber || `O-${orderId}`}
            </ThemedText>
          </View>
          <ThemedText style={[styles.orderLabel, { color: theme.tabIconDefault }]}>
            관련 오더
          </ThemedText>
        </View>
        {isLoadingOrder ? (
          <ActivityIndicator size="small" color={BrandColors.requester} style={{ marginVertical: Spacing.md }} />
        ) : (
          <View style={styles.orderDetails}>
            <View style={styles.orderInfoRow}>
              <ThemedText style={[styles.orderInfoLabel, { color: theme.tabIconDefault }]}>운송사</ThemedText>
              <ThemedText style={[styles.orderInfoValue, { color: theme.text }]}>{orderDetail?.courierCompany || '-'}</ThemedText>
            </View>
            <View style={styles.orderInfoRow}>
              <ThemedText style={[styles.orderInfoLabel, { color: theme.tabIconDefault }]}>배송지역</ThemedText>
              <ThemedText style={[styles.orderInfoValue, { color: theme.text }]} numberOfLines={1}>{orderDetail?.deliveryArea || '-'}</ThemedText>
            </View>
            <View style={styles.orderInfoRow}>
              <ThemedText style={[styles.orderInfoLabel, { color: theme.tabIconDefault }]}>오더번호</ThemedText>
              <ThemedText style={[styles.orderInfoValue, { color: theme.text }]}>O-{orderId}</ThemedText>
            </View>
            <View style={styles.orderInfoRow}>
              <ThemedText style={[styles.orderInfoLabel, { color: theme.tabIconDefault }]}>배송일</ThemedText>
              <ThemedText style={[styles.orderInfoValue, { color: theme.text }]}>
                {orderDetail?.scheduledDate 
                  ? new Date(orderDetail.scheduledDate).toLocaleDateString('ko-KR')
                  : '-'}
              </ThemedText>
            </View>
            <View style={styles.orderInfoRow}>
              <ThemedText style={[styles.orderInfoLabel, { color: theme.tabIconDefault }]}>수행헬퍼</ThemedText>
              <ThemedText style={[styles.orderInfoValue, { color: theme.text }]}>{orderDetail?.helperName || '-'}</ThemedText>
            </View>
          </View>
        )}
      </Card>

      <Card variant="glass" padding="lg" style={styles.typeCard}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          사고 유형 (필수)
        </ThemedText>
        <View style={styles.typeGrid}>
          {INCIDENT_TYPES.map((type) => (
            <Pressable
              key={type.value}
              style={[
                styles.typeItem,
                {
                  backgroundColor: incidentType === type.value 
                    ? BrandColors.requester 
                    : theme.backgroundDefault,
                  borderColor: incidentType === type.value 
                    ? BrandColors.requester 
                    : theme.tabIconDefault,
                },
              ]}
              onPress={() => setIncidentType(type.value)}
            >
              <Icon 
                name={type.icon as any} 
                size={20} 
                color={incidentType === type.value ? Colors.light.buttonText : theme.text} 
              />
              <ThemedText 
                style={[
                  styles.typeLabel, 
                  { color: incidentType === type.value ? Colors.light.buttonText : theme.text }
                ]}
              >
                {type.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card variant="glass" padding="lg" style={styles.inputCard}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          사고 내용 (필수)
        </ThemedText>
        <ThemedText style={[styles.inputHint, { color: theme.tabIconDefault }]}>
          사고 상황을 상세히 설명해주세요. (최소 10자)
        </ThemedText>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: description.length >= 10 ? BrandColors.requester : theme.tabIconDefault,
            },
          ]}
          placeholder="예: 배송 중 박스 3개가 파손되었습니다. 물품은 전자제품으로..."
          placeholderTextColor={theme.tabIconDefault}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
        />
        <View style={styles.charCount}>
          <ThemedText style={[styles.charCountText, { color: theme.tabIconDefault }]}>
            {description.length}/2000자
          </ThemedText>
        </View>
      </Card>

      <Card variant="glass" padding="lg" style={styles.inputCard}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          추가 정보 (선택)
        </ThemedText>
        <ThemedText style={[styles.inputHint, { color: theme.tabIconDefault }]}>
          예상 피해 금액, 박스 수, 연락처 등
        </ThemedText>
        <TextInput
          style={[
            styles.smallInput,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: theme.tabIconDefault,
            },
          ]}
          placeholder="예: 피해 금액 약 50만원, 파손 박스 3개"
          placeholderTextColor={theme.tabIconDefault}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          value={additionalInfo}
          onChangeText={setAdditionalInfo}
          maxLength={500}
        />
      </Card>

      <Card variant="glass" padding="lg" style={styles.inputCard}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          송장번호 (필수)
        </ThemedText>
        <TextInput
          style={[
            styles.singleLineInput,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: trackingNumber.trim() ? BrandColors.requester : theme.tabIconDefault,
            },
          ]}
          placeholder="송장번호를 입력해주세요"
          placeholderTextColor={theme.tabIconDefault}
          value={trackingNumber}
          onChangeText={setTrackingNumber}
          maxLength={50}
        />
      </Card>

      <Card variant="glass" padding="lg" style={styles.inputCard}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          배송지 주소 (필수)
        </ThemedText>
        <TextInput
          style={[
            styles.smallInput,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: deliveryAddress.trim() ? BrandColors.requester : theme.tabIconDefault,
            },
          ]}
          placeholder="사고가 발생한 배송지 주소를 입력해주세요"
          placeholderTextColor={theme.tabIconDefault}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
          value={deliveryAddress}
          onChangeText={setDeliveryAddress}
          maxLength={200}
        />
      </Card>

      <Card variant="glass" padding="lg" style={styles.inputCard}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          수하인 정보 (필수)
        </ThemedText>
        <ThemedText style={[styles.inputHint, { color: theme.tabIconDefault }]}>
          피해 물품을 받을 고객 정보
        </ThemedText>
        <View style={styles.customerInfoRow}>
          <View style={styles.customerNameInput}>
            <TextInput
              style={[
                styles.singleLineInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: customerName.trim() ? BrandColors.requester : theme.tabIconDefault,
                },
              ]}
              placeholder="수하인 이름"
              placeholderTextColor={theme.tabIconDefault}
              value={customerName}
              onChangeText={setCustomerName}
              maxLength={50}
            />
          </View>
          <View style={styles.customerPhoneInput}>
            <TextInput
              style={[
                styles.singleLineInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: customerPhone.trim() ? BrandColors.requester : theme.tabIconDefault,
                },
              ]}
              placeholder="연락처"
              placeholderTextColor={theme.tabIconDefault}
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
              maxLength={20}
            />
          </View>
        </View>
      </Card>

      <Card variant="glass" padding="lg" style={styles.inputCard}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          증빙 사진 (선택, 최대 5장)
        </ThemedText>
        <View style={styles.photoGrid}>
          {evidencePhotos.map((url, index) => (
            <View key={index} style={styles.photoContainer}>
              <Pressable onPress={() => setSelectedImage(getImageUrl(url))}>
                <Image source={{ uri: getImageUrl(url) }} style={styles.photoThumbnail} />
              </Pressable>
              <Pressable
                style={styles.removePhotoButton}
                onPress={() => removePhoto(index)}
              >
                <Icon name="close-circle" size={22} color="BrandColors.error" />
              </Pressable>
            </View>
          ))}
          {evidencePhotos.length < 5 ? (
            <Pressable
              style={[styles.addPhotoButton, { borderColor: theme.tabIconDefault }]}
              onPress={pickImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={BrandColors.error} />
              ) : (
                <>
                  <Icon name="camera-outline" size={28} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.addPhotoText, { color: theme.tabIconDefault }]}>
                    사진 추가
                  </ThemedText>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      </Card>

      {(closingSummary?.deliveryHistoryImages?.length ?? 0) > 0 ? (
        <Card variant="glass" padding="lg" style={styles.inputCard}>
          <View style={styles.attachmentHeader}>
            <Icon name="paperclip" size={16} color={BrandColors.helper} />
            <ThemedText style={[styles.sectionTitle, { color: theme.text, marginBottom: 0, marginLeft: Spacing.xs }]}>
              자동 첨부 이미지
            </ThemedText>
          </View>
          <ThemedText style={[styles.inputHint, { color: theme.tabIconDefault }]}>
            마감 시 제출된 집배송 이력 이미지가 사고 접수에 자동으로 첨부됩니다.
          </ThemedText>
          <View style={styles.imageGrid}>
            {closingSummary?.deliveryHistoryImages?.map((image, index) => (
              <Pressable
                key={index}
                style={styles.imageWrapper}
                onPress={() => setSelectedImage(getImageUrl(image))}
              >
                <Image
                  source={{ uri: getImageUrl(image) }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
                <View style={[styles.imageBadge, { backgroundColor: BrandColors.helper }]}>
                  <Icon name="checkmark-outline" size={10} color={Colors.light.buttonText} />
                </View>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      <Pressable
        style={[
          styles.submitButton,
          {
            backgroundColor: (incidentType && description.length >= 10 && trackingNumber.trim() && deliveryAddress.trim() && customerName.trim() && customerPhone.trim()) 
              ? BrandColors.error 
              : theme.tabIconDefault,
            opacity: submitMutation.isPending ? 0.7 : 1,
          },
        ]}
        onPress={handleSubmit}
        disabled={submitMutation.isPending || !incidentType || description.length < 10 || !trackingNumber.trim() || !deliveryAddress.trim() || !customerName.trim() || !customerPhone.trim()}
      >
        {submitMutation.isPending ? (
          <ActivityIndicator color={Colors.light.buttonText} />
        ) : (
          <>
            <Icon name="warning-outline" size={20} color={Colors.light.buttonText} style={{ marginRight: 8 }} />
            <ThemedText style={styles.submitButtonText}>화물사고 접수</ThemedText>
          </>
        )}
      </Pressable>

      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setSelectedImage(null)}
        >
          <View style={styles.modalContent}>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
            <Pressable
              style={styles.closeButton}
              onPress={() => setSelectedImage(null)}
            >
              <Icon name="close-outline" size={24} color="#fff" />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  orderSummary: {
    marginBottom: Spacing.lg,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  orderNumberBadge: {
    backgroundColor: BrandColors.requester,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  orderNumberText: {
    ...Typography.small,
    color: Colors.light.buttonText,
    fontWeight: '600',
  },
  orderLabel: {
    ...Typography.small,
  },
  orderTitle: {
    ...Typography.h4,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  orderDetails: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  orderInfoLabel: {
    ...Typography.small,
    minWidth: 70,
  },
  orderInfoValue: {
    ...Typography.small,
    flex: 1,
    textAlign: 'right',
  },
  orderPeriod: {
    ...Typography.small,
    flex: 1,
  },
  typeCard: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  typeLabel: {
    ...Typography.small,
    fontWeight: '500',
  },
  inputCard: {
    marginBottom: Spacing.lg,
  },
  inputHint: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  textInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Typography.body,
  },
  smallInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Typography.body,
  },
  charCount: {
    alignItems: 'flex-end',
    marginTop: Spacing.xs,
  },
  charCountText: {
    ...Typography.small,
  },
  submitButton: {
    flexDirection: 'row',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.light.buttonText,
  },
  attachmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  imageWrapper: {
    width: (screenWidth - Spacing.lg * 4 - Spacing.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  imageBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: screenWidth,
    height: screenWidth,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  photoContainer: {
    position: 'relative',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 11,
    marginTop: 4,
  },
  singleLineInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  customerInfoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  customerNameInput: {
    flex: 1,
  },
  customerPhoneInput: {
    flex: 1.5,
  },
});
