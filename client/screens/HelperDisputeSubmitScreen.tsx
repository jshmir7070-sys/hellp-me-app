import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator, TextInput, Image, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Icon } from "@/components/Icon";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/query-client";
import { formatOrderNumber } from "@/lib/format-order-number";

type SettlementStackParamList = {
  HelperDisputeSubmit: { orderId?: number; orderNumber?: string; workDate?: string; orderTitle?: string } | undefined;
  HelperDisputeList: undefined;
};

type HelperDisputeSubmitScreenProps = NativeStackScreenProps<SettlementStackParamList, 'HelperDisputeSubmit'>;

const DISPUTE_TYPES = [
  { value: "settlement_error", label: "정산" },
  { value: "invoice_error", label: "세금계산서" },
  { value: "closing_data_mismatch", label: "마감자료불일치" },
  { value: "service_complaint", label: "요청자 불만" },
  { value: "other", label: "기타(직접작성)" },
];

export default function HelperDisputeSubmitScreen({ navigation, route }: HelperDisputeSubmitScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const queryClient = useQueryClient();

  const orderId = route.params?.orderId;
  const orderNumber = route.params?.orderNumber;
  const workDate = route.params?.workDate || new Date().toISOString().split('T')[0];
  const orderTitle = route.params?.orderTitle;

  const [disputeType, setDisputeType] = useState("");
  const [customType, setCustomType] = useState("");
  const [description, setDescription] = useState("");
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  const selectedTypeLabel = disputeType === "other" && customType.trim()
    ? `기타: ${customType}`
    : DISPUTE_TYPES.find(t => t.value === disputeType)?.label || "";

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
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
          setEvidencePhoto(data.url);
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

  const submitMutation = useMutation({
    mutationFn: async () => {
      const finalDescription = disputeType === "other" && customType.trim()
        ? `[${customType}] ${description}`
        : description;
      return apiRequest("POST", "/api/helper/disputes", {
        orderId: orderId || null,
        workDate,
        disputeType,
        description: finalDescription,
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
      navigation.replace('HelperDisputeList' as any);
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
      Alert.alert("알림", "이의제기 유형을 선택해주세요.");
      return;
    }
    if (disputeType === "other" && !customType.trim()) {
      Alert.alert("알림", "유형을 직접 입력해주세요.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("알림", "상세 내용을 입력해주세요.");
      return;
    }
    submitMutation.mutate();
  };

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: showDesktopLayout ? Spacing.xl : tabBarHeight + Spacing.xl,
          ...(showDesktopLayout && {
            maxWidth: containerMaxWidth,
            alignSelf: 'center' as const,
            width: '100%' as any,
          }),
        }}
      >
        <View style={styles.content}>
          {/* 마감정보 카드 */}
          <Card style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Icon name="document-text-outline" size={20} color={BrandColors.helper} />
              <ThemedText style={[styles.infoTitle, { color: theme.text }]}>마감 정보</ThemedText>
            </View>
            {orderTitle ? (
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>오더</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>{orderTitle}</ThemedText>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>근무일</ThemedText>
              <ThemedText style={[styles.infoValue, { color: theme.text }]}>{formatDisplayDate(workDate)}</ThemedText>
            </View>
            {orderId ? (
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>오더 번호</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>{formatOrderNumber(orderNumber, orderId)}</ThemedText>
              </View>
            ) : null}
          </Card>

          {/* 이의제기 유형 선택 (모달 피커) */}
          <Card style={styles.section}>
            <ThemedText style={[styles.label, { color: theme.text }]}>이의제기 유형 *</ThemedText>
            <Pressable
              style={[styles.pickerButton, { borderColor: theme.backgroundTertiary, backgroundColor: theme.backgroundDefault }]}
              onPress={() => setShowTypePicker(true)}
            >
              <ThemedText style={[styles.pickerText, { color: disputeType ? theme.text : theme.tabIconDefault }]}>
                {selectedTypeLabel || "유형을 선택하세요"}
              </ThemedText>
              <Icon name="chevron-down-outline" size={20} color={theme.tabIconDefault} />
            </Pressable>
            {disputeType === "other" && (
              <TextInput
                style={[styles.customTypeInput, { color: theme.text, borderColor: theme.backgroundTertiary, backgroundColor: theme.backgroundDefault }]}
                value={customType}
                onChangeText={setCustomType}
                placeholder="유형을 직접 입력하세요"
                placeholderTextColor={theme.tabIconDefault}
                autoFocus
              />
            )}
          </Card>

          {/* 상세 내용 */}
          <Card style={styles.section}>
            <ThemedText style={[styles.label, { color: theme.text }]}>상세 내용 *</ThemedText>
            <TextInput
              style={[styles.textArea, { color: theme.text, borderColor: theme.backgroundTertiary, backgroundColor: theme.backgroundDefault }]}
              value={description}
              onChangeText={setDescription}
              placeholder="이의제기 사유를 상세히 작성해주세요"
              placeholderTextColor={theme.tabIconDefault}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
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

        <View style={[styles.footer, { paddingBottom: showDesktopLayout ? Spacing.lg : tabBarHeight + Spacing.lg }]}>
          <Pressable
            style={[
              styles.submitButton,
              { backgroundColor: BrandColors.helper },
              submitMutation.isPending && { opacity: 0.7 },
            ]}
            onPress={handleSubmit}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.submitButtonText}>이의제기 접수</ThemedText>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* 유형 선택 모달 */}
      <Modal
        visible={showTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTypePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTypePicker(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHandle} />
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>이의제기 유형 선택</ThemedText>
            {DISPUTE_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.modalOption,
                  { borderBottomColor: theme.backgroundTertiary },
                  disputeType === type.value && { backgroundColor: BrandColors.helperLight || '#D1FAE5' },
                ]}
                onPress={() => {
                  setDisputeType(type.value);
                  setShowTypePicker(false);
                }}
              >
                <ThemedText
                  style={[
                    styles.modalOptionText,
                    { color: theme.text },
                    disputeType === type.value && { color: BrandColors.helper, fontWeight: "700" },
                  ]}
                >
                  {type.label}
                </ThemedText>
                {disputeType === type.value && (
                  <Icon name="checkmark" size={20} color={BrandColors.helper} />
                )}
              </Pressable>
            ))}
            <Pressable
              style={[styles.modalCloseButton, { backgroundColor: theme.backgroundTertiary }]}
              onPress={() => setShowTypePicker(false)}
            >
              <ThemedText style={[styles.modalCloseText, { color: theme.text }]}>닫기</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  infoCard: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    padding: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  pickerText: {
    fontSize: 15,
  },
  customTypeInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    marginTop: Spacing.md,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 15,
    minHeight: 120,
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
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#ccc",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalOptionText: {
    fontSize: 16,
  },
  modalCloseButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
