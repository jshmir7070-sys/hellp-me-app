import React, { useState, useEffect } from "react";
import {
  View,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Icon } from "@/components/Icon";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface EditOrderModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: number;
  currentUnitPrice?: number;
  currentDate?: string;
}

export function EditOrderModal({
  visible,
  onClose,
  orderId,
  currentUnitPrice,
  currentDate,
}: EditOrderModalProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [unitPrice, setUnitPrice] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setUnitPrice(currentUnitPrice?.toString() || "");
      if (currentDate) {
        try {
          const parsed = new Date(currentDate);
          if (!isNaN(parsed.getTime())) {
            setScheduledDate(parsed);
          }
        } catch {
          setScheduledDate(new Date());
        }
      }
    }
  }, [visible, currentUnitPrice, currentDate]);

  const updateMutation = useMutation({
    mutationFn: async (data: { pricePerUnit?: number; scheduledDate?: string }) => {
      return apiRequest("PATCH", `/api/orders/${orderId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/requester/orders"] });
      onClose();
    },
  });

  const handleSave = () => {
    const updates: { pricePerUnit?: number; scheduledDate?: string } = {};
    
    const newPrice = parseInt(unitPrice, 10);
    if (!isNaN(newPrice) && newPrice !== currentUnitPrice) {
      updates.pricePerUnit = newPrice;
    }

    const dateStr = formatDateForApi(scheduledDate);
    if (dateStr !== currentDate) {
      updates.scheduledDate = dateStr;
    }

    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    } else {
      onClose();
    }
  };

  const formatDateForApi = (date: Date) => {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const formatDateDisplay = (date: Date) => {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setScheduledDate(selectedDate);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* 내부 Pressable: 모달 내부 클릭 시 overlay onClose 전파 방지 */}
        <Pressable onPress={() => {}} style={styles.contentWrapper}>
          <Card style={styles.modalContent}>
            <View style={styles.header}>
              <ThemedText style={[styles.title, { color: theme.text }]}>
                오더 수정
              </ThemedText>
              <Pressable onPress={onClose} hitSlop={12}>
                <Icon name="close-outline" size={24} color={theme.tabIconDefault} />
              </Pressable>
            </View>

            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
                단가 (원)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundRoot,
                    color: theme.text,
                    borderColor: theme.tabIconDefault,
                  },
                ]}
                value={unitPrice}
                onChangeText={setUnitPrice}
                keyboardType="number-pad"
                placeholder="단가 입력"
                placeholderTextColor={theme.tabIconDefault}
              />
            </View>

            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
                입차일
              </ThemedText>
              <Pressable
                style={[
                  styles.dateButton,
                  {
                    backgroundColor: theme.backgroundRoot,
                    borderColor: theme.tabIconDefault,
                  },
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <Icon name="calendar-outline" size={18} color={theme.tabIconDefault} />
                <ThemedText style={[styles.dateText, { color: theme.text }]}>
                  {formatDateDisplay(scheduledDate)}
                </ThemedText>
              </Pressable>
            </View>

            {showDatePicker ? (
              <DateTimePicker
                value={scheduledDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            ) : null}

            {Platform.OS === "ios" && showDatePicker ? (
              <Pressable
                style={[styles.doneButton, { backgroundColor: BrandColors.requester }]}
                onPress={() => setShowDatePicker(false)}
              >
                <ThemedText style={styles.doneButtonText}>확인</ThemedText>
              </Pressable>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                style={[styles.cancelButton, { borderColor: theme.tabIconDefault }]}
                onPress={onClose}
              >
                <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>
                  취소
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.saveButton,
                  { backgroundColor: BrandColors.requester },
                  updateMutation.isPending && styles.buttonDisabled,
                ]}
                onPress={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.saveButtonText}>저장</ThemedText>
                )}
              </Pressable>
            </View>

            {updateMutation.isError ? (
              <ThemedText style={styles.errorText}>
                수정에 실패했습니다. 다시 시도해주세요.
              </ThemedText>
            ) : null}
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  contentWrapper: {
    width: "100%",
    maxWidth: 400,
  },
  modalContent: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h4,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dateText: {
    fontSize: 16,
  },
  doneButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  doneButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontWeight: "600",
  },
  saveButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    color: "#DC2626",
    textAlign: "center",
    marginTop: Spacing.md,
    ...Typography.small,
  },
});
