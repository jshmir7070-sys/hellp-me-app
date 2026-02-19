import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator, TextInput, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { apiRequest, getAuthToken } from "@/lib/query-client";
import { pickImage, uploadEvidence } from "@/lib/image-upload";

type ProfileStackParamList = {
  RequesterDispute: { orderId: number };
};

type RequesterDisputeScreenProps = NativeStackScreenProps<ProfileStackParamList, 'RequesterDispute'>;

interface DisputeStatusResponse {
  hasActiveDispute: boolean;
  activeDispute: {
    id: number;
    status: string;
    disputeType: string;
    createdAt: string;
  } | null;
  totalDisputes: number;
}

const DISPUTE_TYPES = [
  { value: "settlement_error", label: "정산 금액 오류" },
  { value: "invoice_error", label: "세금계산서 오류" },
  { value: "contract_dispute", label: "계약 조건 분쟁" },
  { value: "service_complaint", label: "서비스 불만" },
  { value: "delay", label: "일정 관련" },
  { value: "other", label: "기타" },
];

export default function RequesterDisputeScreen({ navigation, route }: RequesterDisputeScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const orderId = route.params?.orderId;

  const [disputeType, setDisputeType] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handlePickImage = async () => {
    try {
      const uri = await pickImage();
      if (!uri) return;

      setIsUploading(true);
      const token = await getAuthToken();
      if (!token) {
        Alert.alert("오류", "로그인이 필요합니다.");
        return;
      }

      const result = await uploadEvidence(uri, { category: 'dispute' }, token);

      if (result.success && result.url) {
        setPhotos(prev => [...prev, result.url!]);
      } else {
        Alert.alert("오류", "사진 업로드에 실패했습니다.");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("오류", "사진 선택 중 문제가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const { data: order, isLoading: isLoadingOrder } = useQuery<any>({
    queryKey: [`/api/requester/orders/${orderId}`],
    enabled: !!orderId,
  });

  const { data: disputeStatus, isLoading: isLoadingDisputeStatus } = useQuery<DisputeStatusResponse>({
    queryKey: [`/api/requester/orders/${orderId}/dispute-status`],
    enabled: !!orderId,
  });

  const hasActiveDispute = disputeStatus?.hasActiveDispute ?? false;
  const activeDispute = disputeStatus?.activeDispute;

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/requester/disputes", {
        orderId: orderId || null,
        incidentType: disputeType,
        description,
        evidencePhotoUrls: photos,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requester/disputes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/requester/orders"] });
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

  const helperName = order?.helperName || order?.assignedHelperName || "-";
  const deliveryArea = order?.deliveryArea || order?.companyName || "-";
  const vehicleType = order?.vehicleType || "-";
  const workDate = order?.workDate || order?.expectedDate || "-";
  const orderNumber = order?.orderNumber || `O-${orderId}`;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 120 }}
    >
      <View style={styles.content}>
        <Card style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <View style={styles.orderNumberBadge}>
              <ThemedText style={styles.orderNumberText}>{orderNumber}</ThemedText>
            </View>
            {order ? (
              <ThemedText style={[styles.orderStatus, { color: BrandColors.requester }]}>
                {order.status === 'closing_submitted' ? '마감제출' : ['closed', 'settlement_paid', 'balance_paid', 'final_amount_confirmed'].includes(order.status) ? '완료' : '진행중'}
              </ThemedText>
            ) : null}
          </View>

          {isLoadingOrder ? (
            <ActivityIndicator size="small" color={BrandColors.requester} style={{ marginVertical: Spacing.md }} />
          ) : order ? (
            <>
              <ThemedText style={[styles.orderTitle, { color: theme.text }]}>{deliveryArea}</ThemedText>

              <View style={styles.orderDetails}>
                <View style={styles.orderDetailRow}>
                  <Icon name="person-outline" size={14} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.orderDetailText, { color: theme.tabIconDefault }]}>
                    헬퍼: <ThemedText style={{ color: theme.text, fontWeight: '600' }}>{helperName}</ThemedText>
                  </ThemedText>
                </View>
                <View style={styles.orderDetailRow}>
                  <Icon name="car-outline" size={14} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.orderDetailText, { color: theme.tabIconDefault }]}>
                    차량: <ThemedText style={{ color: theme.text }}>{vehicleType}</ThemedText>
                  </ThemedText>
                </View>
                <View style={styles.orderDetailRow}>
                  <Icon name="calendar-outline" size={14} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.orderDetailText, { color: theme.tabIconDefault }]}>
                    근무일: <ThemedText style={{ color: theme.text }}>{workDate}</ThemedText>
                  </ThemedText>
                </View>
              </View>
            </>
          ) : (
            <ThemedText style={[styles.description, { color: theme.tabIconDefault }]}>
              오더 정보를 불러올 수 없습니다
            </ThemedText>
          )}
        </Card>

        {hasActiveDispute && activeDispute ? (
          <Card style={{ padding: Spacing.lg, borderColor: BrandColors.warning, borderWidth: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Icon name="alert-circle-outline" size={20} color={BrandColors.warning} />
              <ThemedText style={[styles.sectionTitle, { color: BrandColors.warning, marginLeft: Spacing.xs, marginBottom: 0 }]}>
                처리 중인 이의제기
              </ThemedText>
            </View>
            <ThemedText style={[styles.description, { color: theme.tabIconDefault, marginTop: Spacing.sm }]}>
              이 오더에 대해 이미 접수된 이의제기가 있습니다. 관리자 검토 후 결과를 안내해 드리겠습니다.
            </ThemedText>
            <View style={{ marginTop: Spacing.md, gap: Spacing.xs }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <ThemedText style={[styles.label, { color: theme.tabIconDefault, marginBottom: 0 }]}>상태:</ThemedText>
                <ThemedText style={[styles.orderValue, { color: theme.text }]}>
                  {activeDispute.status === "pending" ? "검토 대기" : activeDispute.status === "in_review" ? "검토 중" : activeDispute.status}
                </ThemedText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <ThemedText style={[styles.label, { color: theme.tabIconDefault, marginBottom: 0 }]}>접수일:</ThemedText>
                <ThemedText style={[styles.orderValue, { color: theme.text }]}>
                  {new Date(activeDispute.createdAt).toLocaleDateString("ko-KR")}
                </ThemedText>
              </View>
            </View>
          </Card>
        ) : (
          <>
            <Card style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>이의제기</ThemedText>
              <ThemedText style={[styles.description, { color: theme.tabIconDefault }]}>
                위 오더와 관련된 문제나 사고에 대해 이의를 제기할 수 있습니다.
              </ThemedText>
            </Card>

            <Card style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>유형 선택</ThemedText>
              <View style={styles.typeGrid}>
                {DISPUTE_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    style={[
                      styles.typeButton,
                      { borderColor: disputeType === type.value ? BrandColors.requester : theme.backgroundTertiary },
                      disputeType === type.value && { backgroundColor: BrandColors.requesterLight },
                    ]}
                    onPress={() => setDisputeType(type.value)}
                  >
                    <ThemedText
                      style={[
                        styles.typeText,
                        disputeType === type.value && { color: BrandColors.requester, fontWeight: "600" },
                      ]}
                    >
                      {type.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </Card>

            <Card style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>상세 내용</ThemedText>
              <TextInput
                style={[
                  styles.textArea,
                  { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.backgroundTertiary },
                ]}
                placeholder="문제 상황을 자세히 설명해주세요"
                placeholderTextColor={theme.tabIconDefault}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />
            </Card>

            <Card style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>증빙 사진 (선택)</ThemedText>
              <View style={styles.photoContainer}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoWrapper}>
                    <Pressable
                      style={styles.photoDeleteButton}
                      onPress={() => removePhoto(index)}
                    >
                      <Icon name="close-circle" size={20} color={BrandColors.error} />
                    </Pressable>
                    <Image source={{ uri: photo }} style={styles.photoThumbnail} />
                  </View>
                ))}

                <Pressable
                  style={[styles.addPhotoButton, { borderColor: theme.backgroundTertiary }]}
                  onPress={handlePickImage}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color={theme.tabIconDefault} />
                  ) : (
                    <>
                      <Icon name="camera-outline" size={24} color={theme.tabIconDefault} />
                      <ThemedText style={[styles.addPhotoText, { color: theme.tabIconDefault }]}>
                        사진 추가
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            </Card>

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: BrandColors.requester },
                submitMutation.isPending && { opacity: 0.6 },
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleSubmit}
              disabled={submitMutation.isPending}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.submitText}>이의제기 접수</ThemedText>
              )}
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.lg,
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
  },
  orderCard: {
    padding: Spacing.lg,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  orderNumberBadge: {
    backgroundColor: BrandColors.requesterLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  orderNumberText: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.requester,
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: "600",
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  orderDetails: {
    gap: Spacing.xs,
  },
  orderDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  orderDetailText: {
    fontSize: 13,
  },
  orderInfo: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  orderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderLabel: {
    fontSize: 14,
  },
  orderValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  dateText: {
    fontSize: 15,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  typeText: {
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 120,
    fontSize: 15,
  },
  amountInput: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  amountField: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  amountUnit: {
    fontSize: 15,
    fontWeight: "500",
  },
  submitButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    minHeight: 52,
    zIndex: 10,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  photoContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  photoWrapper: {
    position: "relative",
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: "#eee",
  },
  photoDeleteButton: {
    position: "absolute",
    top: -8,
    right: -8,
    zIndex: 1,
    backgroundColor: "white",
    borderRadius: 12,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
