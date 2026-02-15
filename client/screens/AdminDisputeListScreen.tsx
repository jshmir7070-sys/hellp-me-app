import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";

interface Dispute {
  id: number;
  orderId: number;
  submitterRole: string;
  submitterName: string;
  disputeType: string;
  status: string;
  description: string;
  createdAt: string;
}

type AdminDisputeListScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const STATUS_TABS = [
  { key: "all", label: "전체" },
  { key: "pending", label: "대기중" },
  { key: "in_review", label: "검토중" },
  { key: "resolved", label: "처리완료" },
];

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

export default function AdminDisputeListScreen({ navigation }: AdminDisputeListScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [selectedStatus, setSelectedStatus] = useState("all");

  const { data: disputes, isLoading, refetch, isRefetching } = useQuery<Dispute[]>({
    queryKey: ["/api/admin/helper-disputes"],
  });

  const filteredDisputes = disputes?.filter(
    (d) => selectedStatus === "all" || d.status === selectedStatus
  );

  const renderDispute = ({ item }: { item: Dispute }) => (
    <Pressable
      onPress={() => navigation.navigate("AdminDisputeDetail", { disputeId: item.id })}
    >
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.orderInfo}>
            <ThemedText style={[styles.orderId, { color: theme.text }]}>
              오더 #{item.orderId}
            </ThemedText>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) + "20" },
              ]}
            >
              <ThemedText
                style={[styles.statusText, { color: getStatusColor(item.status) }]}
              >
                {getStatusLabel(item.status)}
              </ThemedText>
            </View>
          </View>
          <Icon name="chevron-forward-outline" size={20} color={theme.tabIconDefault} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
              제기자
            </ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>
              {item.submitterName} ({item.submitterRole === "helper" ? "헬퍼" : "요청자"})
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
              유형
            </ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>
              {getDisputeTypeLabel(item.disputeType)}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
              접수일
            </ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>
              {format(new Date(item.createdAt), "yyyy.MM.dd HH:mm", { locale: ko })}
            </ThemedText>
          </View>
        </View>

        <ThemedText
          style={[styles.description, { color: theme.tabIconDefault }]}
          numberOfLines={2}
        >
          {item.description}
        </ThemedText>
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
          data={filteredDisputes}
          renderItem={renderDispute}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="document-text-outline" size={48} color={theme.tabIconDefault} />
              <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
                이의제기 내역이 없습니다
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
    width: 50,
  },
  value: {
    fontSize: 14,
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
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
