import React from "react";
import { View, FlatList, Pressable, StyleSheet, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/Icon";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";

type ProfileStackParamList = {
  HelperDisputeList: undefined;
  HelperDisputeDetail: { disputeId: number };
  HelperDisputeSubmit: undefined;
};

type HelperDisputeListScreenProps = NativeStackScreenProps<ProfileStackParamList, 'HelperDisputeList'>;

interface Dispute {
  id: number;
  workDate: string;
  disputeType: string;
  status: string;
  courierName?: string;
  description: string;
  createdAt: string;
  adminReply?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "대기중", color: BrandColors.warning },
  reviewing: { label: "검토중", color: BrandColors.info },
  resolved: { label: "완료", color: BrandColors.success },
  rejected: { label: "기각", color: BrandColors.error },
};

const TYPE_MAP: Record<string, string> = {
  count_mismatch: "수량 오류",
  amount_error: "금액 오류",
  delivery_issue: "배송 문제",
  other: "기타",
};

export default function HelperDisputeListScreen({ navigation }: HelperDisputeListScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const { data: disputes = [], isLoading, refetch } = useQuery<Dispute[]>({
    queryKey: ['/api/helper/disputes'],
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const renderItem = ({ item }: { item: Dispute }) => {
    const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.pending;
    const typeLabel = TYPE_MAP[item.disputeType] || item.disputeType;

    return (
      <Pressable
        onPress={() => navigation.navigate('HelperDisputeDetail', { disputeId: item.id })}
      >
        <Card variant="glass" padding="md" style={styles.disputeCard}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
                <ThemedText style={[styles.statusText, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </ThemedText>
              </View>
              <ThemedText style={[styles.typeText, { color: theme.tabIconDefault }]}>
                {typeLabel}
              </ThemedText>
            </View>
            <Icon name="chevron-forward-outline" size={20} color={theme.tabIconDefault} />
          </View>

          <View style={styles.cardBody}>
            {item.courierName ? (
              <View style={styles.infoRow}>
                <Icon name="business-outline" size={14} color={theme.tabIconDefault} />
                <ThemedText style={[styles.infoText, { color: theme.text }]}>
                  {item.courierName}
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Icon name="calendar-outline" size={14} color={theme.tabIconDefault} />
              <ThemedText style={[styles.infoText, { color: theme.text }]}>
                근무일: {item.workDate}
              </ThemedText>
            </View>
            <ThemedText 
              style={[styles.descriptionText, { color: theme.tabIconDefault }]}
              numberOfLines={2}
            >
              {item.description}
            </ThemedText>
          </View>

          <View style={styles.cardFooter}>
            <ThemedText style={[styles.dateText, { color: theme.tabIconDefault }]}>
              접수일: {formatDate(item.createdAt)}
            </ThemedText>
            {item.adminReply ? (
              <View style={styles.replyBadge}>
                <Icon name="chatbubble-ellipses-outline" size={12} color={BrandColors.helper} />
                <ThemedText style={[styles.replyText, { color: BrandColors.helper }]}>
                  답변 있음
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Card>
      </Pressable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="document-text-outline" size={48} color={theme.tabIconDefault} />
      <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
        접수한 이의제기가 없습니다
      </ThemedText>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <FlatList
        data={disputes}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl + 80,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      />
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + Spacing.lg }]}
        onPress={() => navigation.navigate('HelperDisputeSubmit')}
      >
        <Icon name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  disputeCard: {},
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
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
  typeText: {
    fontSize: 13,
  },
  cardBody: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  infoText: {
    fontSize: 14,
  },
  descriptionText: {
    fontSize: 13,
    marginTop: Spacing.xs,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
    paddingTop: Spacing.sm,
  },
  dateText: {
    fontSize: 12,
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
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 15,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.helper,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
