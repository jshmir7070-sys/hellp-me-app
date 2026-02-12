import React from "react";
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { JobsStackParamList } from "@/navigation/types";

type DisputeListScreenProps = NativeStackScreenProps<JobsStackParamList, 'DisputeList'>;

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
  count_mismatch: "수량 불일치",
  amount_error: "금액 오류",
  freight_accident: "화물 사고",
  damage: "물품 파손",
  other: "기타",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "검토중", color: BrandColors.warning, bg: BrandColors.warningLight },
  reviewing: { label: "처리중", color: BrandColors.primaryLight, bg: BrandColors.helperLight },
  resolved: { label: "처리완료", color: BrandColors.success, bg: BrandColors.successLight },
  rejected: { label: "반려", color: BrandColors.error, bg: BrandColors.errorLight },
};

export default function DisputeListScreen({ navigation }: DisputeListScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const { data: disputes = [], isLoading, refetch, isRefetching } = useQuery<Dispute[]>({
    queryKey: ["/api/helper/disputes"],
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  };

  const renderDispute = ({ item }: { item: Dispute }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

    return (
      <Pressable onPress={() => navigation.navigate("DisputeDetail", { disputeId: item.id })}>
        <Card variant="glass" padding="md" style={styles.card}>
          <View style={styles.cardHeader}>
          <View style={styles.typeContainer}>
            <Icon 
              name={item.disputeType === "freight_accident" ? "warning-outline" : "document-text-outline"} 
              size={16} 
              color={BrandColors.helper} 
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
              작업일: {formatDate(item.workDate)}
            </ThemedText>
          </View>
          <ThemedText style={[styles.description, { color: theme.text }]} numberOfLines={2}>
            {item.description}
          </ThemedText>
          {item.requestedAmount ? (
            <ThemedText style={styles.amount}>
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
      <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
        접수된 이의제기가 없습니다
      </ThemedText>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.helper} />
        </View>
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderDispute}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + 80,
            paddingHorizontal: Spacing.md,
            flexGrow: 1,
          }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        />
      )}

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={() => navigation.navigate("DisputeCreate", {})}
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
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  typeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  typeText: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardBody: {
    gap: Spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  infoText: {
    fontSize: 14,
  },
  description: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  amount: {
    fontSize: 14,
    fontWeight: "600",
    color: BrandColors.helper,
    marginTop: Spacing.xs,
  },
  resolvedSection: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  resolvedLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  resolvedAmount: {
    fontSize: 16,
    fontWeight: "600",
  },
  resolvedNote: {
    fontSize: 14,
    marginTop: 4,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
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
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
  },
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.helper,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
