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

interface Incident {
  id: number;
  orderId: number;
  incidentType: string;
  status: string;
  description: string;
  damageAmount: number | null;
  helperName: string | null;
  requesterName: string | null;
  helperStatus: string | null;
  createdAt: string;
}

type AdminIncidentListScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const STATUS_TABS = [
  { key: "all", label: "전체" },
  { key: "requested", label: "접수됨" },
  { key: "reviewing", label: "검토중" },
  { key: "resolved", label: "해결됨" },
  { key: "rejected", label: "기각됨" },
];

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    requested: "접수됨",
    reviewing: "검토중",
    resolved: "해결됨",
    rejected: "기각됨",
  };
  return map[status] || status;
};

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    requested: BrandColors.warning,
    reviewing: BrandColors.helper,
    resolved: BrandColors.success,
    rejected: BrandColors.error,
  };
  return map[status] || "#888";
};

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

const getHelperStatusLabel = (status: string | null) => {
  if (!status) return "미응답";
  const map: Record<string, string> = {
    item_found: "물품 발견",
    request_handling: "처리 요청",
    confirmed: "인정",
    dispute: "이의제기",
  };
  return map[status] || status;
};

export default function AdminIncidentListScreen({ navigation }: AdminIncidentListScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [selectedStatus, setSelectedStatus] = useState("all");

  const { data: incidents, isLoading, refetch, isRefetching } = useQuery<Incident[]>({
    queryKey: ["/api/admin/incident-reports"],
  });

  const filteredIncidents = incidents?.filter(
    (d) => selectedStatus === "all" || d.status === selectedStatus
  );

  const renderIncident = ({ item }: { item: Incident }) => (
    <Pressable
      onPress={() => navigation.navigate("AdminIncidentDetail" as any, { incidentId: item.id })}
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
              헬퍼
            </ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>
              {item.helperName || "-"}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
              헬퍼응답
            </ThemedText>
            <ThemedText style={[styles.value, { color: item.helperStatus ? theme.text : BrandColors.warning }]}>
              {getHelperStatusLabel(item.helperStatus)}
            </ThemedText>
          </View>
          {item.damageAmount ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
                피해금액
              </ThemedText>
              <ThemedText style={[styles.value, { color: BrandColors.error }]}>
                {item.damageAmount.toLocaleString()}원
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
          data={filteredIncidents}
          renderItem={renderIncident}
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
              <Icon name="warning-outline" size={48} color={theme.tabIconDefault} />
              <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
                화물사고 접수 내역이 없습니다
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
    fontSize: 12,
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
