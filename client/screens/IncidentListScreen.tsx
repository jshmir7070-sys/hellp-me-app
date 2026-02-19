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

type ProfileStackParamList = {
  IncidentList: undefined;
  IncidentDetail: { incidentId: number };
};

type IncidentListScreenProps = NativeStackScreenProps<ProfileStackParamList, 'IncidentList'>;

interface Incident {
  id: number;
  orderId: number | null;
  incidentType: string;
  description: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedNote: string | null;
  helperStatus: string | null;
  trackingNumber: string | null;
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  damage: "파손",
  loss: "분실",
  misdelivery: "오배송",
  delay: "지연",
  other: "기타",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "접수됨", color: "#F59E0B", bg: "#FEF3C7" },
  reviewing: { label: "처리중", color: "#3B82F6", bg: "#DBEAFE" },
  resolved: { label: "처리완료", color: "#10B981", bg: "#D1FAE5" },
  rejected: { label: "반려", color: "#EF4444", bg: "#FEE2E2" },
};

export default function IncidentListScreen({ navigation }: IncidentListScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const { data: incidents = [], isLoading, refetch, isRefetching } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  };

  const renderIncident = ({ item }: { item: Incident }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

    return (
      <Pressable onPress={() => navigation.navigate("IncidentDetail", { incidentId: item.id })}>
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.typeContainer}>
              <Icon 
                name="alert-circle-outline" 
                size={16} 
                color={BrandColors.error} 
              />
              <ThemedText style={[styles.typeText, { color: theme.text }]}>
                {INCIDENT_TYPE_LABELS[item.incidentType] || item.incidentType}
              </ThemedText>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </ThemedText>
            </View>
          </View>

          <View style={styles.cardBody}>
            {item.orderId ? (
              <View style={styles.infoRow}>
                <Icon name="document-outline" size={14} color={theme.tabIconDefault} />
                <ThemedText style={[styles.infoText, { color: theme.tabIconDefault }]}>
                  주문번호: #{item.orderId}
                </ThemedText>
              </View>
            ) : null}
            {item.trackingNumber ? (
              <View style={styles.infoRow}>
                <Icon name="barcode-outline" size={14} color={theme.tabIconDefault} />
                <ThemedText style={[styles.infoText, { color: theme.tabIconDefault }]}>
                  송장: {item.trackingNumber}
                </ThemedText>
              </View>
            ) : null}
            <ThemedText style={[styles.description, { color: theme.text }]} numberOfLines={2}>
              {item.description}
            </ThemedText>
          </View>

          {item.status === "resolved" && item.resolvedNote ? (
            <View style={[styles.resolvedSection, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.resolvedLabel, { color: theme.tabIconDefault }]}>처리 결과</ThemedText>
              <ThemedText style={[styles.resolvedNote, { color: theme.text }]}>
                {item.resolvedNote}
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.cardFooter}>
            <ThemedText style={[styles.createdAt, { color: theme.tabIconDefault }]}>
              접수: {formatDate(item.createdAt)}
            </ThemedText>
            <View style={styles.footerRight}>
              {!item.helperStatus && item.status !== 'resolved' && item.status !== 'rejected' ? (
                <View style={styles.responseNeededBadge}>
                  <ThemedText style={styles.responseNeededText}>응답 필요</ThemedText>
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
      <Icon name="shield-checkmark-outline" size={48} color={theme.tabIconDefault} />
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        접수된 사고가 없습니다
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
        화물 사고 발생 시 사용 이력에서 해당 주문을 선택하여 접수하세요
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
        data={incidents}
        renderItem={renderIncident}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={BrandColors.requester}
          />
        }
      />
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
  listContent: {
    paddingHorizontal: Spacing.lg,
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
    fontWeight: "600",
    fontSize: 15,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardBody: {
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: 13,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  resolvedSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  resolvedLabel: {
    fontSize: 12,
    marginBottom: Spacing.xs,
  },
  resolvedNote: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  createdAt: {
    fontSize: 12,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  responseNeededBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  responseNeededText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#EF4444",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
