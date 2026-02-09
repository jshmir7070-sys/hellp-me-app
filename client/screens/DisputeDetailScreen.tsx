import React, { useState } from "react";
import { View, ScrollView, StyleSheet, ActivityIndicator, Image, Pressable, Modal, Dimensions } from "react-native";
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

const DISPUTE_TYPE_LABELS: Record<string, string> = {
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

const { width: screenWidth } = Dimensions.get("window");

export default function DisputeDetailScreen({ route }: DisputeDetailScreenProps) {
  const { disputeId } = route.params;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: dispute, isLoading } = useQuery<DisputeDetail>({
    queryKey: ["/api/helper/disputes", disputeId],
    queryFn: async () => {
      const res = await fetch(`/api/helper/disputes/${disputeId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Failed to fetch dispute");
      return res.json();
    },
    enabled: !!disputeId,
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

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

  const statusConfig = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.pending;

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.md,
      }}
    >
      <Card variant="glass" padding="md" style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.typeContainer}>
            <Icon 
              name={dispute.disputeType === "freight_accident" ? "warning-outline" : "document-text-outline"} 
              size={20} 
              color={BrandColors.helper} 
            />
            <ThemedText style={[styles.typeText, { color: theme.text }]}>
              {DISPUTE_TYPE_LABELS[dispute.disputeType] || dispute.disputeType}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </ThemedText>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>작업일</ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>{formatDate(dispute.workDate)}</ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>접수일시</ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>{formatDate(dispute.createdAt)}</ThemedText>
          </View>
          {dispute.order ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>오더정보</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>
                #{dispute.order.id} {dispute.order.courierCompany}
              </ThemedText>
            </View>
          ) : null}
          {dispute.trackingNumber ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>운송장번호</ThemedText>
              <ThemedText style={[styles.value, { color: theme.text }]}>{dispute.trackingNumber}</ThemedText>
            </View>
          ) : null}
        </View>
      </Card>

      <Card variant="glass" padding="md" style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>이의제기 내용</ThemedText>
        <ThemedText style={[styles.description, { color: theme.text }]}>{dispute.description}</ThemedText>
        
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
        
        {dispute.evidencePhotoUrls && dispute.evidencePhotoUrls.length > 0 ? (
          <View style={styles.photoSection}>
            <ThemedText style={[styles.photoLabel, { color: theme.tabIconDefault }]}>증빙 사진</ThemedText>
            <View style={styles.photoGrid}>
              {dispute.evidencePhotoUrls.map((url, index) => (
                <Pressable key={index} onPress={() => setSelectedImage(url)}>
                  <Image source={{ uri: url }} style={styles.photoThumbnail} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </Card>

      {dispute.adminReply ? (
        <Card variant="outline" padding="md" style={[styles.card, styles.replyCard] as any}>
          <View style={styles.replyHeader}>
            <Icon name="chatbox-outline" size={18} color={BrandColors.helper} />
            <ThemedText style={[styles.sectionTitle, { color: theme.text, marginLeft: Spacing.xs }]}>관리자 답변</ThemedText>
          </View>
          <ThemedText style={[styles.replyText, { color: theme.text }]}>{dispute.adminReply}</ThemedText>
          <View style={styles.replyMeta}>
            {dispute.adminUserName ? (
              <ThemedText style={[styles.metaText, { color: theme.tabIconDefault }]}>
                답변자: {dispute.adminUserName}
              </ThemedText>
            ) : null}
            {dispute.adminReplyAt ? (
              <ThemedText style={[styles.metaText, { color: theme.tabIconDefault }]}>
                {formatDate(dispute.adminReplyAt)}
              </ThemedText>
            ) : null}
          </View>
        </Card>
      ) : null}

      {dispute.resolution ? (
        <Card variant="outline" padding="md" style={[styles.card, styles.resolutionCard] as any}>
          <View style={styles.replyHeader}>
            <Icon name="checkmark-circle-outline" size={18} color="#10B981" />
            <ThemedText style={[styles.sectionTitle, { color: theme.text, marginLeft: Spacing.xs }]}>처리결과</ThemedText>
          </View>
          <ThemedText style={[styles.replyText, { color: theme.text }]}>{dispute.resolution}</ThemedText>
          {dispute.resolvedAt ? (
            <ThemedText style={[styles.metaText, { color: theme.tabIconDefault, marginTop: Spacing.sm }]}>
              처리일시: {formatDate(dispute.resolvedAt)}
            </ThemedText>
          ) : null}
        </Card>
      ) : null}
    </ScrollView>
    
    <Modal
      visible={!!selectedImage}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedImage(null)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setSelectedImage(null)}>
        <View style={styles.modalContent}>
          {selectedImage ? (
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.fullImage} 
              resizeMode="contain"
            />
          ) : null}
          <Pressable style={styles.closeButton} onPress={() => setSelectedImage(null)}>
            <Icon name="close" size={28} color="#fff" />
          </Pressable>
        </View>
      </Pressable>
    </Modal>
    </>
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
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  typeText: {
    fontSize: 18,
    fontWeight: "700",
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginVertical: Spacing.md,
  },
  infoSection: {
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
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
  replyCard: {
    borderLeftWidth: 3,
    borderLeftColor: BrandColors.helper,
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  replyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  replyMeta: {
    marginTop: Spacing.sm,
    gap: 2,
  },
  metaText: {
    fontSize: 12,
  },
  resolutionCard: {
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
  },
  photoSection: {
    marginTop: Spacing.md,
  },
  photoLabel: {
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  photoThumbnail: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: screenWidth,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: screenWidth - 40,
    height: screenWidth - 40,
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    padding: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
  },
});
