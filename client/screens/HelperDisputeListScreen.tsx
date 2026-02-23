import React from "react";
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";

type ProfileStackParamList = {
  HelperDisputeList: undefined;
  HelperDisputeDetail: { disputeId: number };
  HelperDisputeSubmit: { orderId?: number; workDate?: string; orderTitle?: string } | undefined;
};

type HelperDisputeListScreenProps = NativeStackScreenProps<ProfileStackParamList, 'HelperDisputeList'>;

interface Dispute {
  id: number;
  orderId: number | null;
  workDate: string;
  disputeType: string;
  description: string;
  status: string;
  courierName?: string;
  createdAt: string;
  adminReply?: string;
  resolvedNote?: string | null;
  resolvedAt?: string | null;
}

const DISPUTE_TYPE_LABELS: Record<string, string> = {
  settlement_error: "정산",
  invoice_error: "세금계산서",
  service_complaint: "요청자 불만",
  count_mismatch: "수량 오류",
  amount_error: "금액 오류",
  delivery_issue: "배송 문제",
  lost: "분실",
  wrong_delivery: "오배송",
  other: "기타",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "검토중", color: "#F59E0B", bg: "#FEF3C7" },
  reviewing: { label: "처리중", color: "#3B82F6", bg: "#DBEAFE" },
  resolved: { label: "처리완료", color: "#10B981", bg: "#D1FAE5" },
  rejected: { label: "반려", color: "#EF4444", bg: "#FEE2E2" },
};

export default function HelperDisputeListScreen({ navigation }: HelperDisputeListScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();

  const { data: disputes = [], isLoading, refetch, isRefetching } = useQuery<Dispute[]>({
    queryKey: ['/api/helper/disputes'],
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const renderItem = ({ item }: { item: Dispute }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const typeLabel = DISPUTE_TYPE_LABELS[item.disputeType] || item.disputeType;

    return (
      <Pressable onPress={() => navigation.navigate('HelperDisputeDetail', { disputeId: item.id })}>
        <Card style={styles.card}>
          {/* 헤더: 유형 아이콘+라벨 / 상태 배지 */}
          <View style={styles.cardHeader}>
            <View style={styles.typeContainer}>
              <Icon
                name="document-text-outline"
                size={16}
                color={BrandColors.helper}
              />
              <ThemedText style={[styles.typeText, { color: theme.text }]}>
                {typeLabel}
              </ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </ThemedText>
            </View>
          </View>

          {/* 본문 */}
          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <Icon name="calendar-outline" size={14} color={theme.tabIconDefault} />
              <ThemedText style={[styles.infoText, { color: theme.tabIconDefault }]}>
                근무일: {formatDate(item.workDate)}
              </ThemedText>
            </View>
            <ThemedText
              style={[styles.descriptionText, { color: theme.text }]}
              numberOfLines={2}
            >
              {item.description}
            </ThemedText>
          </View>

          {/* 관리자 응답 (처리완료 시) */}
          {item.status === "resolved" && item.resolvedNote ? (
            <View style={[styles.resolvedSection, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.resolvedLabel, { color: theme.tabIconDefault }]}>처리 결과</ThemedText>
              <ThemedText style={[styles.resolvedNote, { color: theme.text }]}>
                {item.resolvedNote}
              </ThemedText>
            </View>
          ) : null}

          {/* 푸터 */}
          <View style={styles.cardFooter}>
            <ThemedText style={[styles.dateText, { color: theme.tabIconDefault }]}>
              접수: {formatDate(item.createdAt)}
            </ThemedText>
            <View style={styles.footerRight}>
              {item.adminReply ? (
                <View style={styles.replyBadge}>
                  <Icon name="chatbubble-ellipses-outline" size={12} color={BrandColors.helper} />
                  <ThemedText style={[styles.replyText, { color: BrandColors.helper }]}>
                    답변 있음
                  </ThemedText>
                </View>
              ) : null}
              <Icon name="chevron-forward-outline" size={18} color={theme.tabIconDefault} />
            </View>
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
        정산 관련 문제가 있으면 이의제기를 접수하세요
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <FlatList
        data={disputes}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingHorizontal: Spacing.lg,
          paddingBottom: showDesktopLayout ? Spacing.xl : tabBarHeight + Spacing.xl,
          flexGrow: 1,
          ...(showDesktopLayout && {
            maxWidth: containerMaxWidth,
            alignSelf: 'center' as const,
            width: '100%' as any,
          }),
        }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      />
      <Pressable
        style={[styles.fab, { backgroundColor: BrandColors.helper }]}
        onPress={() => navigation.navigate('HelperDisputeSubmit')}
      >
        <Icon name="add-outline" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
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
  resolvedNote: {
    fontSize: 13,
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
  dateText: {
    fontSize: 12,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  replyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  replyText: {
    fontSize: 12,
    fontWeight: "500",
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
