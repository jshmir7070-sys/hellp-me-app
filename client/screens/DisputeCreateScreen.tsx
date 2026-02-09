import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { JobsStackParamList } from "@/navigation/types";
import { apiRequest } from "@/lib/query-client";

type DisputeCreateScreenProps = NativeStackScreenProps<JobsStackParamList, 'DisputeCreate'>;

const DISPUTE_TYPES = [
  { value: "count_mismatch", label: "수량 불일치" },
  { value: "amount_error", label: "금액 오류" },
  { value: "freight_accident", label: "화물 사고" },
  { value: "damage", label: "물품 파손" },
  { value: "lost", label: "분실" },
  { value: "wrong_delivery", label: "오배송" },
  { value: "other", label: "기타" },
];

export default function DisputeCreateScreen({ navigation, route }: DisputeCreateScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const orderId = route.params?.orderId;
  const initialType = route.params?.type || "";

  const [workDate, setWorkDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [disputeType, setDisputeType] = useState(initialType);
  const [description, setDescription] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");

  const submitMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/helper/disputes", {
        orderId: orderId || null,
        workDate: workDate.toISOString().split("T")[0],
        disputeType,
        description,
        requestedAmount: requestedAmount ? Number(requestedAmount) : null,
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

  const formatDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }}
    >
      <View style={styles.content}>
        <Card variant="glass" padding="lg" style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>이의제기/화물사고 접수</ThemedText>
          <ThemedText style={[styles.description, { color: theme.tabIconDefault }]}>
            작업 중 발생한 문제나 정산 오류에 대해 이의를 제기할 수 있습니다.
          </ThemedText>
        </Card>

        <Card variant="glass" padding="lg" style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>작업일</ThemedText>
          <Pressable
            style={[styles.dateButton, { borderColor: theme.backgroundTertiary }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Icon name="calendar-outline" size={18} color={theme.tabIconDefault} />
            <ThemedText style={styles.dateText}>{formatDate(workDate)}</ThemedText>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              value={workDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, date) => {
                setShowDatePicker(Platform.OS === "ios");
                if (date) setWorkDate(date);
              }}
            />
          ) : null}
        </Card>

        <Card variant="glass" padding="lg" style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>유형 선택</ThemedText>
          <View style={styles.typeGrid}>
            {DISPUTE_TYPES.map((type) => (
              <Pressable
                key={type.value}
                style={[
                  styles.typeButton,
                  { borderColor: disputeType === type.value ? BrandColors.helper : theme.backgroundTertiary },
                  disputeType === type.value && { backgroundColor: BrandColors.helperLight },
                ]}
                onPress={() => setDisputeType(type.value)}
              >
                <ThemedText
                  style={[
                    styles.typeText,
                    disputeType === type.value && { color: BrandColors.helper, fontWeight: "600" },
                  ]}
                >
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card variant="glass" padding="lg" style={styles.section}>
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

        <Card variant="glass" padding="lg" style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>요청 금액 (선택)</ThemedText>
          <View style={[styles.amountInput, { borderColor: theme.backgroundTertiary }]}>
            <TextInput
              style={[styles.amountField, { color: theme.text }]}
              placeholder="금액 입력"
              placeholderTextColor={theme.tabIconDefault}
              keyboardType="numeric"
              value={requestedAmount}
              onChangeText={setRequestedAmount}
            />
            <ThemedText style={styles.amountUnit}>원</ThemedText>
          </View>
        </Card>

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
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  section: {},
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: 14,
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
    fontSize: 16,
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
    minHeight: 120,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    fontSize: 16,
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
    fontSize: 16,
  },
  amountUnit: {
    fontSize: 16,
    marginLeft: Spacing.sm,
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
