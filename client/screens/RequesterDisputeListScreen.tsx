import React from "react";
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";

type ProfileStackParamList = {
  RequesterDisputeList: undefined;
  RequesterDispute: { orderId: number };
  RequesterDisputeDetail: { disputeId: number };
};

type RequesterDisputeListScreenProps = NativeStackScreenProps<ProfileStackParamList, 'RequesterDisputeList'>;

interface Dispute {
  id: number;
  orderId: number | null;
  workDate: string;
  disputeType: string;
  description: string;
  requestedAmount: number | null;
  status: string;
  resolvedAmount: number | null;
  resolvedNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

const DISPUTE_TYPE_LABELS: Record<string, string> = {
  settlement_error: "정산오류",
  invoice_error: "세금계산서 오류",
  contract_dispute: "계약조건분쟁",
  service_complaint: "서비스불만",
  delay: "일정관련",
  no_show: "노쇼",
  count_mismatch: "수량 불일치",
  amount_error: "금액 오류",
  freight_accident: "화물 사고",
  damage: "물품 파손",
  other: "기타",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "검토중", color: "#F59E0B", bg: "#FEF3C7" },
  reviewing: { label: "처리중", color: "#3B82F6", bg: "#DBEAFE" },
  resolved: { label: "처리완료", color: "#10B981", bg: "#D1FAE5" },
  rejected: { label: "반려", color: "#EF4444", bg: "#FEE2E2" },
};

export default function RequesterDisputeListScreen({ navigation }: RequesterDisputeListScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();

  const { data: disputes = [], isLoading, refetch, isRefetching } = useQuery<Dispute[]>({
    queryKey: ["/api/requester/disputes"],
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  };

  const handleNewDispute = () => {
    navigation.navigate('RequesterDispute', { orderId: 0 });
  };

  const renderDispute = ({ item }: { item: Dispute }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

    return (
      <Pressable onPress={() => navigation.navigate("RequesterDisputeDetail", { disputeId: item.id })}>
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.typeContainer}>
              <Icon 
                name={item.disputeType === "freight_accident" || item.disputeType === "damage" ? "warning-outline" : "document-text-outline"} 
                size={16} 
                color={BrandColors.requester} 
              />
            <ThemedText style={[styles.typeText, { color: theme.text }]}>
              {DISPUTE_TYPE_LABELS[item.disputeType] || item.disputeType}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </ThemedText>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Icon name="calendar-outline" size={14} color={theme.tabIconDefault} />
            <ThemedText style={[styles.infoText, { color: theme.tabIconDefault }]}>
              문제 발생일: {formatDate(item.workDate)}
            </ThemedText>
          </View>
          <ThemedText style={[styles.description, { color: theme.text }]} numberOfLines={2}>
            {item.description}
          </ThemedText>
          {item.requestedAmount ? (
            <ThemedText style={[styles.amount, { color: BrandColors.requester }]}>
              요청금액: {item.requestedAmount.toLocaleString()}원
            </ThemedText>
          ) : null}
        </View>

        {item.status === "resolved" && item.resolvedAmount !== null ? (
          <View style={[styles.resolvedSection, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.resolvedLabel, { color: theme.tabIconDefault }]}>처리 결과</ThemedText>
            <ThemedText style={[styles.resolvedAmount, { color: theme.text }]}>
              {item.resolvedAmount.toLocaleString()}원 {item.resolvedAmount > 0 ? "지급 확정" : "미지급"}
            </ThemedText>
            {item.resolvedNote ? (
              <ThemedText style={[styles.resolvedNote, { color: theme.tabIconDefault }]}>
                {item.resolvedNote}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

          <View style={styles.cardFooter}>
            <ThemedText style={[styles.createdAt, { color: theme.tabIconDefault }]}>
              접수: {formatDate(item.createdAt)}
            </ThemedText>
            <Icon name="chevron-forward-outline" size={18} color={theme.tabIconDefault} />
          </View>
        </Card>
      </Pressable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="inbox-outline" size={48} color={theme.tabIconDefault} />
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        이의제기 내역이 없습니다
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
        문제가 발생한 경우 새로운 이의제기를 접수하세요
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.requester} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={disputes}
        renderItem={renderDispute}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingHorizontal: Spacing.lg,
          paddingBottom: showDesktopLayout ? Spacing.xl : tabBarHeight + Spacing.xl,
          ...(showDesktopLayout && {
            maxWidth: containerMaxWidth,
            alignSelf: 'center' as const,
            width: '100%' as any,
          }),
        }}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      />

      <Pressable
        style={[styles.fab, { backgroundColor: BrandColors.requester }]}
        onPress={handleNewDispute}
      >
        <Icon name="add-outline" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  typeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  typeText: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardBody: {
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  infoText: {
    fontSize: 13,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  amount: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  resolvedSection: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  resolvedLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  resolvedAmount: {
    fontSize: 15,
    fontWeight: "600",
  },
  resolvedNote: {
    fontSize: 13,
    marginTop: Spacing.xs,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  createdAt: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
