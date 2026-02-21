import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface RefundItem {
  id: number;
  orderId: number;
  incidentType: string;
  requesterName: string | null;
  requesterId: string | null;
  deductionAmount: number;
  deductionReason: string | null;
  requesterRefundApplied: boolean;
  deductionConfirmedAt: string | null;
  createdAt: string;
}

type AdminRefundListScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const STATUS_TABS = [
  { key: "pending", label: "환불 대기" },
  { key: "confirmed", label: "환불 완료" },
];

const getIncidentTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    damage: "파손",
    loss: "분실",
    misdelivery: "오배송",
    delay: "지연배송",
    other: "기타",
  };
  return map[type] || type;
};

export default function AdminRefundListScreen({ navigation }: AdminRefundListScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState("pending");

  const { data: incidents, isLoading, refetch, isRefetching } = useQuery<RefundItem[]>({
    queryKey: ["/api/admin/incident-refunds"],
  });

  const confirmMutation = useMutation({
    mutationFn: async (incidentId: number) => {
      return apiRequest("PATCH", `/api/admin/incident-reports/${incidentId}/confirm-refund`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/incident-refunds"] });
      Alert.alert("완료", "요청자 환불이 확정되었습니다.");
    },
    onError: (error: any) => {
      Alert.alert("오류", error.message || "환불 확정 중 오류가 발생했습니다.");
    },
  });

  const filteredIncidents = incidents?.filter((d) => {
    if (selectedStatus === "pending") {
      return !d.requesterRefundApplied;
    }
    return d.requesterRefundApplied;
  });

  const handleConfirmRefund = (item: RefundItem) => {
    Alert.alert(
      "환불 확정",
      `요청자 ${item.requesterName || "미지정"}에게 ${item.deductionAmount?.toLocaleString()}원을 환불하시겠습니까?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "확정",
          onPress: () => confirmMutation.mutate(item.id),
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: RefundItem }) => (
    <Pressable onPress={() => navigation.navigate("AdminIncidentDetail" as any, { incidentId: item.id })}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.orderInfo}>
            <ThemedText style={[styles.orderId, { color: theme.text }]}>
              오더 #{item.orderId}
            </ThemedText>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: item.requesterRefundApplied
                    ? BrandColors.success + "20"
                    : BrandColors.warning + "20",
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.statusText,
                  {
                    color: item.requesterRefundApplied
                      ? BrandColors.success
                      : BrandColors.warning,
                  },
                ]}
              >
                {item.requesterRefundApplied ? "환불완료" : "환불대기"}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
              사고유형
            </ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>
              {getIncidentTypeLabel(item.incidentType)}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
              요청자
            </ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>
              {item.requesterName || "-"}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
              환불금액
            </ThemedText>
            <ThemedText style={[styles.value, { color: BrandColors.success, fontWeight: "600" }]}>
              {item.deductionAmount?.toLocaleString()}원
            </ThemedText>
          </View>
          {item.deductionReason ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
                환불사유
              </ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>
                {item.deductionReason}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
              접수일
            </ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>
              {format(new Date(item.createdAt), "yyyy.MM.dd HH:mm", { locale: ko })}
            </ThemedText>
          </View>
          {item.deductionConfirmedAt ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
                확정일
              </ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>
                {format(new Date(item.deductionConfirmedAt), "yyyy.MM.dd HH:mm", { locale: ko })}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {!item.requesterRefundApplied && item.deductionAmount > 0 ? (
          <Pressable
            style={[styles.confirmButton, { backgroundColor: BrandColors.success }]}
            onPress={() => handleConfirmRefund(item)}
            disabled={confirmMutation.isPending}
          >
            <ThemedText style={styles.confirmButtonText}>
              {confirmMutation.isPending ? "처리중..." : "환불 확정"}
            </ThemedText>
          </Pressable>
        ) : null}
      </Card>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.tabs, { marginTop: headerHeight }]}>
        {STATUS_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.tab,
              selectedStatus === tab.key && {
                borderBottomColor: BrandColors.helper,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setSelectedStatus(tab.key)}
          >
            <ThemedText
              style={[
                styles.tabText,
                {
                  color:
                    selectedStatus === tab.key
                      ? BrandColors.helper
                      : theme.tabIconDefault,
                  fontWeight: selectedStatus === tab.key ? "600" : "400",
                },
              ]}
            >
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.helper} />
        </View>
      ) : (
        <FlatList
          data={filteredIncidents}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="cash-outline" size={48} color={theme.tabIconDefault} />
              <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
                {selectedStatus === "pending"
                  ? "환불 대기 건이 없습니다"
                  : "환불 완료 건이 없습니다"}
              </ThemedText>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  orderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardBody: {
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  label: {
    fontSize: 14,
    width: 60,
  },
  value: {
    fontSize: 14,
    flex: 1,
  },
  confirmButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
  },
});
