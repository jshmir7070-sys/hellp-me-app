import React, { useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { JobsStackParamList } from "@/navigation/types";
import { DisputeDetailView } from "@/components/disputes/DisputeDetailView";
import { DISPUTE_STATUS_CONFIG } from "@/constants/dispute";

type DisputeDetailScreenProps = NativeStackScreenProps<JobsStackParamList, 'DisputeDetail'>;

interface DisputeDetail {
  id: number;
  orderId: number | null;
  workDate: string;
  disputeType: string;
  description: string;
  trackingNumber: string | null;
  requestedDeliveryCount: number | null;
  requestedReturnCount: number | null;
  requestedPickupCount: number | null;
  requestedOtherCount: number | null;
  status: string;
  resolution: string | null;
  adminReply: string | null;
  adminReplyAt: string | null;
  adminUserName: string | null;
  createdAt: string;
  resolvedAt: string | null;
  evidencePhotoUrls?: string[];
  order?: {
    id: number;
    courierCompany: string;
    pickupAddress: string;
  } | null;
}

export default function DisputeDetailScreen({ route }: DisputeDetailScreenProps) {
  const { disputeId } = route.params;
  const { theme } = useTheme();

  const { data: dispute, isLoading } = useQuery<DisputeDetail>({
    queryKey: ["/api/helper/disputes", disputeId],
    queryFn: async () => {
      const token = await AsyncStorage.getItem("authToken");
      const res = await fetch(`/api/helper/disputes/${disputeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch dispute");
      return res.json();
    },
    enabled: !!disputeId,
  });

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
        <Icon name="alert-circle-outline" size={48} color={theme.tabIconDefault} />
        <ThemedText style={{ color: theme.tabIconDefault }}>이의제기를 찾을 수 없습니다</ThemedText>
      </View>
    );
  }

  return (
    <DisputeDetailView dispute={dispute} statusLabels={DISPUTE_STATUS_CONFIG}>
      {(dispute.requestedDeliveryCount || dispute.requestedReturnCount || dispute.requestedPickupCount || dispute.requestedOtherCount) ? (
        <View style={[styles.countSection, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.countLabel, { color: theme.tabIconDefault }]}>요청 수량</ThemedText>
          <View style={styles.countGrid}>
            {dispute.requestedDeliveryCount ? (
              <ThemedText style={[styles.countItem, { color: theme.text }]}>배송: {dispute.requestedDeliveryCount}건</ThemedText>
            ) : null}
            {dispute.requestedReturnCount ? (
              <ThemedText style={[styles.countItem, { color: theme.text }]}>회수: {dispute.requestedReturnCount}건</ThemedText>
            ) : null}
            {dispute.requestedPickupCount ? (
              <ThemedText style={[styles.countItem, { color: theme.text }]}>픽업: {dispute.requestedPickupCount}건</ThemedText>
            ) : null}
            {dispute.requestedOtherCount ? (
              <ThemedText style={[styles.countItem, { color: theme.text }]}>기타: {dispute.requestedOtherCount}건</ThemedText>
            ) : null}
          </View>
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
  countSection: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  countLabel: {
    fontSize: 13,
    marginBottom: Spacing.xs,
  },
  countGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  countItem: {
    fontSize: 14,
    fontWeight: "500",
  },
});
