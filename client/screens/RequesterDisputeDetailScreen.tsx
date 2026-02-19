import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { DisputeDetailView } from "@/components/disputes/DisputeDetailView";
import { DISPUTE_STATUS_CONFIG } from "@/constants/dispute";

type RequesterDisputeDetailScreenProps = NativeStackScreenProps<any, 'RequesterDisputeDetail'>;

interface DisputeDetail {
  id: number;
  orderId: number | null;
  workDate: string;
  disputeType: string;
  description: string;
  requestedAmount: number | null;
  status: string;
  resolvedAmount: number | null;
  resolvedNote: string | null;
  adminReply: string | null;
  createdAt: string;
  resolvedAt: string | null;
  helperName: string | null;
  evidencePhotoUrls?: string[];
  order?: {
    id: number;
    courierCompany: string;
    pickupAddress: string;
  } | null;
}

export default function RequesterDisputeDetailScreen({ route }: RequesterDisputeDetailScreenProps) {
  const { disputeId } = route.params || {};
  const { theme } = useTheme();

  const { data: dispute, isLoading } = useQuery<DisputeDetail>({
    queryKey: ["/api/requester/disputes", disputeId],
    enabled: !!disputeId,
  });

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.requester} />
      </View>
    );
  }

  if (!dispute) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Icon name="alert-circle-outline" size={48} color={theme.tabIconDefault} />
        <ThemedText style={{ color: theme.tabIconDefault }}>이의제기를 찾을 수 없습니다</ThemedText>
      </View>
    );
  }

  return (
    <DisputeDetailView dispute={dispute} statusLabels={DISPUTE_STATUS_CONFIG}>
      {dispute.requestedAmount ? (
        <View style={[styles.amountSection, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>요청 금액</ThemedText>
          <ThemedText style={[styles.amountValue, { color: BrandColors.requester }]}>
            {dispute.requestedAmount.toLocaleString()}원
          </ThemedText>
        </View>
      ) : null}

      {dispute.helperName ? (
        <View style={[styles.infoRow, { marginTop: Spacing.sm }]}>
          <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>담당 헬퍼: </ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>{dispute.helperName}</ThemedText>
        </View>
      ) : null}
    </DisputeDetailView>
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
    gap: Spacing.md,
  },
  amountSection: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 14,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
  }
});
