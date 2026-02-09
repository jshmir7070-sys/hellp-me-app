import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";

interface DisputeDetail {
  id: number;
  orderId: number;
  helperId: number | null;
  submitterRole: string;
  submitterName: string;
  disputeType: string;
  status: string;
  description: string;
  adminNote: string | null;
  reviewerId: number | null;
  reviewerName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  order: {
    id: number;
    carrierName: string;
    pickupLocation: string;
    deliveryLocation: string;
  };
}

type AdminDisputeDetailScreenProps = NativeStackScreenProps<any, "AdminDisputeDetail">;

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: "대기중",
    in_review: "검토중",
    resolved: "처리완료",
    rejected: "반려",
  };
  return map[status] || status;
};

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    pending: BrandColors.warning,
    in_review: BrandColors.helper,
    resolved: BrandColors.success,
    rejected: BrandColors.error,
  };
  return map[status] || "#888";
};

const getDisputeTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    settlement_error: "정산 금액 오류",
    invoice_error: "세금계산서 오류",
    contract_dispute: "계약 조건 분쟁",
    service_complaint: "서비스 불만",
    delay: "일정 관련",
    other: "기타",
  };
  return map[type] || type;
};

export default function AdminDisputeDetailScreen({ route, navigation }: AdminDisputeDetailScreenProps) {
  const { disputeId } = route.params || {};
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();

  const [adminNote, setAdminNote] = useState("");
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const { data: dispute, isLoading } = useQuery<DisputeDetail>({
    queryKey: [`/api/admin/helper-disputes/${disputeId}`],
    enabled: !!disputeId,
  });

  React.useEffect(() => {
    if (dispute?.adminNote) {
      setAdminNote(dispute.adminNote);
    }
  }, [dispute]);

  const updateMutation = useMutation({
    mutationFn: async ({ status, note }: { status: string; note: string }) => {
      return apiRequest("PATCH", `/api/admin/helper-disputes/${disputeId}/status`, {
        status,
        adminReply: note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/helper-disputes"] });
      Alert.alert("완료", "이의제기가 처리되었습니다.", [
        { text: "확인", onPress: () => navigation.goBack() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("오류", error.message || "처리 중 오류가 발생했습니다.");
    },
  });

  const handleAction = (action: string) => {
    if (!adminNote.trim()) {
      Alert.alert("알림", "처리 내용을 입력해주세요.");
      return;
    }

    const actionLabel = action === "resolved" ? "처리완료" : action === "rejected" ? "반려" : "검토중";
    Alert.alert(
      "확인",
      `이의제기를 '${actionLabel}'(으)로 변경하시겠습니까?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "확인",
          onPress: () => updateMutation.mutate({ status: action, note: adminNote }),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
      </View>
    );
  }

  if (!dispute) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ThemedText style={{ color: theme.tabIconDefault }}>
          이의제기를 찾을 수 없습니다
        </ThemedText>
      </View>
    );
  }

  const isResolved = dispute.status === "resolved" || dispute.status === "rejected";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <Card variant="glass" padding="lg" style={styles.section}>
        <View style={styles.headerRow}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            이의제기 정보
          </ThemedText>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(dispute.status) + "20" },
            ]}
          >
            <ThemedText
              style={[styles.statusText, { color: getStatusColor(dispute.status) }]}
            >
              {getStatusLabel(dispute.status)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <InfoRow label="오더 번호" value={`#${dispute.orderId}`} theme={theme} />
          <InfoRow label="제기자" value={`${dispute.submitterName} (${dispute.submitterRole === "helper" ? "헬퍼" : "요청자"})`} theme={theme} />
          <InfoRow label="유형" value={getDisputeTypeLabel(dispute.disputeType)} theme={theme} />
          <InfoRow label="접수일" value={format(new Date(dispute.createdAt), "yyyy.MM.dd HH:mm", { locale: ko })} theme={theme} />
          {dispute.resolvedAt ? (
            <InfoRow label="처리일" value={format(new Date(dispute.resolvedAt), "yyyy.MM.dd HH:mm", { locale: ko })} theme={theme} />
          ) : null}
          {dispute.reviewerName ? (
            <InfoRow label="담당자" value={dispute.reviewerName} theme={theme} />
          ) : null}
        </View>
      </Card>

      <Card variant="glass" padding="lg" style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          오더 정보
        </ThemedText>
        <View style={styles.infoGrid}>
          <InfoRow label="운송사" value={dispute.order?.carrierName || "-"} theme={theme} />
          <InfoRow label="상차지" value={dispute.order?.pickupLocation || "-"} theme={theme} />
          <InfoRow label="하차지" value={dispute.order?.deliveryLocation || "-"} theme={theme} />
        </View>
      </Card>

      <Card variant="glass" padding="lg" style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          이의 내용
        </ThemedText>
        <ThemedText style={[styles.descriptionText, { color: theme.text }]}>
          {dispute.description}
        </ThemedText>
      </Card>

      <Card variant="glass" padding="lg" style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          관리자 처리
        </ThemedText>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: theme.backgroundTertiary,
            },
          ]}
          placeholder="처리 내용을 입력하세요"
          placeholderTextColor={theme.tabIconDefault}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          value={adminNote}
          onChangeText={setAdminNote}
          editable={!isResolved}
        />
      </Card>

      {!isResolved ? (
        <View style={styles.actionButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: BrandColors.helper },
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => handleAction("in_review")}
            disabled={updateMutation.isPending}
          >
            <ThemedText style={styles.actionButtonText}>검토중으로 변경</ThemedText>
          </Pressable>

          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                styles.rejectButton,
                { borderColor: BrandColors.error },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => handleAction("rejected")}
              disabled={updateMutation.isPending}
            >
              <ThemedText style={[styles.actionButtonText, { color: BrandColors.error }]}>
                반려
              </ThemedText>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: BrandColors.success, flex: 2 },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => handleAction("resolved")}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.actionButtonText}>처리완료</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <Card variant="glass" padding="lg" style={styles.resolvedCard}>
          <View style={styles.resolvedInfo}>
            <Icon name="checkmark-circle" size={24} color={BrandColors.success} />
            <ThemedText style={[styles.resolvedText, { color: theme.text }]}>
              이 이의제기는 이미 처리되었습니다
            </ThemedText>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

function InfoRow({ label, value, theme }: { label: string; value: string; theme: any }) {
  return (
    <View style={styles.infoRow}>
      <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.infoValue, { color: theme.text }]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  section: {
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoGrid: {
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
  },
  infoLabel: {
    fontSize: 14,
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 14,
    minHeight: 120,
  },
  actionButtons: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resolvedCard: {
    marginBottom: Spacing.md,
  },
  resolvedInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  resolvedText: {
    fontSize: 14,
  },
});
