import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator, TextInput, KeyboardAvoidingView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { JobsStackParamList } from "@/navigation/types";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getToken } from '@/utils/secure-token-storage';

type ClosingReportScreenProps = NativeStackScreenProps<JobsStackParamList, 'ClosingReport'>;

interface ExtraCost {
  code: string;
  amount: number;
  memo: string;
}

export default function ClosingReportScreen({ navigation, route }: ClosingReportScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { orderId } = route.params;
  const queryClient = useQueryClient();

  const [deliveredCount, setDeliveredCount] = useState("");
  const [returnedCount, setReturnedCount] = useState("");
  const [etcCount, setEtcCount] = useState("");
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([]);
  const [deliveryHistoryImages, setDeliveryHistoryImages] = useState<string[]>([]);
  const [etcImages, setEtcImages] = useState<string[]>([]);
  const [memo, setMemo] = useState("");

  const { data: order } = useQuery<{
    id: number; 
    title: string; 
    pricePerUnit?: number;
    courierCompany?: string;
    companyName?: string;
    vehicleType?: string;
    scheduledDate?: string;
  }>({
    queryKey: [`/api/orders/${orderId}`],
  });

  const { data: categoryPricing } = useQuery<{
    other: { destinationPrice: number; boxPrice: number; minDailyFee: number };
    cold: { minDailyFee: number };
  }>({
    queryKey: ['/api/meta/category-pricing'],
  });
  
  const etcPricePerUnit = categoryPricing?.other?.boxPrice || 1800;

  const uploadImage = async (uri: string, imageType: string): Promise<string> => {
    const apiUrl = getApiUrl();
    const formData = new FormData();
    const filename = uri.split("/").pop() || `image.jpg`;
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : "image/jpeg";
    
    // 서버가 기대하는 필드명 'file' 사용
    formData.append("file", {
      uri,
      name: filename,
      type,
    } as any);
    formData.append("imageType", imageType);

    // 인증 토큰 가져오기
    const authToken = await getToken();

    const res = await fetch(new URL("/api/upload/closing-image", apiUrl).toString(), {
      method: "POST",
      headers: {
        // Authorization 헤더 추가 (필수)
        ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
      },
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      const errorText = await res.text();
      if (__DEV__) console.error("Upload error:", res.status, errorText);
      throw new Error("이미지 업로드에 실패했습니다");
    }

    const data = await res.json();
    return data.fileKey;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const apiUrl = getApiUrl();

      // Upload delivery history images (mandatory)
      const uploadedDeliveryHistoryImages: string[] = [];
      for (const uri of deliveryHistoryImages) {
        const fileKey = await uploadImage(uri, "DELIVERY_HISTORY");
        uploadedDeliveryHistoryImages.push(fileKey);
      }

      // Upload etc images (optional)
      const uploadedEtcImages: string[] = [];
      for (const uri of etcImages) {
        const fileKey = await uploadImage(uri, "ETC");
        uploadedEtcImages.push(fileKey);
      }

      // Build closing text for the close endpoint
      const closingText = [
        `배송수: ${deliveredCount || 0}`,
        `반품수: ${returnedCount || 0}`,
        etcCount ? `기타: ${etcCount}` : "",
        extraCosts.length > 0 ? `기타비용: ${extraCosts.map(c => `${c.code} ${c.amount}원`).join(", ")}` : "",
        memo ? `메모: ${memo}` : "",
      ].filter(Boolean).join("\n");

      // Submit to the close endpoint
      const res = await apiRequest("POST", `/api/orders/${orderId}/close`, {
        text: closingText.length >= 20 ? closingText : closingText + "\n배송 완료되었습니다. 확인 부탁드립니다.",
        deliveryHistoryImages: uploadedDeliveryHistoryImages,
        etcImages: uploadedEtcImages.length > 0 ? uploadedEtcImages : undefined,
        deliveredCount: parseInt(deliveredCount) || 0,
        returnedCount: parseInt(returnedCount) || 0,
        etcCount: parseInt(etcCount) || 0,
        extraCosts,
        memo,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "제출에 실패했습니다");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
      if (Platform.OS === "web") {
        alert("마감자료가 제출되었습니다!");
      } else {
        Alert.alert("제출 완료", "마감자료가 제출되었습니다. 관리자 검수 후 정산이 진행됩니다.");
      }
      navigation.goBack();
    },
    onError: (err: Error) => {
      const message = err.message || "제출에 실패했습니다.";
      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("오류", message);
      }
    },
  });

  const pickDeliveryHistoryImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setDeliveryHistoryImages([...deliveryHistoryImages, ...result.assets.map((a) => a.uri)]);
    }
  };

  const pickEtcImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setEtcImages([...etcImages, ...result.assets.map((a) => a.uri)]);
    }
  };

  const removeDeliveryHistoryImage = (index: number) => {
    setDeliveryHistoryImages(deliveryHistoryImages.filter((_, i) => i !== index));
  };

  const removeEtcImage = (index: number) => {
    setEtcImages(etcImages.filter((_, i) => i !== index));
  };

  const addExtraCost = () => {
    setExtraCosts([...extraCosts, { code: "", amount: 0, memo: "" }]);
  };

  const updateExtraCost = (index: number, field: keyof ExtraCost, value: string | number) => {
    const updated = [...extraCosts];
    if (field === "amount") {
      updated[index][field] = Number(value) || 0;
    } else {
      updated[index][field] = value as string;
    }
    setExtraCosts(updated);
  };

  const removeExtraCost = (index: number) => {
    setExtraCosts(extraCosts.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    const unitPrice = order?.pricePerUnit || 0;
    const delivered = parseInt(deliveredCount) || 0;
    const returns = parseInt(returnedCount) || 0;
    const extras = extraCosts.reduce((sum, c) => sum + c.amount, 0);
    return (delivered + returns) * unitPrice + extras;
  };

  const handleSubmit = () => {
    if (!deliveredCount && !returnedCount) {
      if (Platform.OS === "web") {
        alert("배송수 또는 반품수를 입력해주세요.");
      } else {
        Alert.alert("입력 오류", "배송수 또는 반품수를 입력해주세요.");
      }
      return;
    }
    if (deliveryHistoryImages.length === 0) {
      if (Platform.OS === "web") {
        alert("배송이력 캡처 사진을 1장 이상 첨부해주세요.");
      } else {
        Alert.alert("필수 사진 누락", "배송이력 캡처 사진을 1장 이상 첨부해주세요.\n(택배사 앱의 배송완료 이력 화면 캡처)");
      }
      return;
    }
    submitMutation.mutate();
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.lg,
        }}
      >
        {/* 오더 정보 섹션 */}
        <Card style={styles.card}>
          <ThemedText style={[styles.sectionLabel, { color: theme.tabIconDefault }]}>
            오더 정보
          </ThemedText>
          <ThemedText style={[styles.orderTitle, { color: theme.text }]}>
            {order?.courierCompany || order?.companyName || order?.title || "로딩 중..."} {order?.vehicleType ? `- ${order.vehicleType}` : ""}
          </ThemedText>
          <ThemedText style={[styles.orderMeta, { color: theme.tabIconDefault }]}>
            {order?.scheduledDate || ""} · 단가: {order?.pricePerUnit?.toLocaleString() || 0}원
          </ThemedText>
        </Card>

        <Card style={styles.card}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            배송/반품 수량 (필수)
          </ThemedText>
          <ThemedText style={[styles.helperText, { color: theme.tabIconDefault }]}>
            당일 배송 완료 및 반품 수량을 입력해주세요.
          </ThemedText>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.tabIconDefault }]}>
                배송 완료
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: '#E0E0E0' }]}
                value={deliveredCount}
                onChangeText={setDeliveredCount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.tabIconDefault}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.tabIconDefault }]}>
                반품
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: '#E0E0E0' }]}
                value={returnedCount}
                onChangeText={setReturnedCount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.tabIconDefault}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText style={[styles.inputLabel, { color: theme.tabIconDefault, fontSize: 11 }]}>
                기타({etcPricePerUnit.toLocaleString()}원)
              </ThemedText>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: '#E0E0E0' }]}
                value={etcCount}
                onChangeText={setEtcCount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.tabIconDefault}
              />
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              기타비용
            </ThemedText>
            <Pressable style={[styles.addButton, { borderColor: BrandColors.helper }]} onPress={addExtraCost}>
              <Icon name="add-outline" size={16} color={BrandColors.helper} />
              <ThemedText style={[styles.addButtonText, { color: BrandColors.helper }]}>추가</ThemedText>
            </Pressable>
          </View>

          {extraCosts.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
              기타비용이 없습니다
            </ThemedText>
          ) : (
            extraCosts.map((cost, index) => (
              <View key={index} style={styles.extraCostRow}>
                <TextInput
                  style={[styles.extraCostInput, styles.extraCostCode, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: '#E0E0E0' }]}
                  value={cost.code}
                  onChangeText={(v) => updateExtraCost(index, "code", v)}
                  placeholder="항목명"
                  placeholderTextColor={theme.tabIconDefault}
                />
                <TextInput
                  style={[styles.extraCostInput, styles.extraCostAmount, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: '#E0E0E0' }]}
                  value={cost.amount ? String(cost.amount) : ""}
                  onChangeText={(v) => updateExtraCost(index, "amount", v)}
                  keyboardType="numeric"
                  placeholder="금액"
                  placeholderTextColor={theme.tabIconDefault}
                />
                <Pressable onPress={() => removeExtraCost(index)} style={styles.removeButton}>
                  <Icon name="close-outline" size={18} color={BrandColors.error} />
                </Pressable>
              </View>
            ))
          )}
        </Card>

        <Card style={{ ...styles.card, ...styles.requiredCard }}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                배송이력 캡처
              </ThemedText>
              <View style={styles.requiredBadge}>
                <ThemedText style={styles.requiredBadgeText}>필수</ThemedText>
              </View>
            </View>
            <Pressable style={[styles.addButton, { borderColor: BrandColors.helper }]} onPress={pickDeliveryHistoryImage}>
              <Icon name="camera-outline" size={16} color={BrandColors.helper} />
              <ThemedText style={[styles.addButtonText, { color: BrandColors.helper }]}>추가</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={[styles.helperText, { color: theme.tabIconDefault }]}>
            택배사 앱의 배송완료 이력 화면을 캡처해 업로드하세요
          </ThemedText>

          {deliveryHistoryImages.length === 0 ? (
            <View style={styles.emptyImageContainer}>
              <Icon name="image-outline" size={32} color={BrandColors.error} />
              <ThemedText style={[styles.emptyText, { color: BrandColors.error }]}>
                배송이력 캡처가 필요합니다
              </ThemedText>
            </View>
          ) : (
            <View style={styles.imageGrid}>
              {deliveryHistoryImages.map((uri, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <Pressable onPress={() => removeDeliveryHistoryImage(index)} style={styles.imageRemoveButton}>
                    <View style={styles.imageRemoveIcon}>
                      <Icon name="close-outline" size={14} color="#FFFFFF" />
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                기타 증빙 사진
              </ThemedText>
              <View style={[styles.requiredBadge, styles.optionalBadge]}>
                <ThemedText style={[styles.requiredBadgeText, { color: theme.tabIconDefault }]}>선택</ThemedText>
              </View>
            </View>
            <Pressable style={[styles.addButton, { borderColor: theme.tabIconDefault }]} onPress={pickEtcImage}>
              <Icon name="camera-outline" size={16} color={theme.tabIconDefault} />
              <ThemedText style={[styles.addButtonText, { color: theme.tabIconDefault }]}>추가</ThemedText>
            </Pressable>
          </View>

          <ThemedText style={[styles.helperText, { color: theme.tabIconDefault }]}>
            기타 관련 사진이 있으면 추가해주세요 (예: 차량 사진, 현장 사진 등)
          </ThemedText>

          {etcImages.length === 0 ? (
            <View style={styles.emptyImageContainer}>
              <Icon name="image-outline" size={24} color={theme.tabIconDefault} />
              <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
                추가된 사진 없음
              </ThemedText>
            </View>
          ) : (
            <View style={styles.imageGrid}>
              {etcImages.map((uri, index) => (
                <View key={index} style={styles.imageContainer}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <Pressable onPress={() => removeEtcImage(index)} style={styles.imageRemoveButton}>
                    <View style={styles.imageRemoveIcon}>
                      <Icon name="close-outline" size={14} color="#FFFFFF" />
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card style={styles.card}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            메모
          </ThemedText>
          <TextInput
            style={[styles.memoInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: '#E0E0E0' }]}
            value={memo}
            onChangeText={setMemo}
            placeholder="특이사항이나 메모를 입력해주세요"
            placeholderTextColor={theme.tabIconDefault}
            multiline
            numberOfLines={3}
          />
        </Card>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>예상 정산 금액</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: BrandColors.helper }]}>
              {new Intl.NumberFormat("ko-KR").format(calculateTotal())}원
            </ThemedText>
          </View>
        </Card>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundRoot }]}>
        <Pressable
          testID="button-submit-closing-report"
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: BrandColors.helper, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleSubmit}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <ThemedText style={styles.submitButtonText}>마감자료 제출</ThemedText>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  requiredCard: {
    borderWidth: 1,
    borderColor: BrandColors.helperLight,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: 0,
  },
  requiredBadge: {
    backgroundColor: BrandColors.errorLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  optionalBadge: {
    backgroundColor: "#F0F0F0",
  },
  requiredBadgeText: {
    ...Typography.small,
    color: BrandColors.error,
    fontWeight: "600",
  },
  helperText: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    minHeight: 80,
    textAlignVertical: "top",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
  },
  addButtonText: {
    ...Typography.small,
    fontWeight: "600",
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    paddingVertical: Spacing.lg,
  },
  extraCostRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    alignItems: "center",
  },
  extraCostInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
  },
  extraCostCode: {
    flex: 2,
  },
  extraCostAmount: {
    flex: 1,
  },
  removeButton: {
    padding: Spacing.xs,
  },
  emptyImageContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  imageContainer: {
    position: "relative",
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    resizeMode: "cover",
  },
  imageRemoveButton: {
    position: "absolute",
    top: -6,
    right: -6,
  },
  imageRemoveIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  memoInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
    textAlignVertical: "top",
    minHeight: 80,
  },
  summaryCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    ...Typography.body,
  },
  summaryValue: {
    ...Typography.h3,
    fontWeight: "700",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  submitButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    ...Typography.body,
    fontWeight: "600",
  },
  sectionLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  orderTitle: {
    ...Typography.h3,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  orderMeta: {
    ...Typography.small,
  },
});
