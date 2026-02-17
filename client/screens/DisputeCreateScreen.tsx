import React, { useState, useMemo } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator, TextInput, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { ProfileStackParamList } from "@/navigation/types";
import { apiRequest, apiUpload } from "@/lib/query-client";

type DisputeCreateScreenProps = NativeStackScreenProps<ProfileStackParamList, 'DisputeCreate'>;

// 이의제기 유형
const DISPUTE_TYPES = [
  { value: "count_mismatch", label: "수량 불일치", icon: "calculator-outline" },
  { value: "amount_error", label: "금액 오류", icon: "cash-outline" },
  { value: "freight_accident", label: "화물 사고", icon: "warning-outline" },
  { value: "damage", label: "물품 파손", icon: "cube-outline" },
  { value: "lost", label: "분실", icon: "search-outline" },
  { value: "wrong_delivery", label: "오배송", icon: "swap-horizontal-outline" },
  { value: "other", label: "기타", icon: "ellipsis-horizontal-outline" },
];

interface OrderInfo {
  id: number;
  companyName: string;
  deliveryArea: string;
  scheduledDate: string;
  status: string;
  pricePerUnit: number;
  averageQuantity: string;
  orderNumber?: string;
}

export default function DisputeCreateScreen({ navigation, route }: DisputeCreateScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const orderId = route.params?.orderId;
  const initialType = route.params?.type || "";

  const [disputeType, setDisputeType] = useState(initialType);
  const [description, setDescription] = useState("");
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // orderId가 있으면 오더 정보 자동 조회
  const { data: orderInfo } = useQuery<OrderInfo>({
    queryKey: [`/api/orders/${orderId}`],
    enabled: !!orderId,
  });

  // 오더번호 표시
  const orderDisplayNumber = useMemo(() => {
    if (!orderInfo) return orderId ? `O-${orderId}` : "";
    return orderInfo.orderNumber || `O-${orderInfo.id}`;
  }, [orderInfo, orderId]);

  // 근무일 자동 설정
  const workDate = useMemo(() => {
    if (orderInfo?.scheduledDate) {
      return orderInfo.scheduledDate;
    }
    return new Date().toISOString().split("T")[0];
  }, [orderInfo]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
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

        const response = await apiUpload('/api/upload/evidence', formData);
        const data = await response.json();
        setEvidencePhoto(data.url);
      } catch (err: any) {
        console.error("Upload error:", err);
        Alert.alert("오류", err.message || "사진 업로드에 실패했습니다.");
      } finally {
        setUploading(false);
      }
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/helper/disputes", {
        orderId: orderId || null,
        courierName: orderInfo?.companyName || null,
        workDate,
        disputeType,
        description,
        evidencePhotoUrl: evidencePhoto || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/helper/disputes"] });
      if (Platform.OS === "web") {
        alert("이의제기가 접수되었습니다.");
      } else {
        Alert.alert("접수 완료", "이의제기가 접수되었습니다. 관리자 검토 후 안내드리겠습니다.");
      }
      navigation.goBack();
    },
    onError: (err: Error) => {
      const message = err.message || "접수에 실패했습니다.";
      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("오류", message);
      }
    },
  });

  const handleSubmit = () => {
    if (!disputeType) {
      Alert.alert("알림", "유형을 선택해주세요.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("알림", "상세 내용을 입력해주세요.");
      return;
    }
    submitMutation.mutate();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 120 }}
    >
      <View style={styles.content}>
        {/* 오더 정보 카드 (자동 채워짐) */}
        {orderId && (
          <Card style={[styles.section, { borderLeftWidth: 4, borderLeftColor: BrandColors.helper }]}>
            <View style={styles.orderInfoHeader}>
              <View style={[styles.orderBadge, { backgroundColor: BrandColors.helperLight }]}>
                <Icon name="document-text-outline" size={18} color={BrandColors.helper} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>
                  오더 정보
                </ThemedText>
                <ThemedText style={[styles.orderNumber, { color: BrandColors.helper }]}>
                  {orderDisplayNumber}
                </ThemedText>
              </View>
              <Icon name="lock-closed-outline" size={16} color={theme.tabIconDefault} />
            </View>

            {orderInfo ? (
              <View style={styles.orderDetails}>
                <View style={styles.orderRow}>
                  <Icon name="business-outline" size={16} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.orderLabel, { color: theme.tabIconDefault }]}>운송사</ThemedText>
                  <ThemedText style={[styles.orderValue, { color: theme.text }]}>
                    {orderInfo.companyName}
                  </ThemedText>
                </View>
                <View style={styles.orderRow}>
                  <Icon name="calendar-outline" size={16} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.orderLabel, { color: theme.tabIconDefault }]}>근무일</ThemedText>
                  <ThemedText style={[styles.orderValue, { color: theme.text }]}>
                    {workDate}
                  </ThemedText>
                </View>
                <View style={styles.orderRow}>
                  <Icon name="location-outline" size={16} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.orderLabel, { color: theme.tabIconDefault }]}>배송지역</ThemedText>
                  <ThemedText style={[styles.orderValue, { color: theme.text }]}>
                    {orderInfo.deliveryArea}
                  </ThemedText>
                </View>
                {orderInfo.pricePerUnit > 0 && (
                  <View style={styles.orderRow}>
                    <Icon name="cash-outline" size={16} color={theme.tabIconDefault} />
                    <ThemedText style={[styles.orderLabel, { color: theme.tabIconDefault }]}>단가</ThemedText>
                    <ThemedText style={[styles.orderValue, { color: theme.text }]}>
                      {(orderInfo.pricePerUnit || 0).toLocaleString()}원
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : (
              <ActivityIndicator size="small" color={BrandColors.helper} style={{ marginTop: Spacing.md }} />
            )}
          </Card>
        )}

        {/* 오더 없이 접수하는 경우 안내 */}
        {!orderId && (
          <Card style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>이의제기 접수</ThemedText>
            <ThemedText style={[styles.description, { color: theme.tabIconDefault }]}>
              작업 중 발생한 문제나 정산 오류에 대해 이의를 제기할 수 있습니다.
            </ThemedText>
          </Card>
        )}

        {/* 유형 선택 */}
        <Card style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>이의제기 유형 *</ThemedText>
          <View style={styles.typeGrid}>
            {DISPUTE_TYPES.map((type) => {
              const isSelected = disputeType === type.value;
              return (
                <Pressable
                  key={type.value}
                  style={[
                    styles.typeButton,
                    {
                      borderColor: isSelected ? BrandColors.helper : theme.backgroundTertiary,
                      backgroundColor: isSelected ? BrandColors.helperLight : 'transparent',
                    },
                  ]}
                  onPress={() => setDisputeType(type.value)}
                >
                  <Icon
                    name={type.icon as any}
                    size={18}
                    color={isSelected ? BrandColors.helper : theme.tabIconDefault}
                  />
                  <ThemedText
                    style={[
                      styles.typeText,
                      isSelected && { color: BrandColors.helper, fontWeight: "600" },
                    ]}
                  >
                    {type.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* 상세 내용 */}
        <Card style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>상세 내용 *</ThemedText>
          <TextInput
            style={[
              styles.textArea,
              { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.backgroundTertiary },
            ]}
            placeholder="이의제기 사유를 상세히 작성해주세요"
            placeholderTextColor={theme.tabIconDefault}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />
        </Card>

        {/* 증빙사진 */}
        <Card style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>증빙사진 (선택)</ThemedText>
          <ThemedText style={[styles.description, { color: theme.tabIconDefault, marginBottom: Spacing.md }]}>
            관련 증빙 자료가 있으면 첨부해주세요.
          </ThemedText>

          {evidencePhoto ? (
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: evidencePhoto }} style={styles.photoPreview} />
              <Pressable
                style={styles.removePhotoButton}
                onPress={() => setEvidencePhoto(null)}
              >
                <Icon name="close-circle" size={24} color={BrandColors.error} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.uploadButton, { borderColor: theme.backgroundTertiary }]}
              onPress={pickImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={BrandColors.helper} />
              ) : (
                <>
                  <Icon name="camera-outline" size={32} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.uploadText, { color: theme.tabIconDefault }]}>
                    사진 첨부
                  </ThemedText>
                </>
              )}
            </Pressable>
          )}
        </Card>
      </View>

      {/* 제출 버튼 */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          style={[
            styles.submitButton,
            { backgroundColor: BrandColors.helper },
            submitMutation.isPending && { opacity: 0.6 },
          ]}
          onPress={handleSubmit}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.submitText}>이의제기 접수</ThemedText>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  section: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  orderInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  orderBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  orderDetails: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  orderLabel: {
    fontSize: 13,
    width: 60,
  },
  orderValue: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  typeText: {
    fontSize: 14,
  },
  textArea: {
    minHeight: 120,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    fontSize: 15,
  },
  uploadButton: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  uploadText: {
    fontSize: 14,
  },
  photoPreviewContainer: {
    position: "relative",
  },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.md,
    resizeMode: "cover",
  },
  removePhotoButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: "white",
    borderRadius: 12,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  submitButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
