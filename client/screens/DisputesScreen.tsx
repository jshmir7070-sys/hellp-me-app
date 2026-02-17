import React, { useState } from "react";
import { View, FlatList, Pressable, StyleSheet, ScrollView, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { ProfileStackParamList } from "@/navigation/types";

type DisputesScreenProps = NativeStackScreenProps<ProfileStackParamList, 'Disputes'>;

interface Dispute {
  id: number;
  orderId: number | null;
  courierName: string | null;
  workDate: string;
  disputeType: string;
  description: string;
  status: string;
  resolution: string | null;
  adminReply: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface HelperOrder {
  id: number;
  companyName: string;
  deliveryArea: string;
  scheduledDate: string;
  status: string;
  pricePerUnit: number;
  averageQuantity: string;
}

const DISPUTE_TYPE_LABELS: Record<string, string> = {
  count_mismatch: "수량 불일치",
  amount_error: "금액 오류",
  freight_accident: "화물 사고",
  damage: "물품 파손",
  lost: "분실",
  wrong_delivery: "오배송",
  other: "기타",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: "검토중", color: "#F59E0B", bg: "#FEF3C7", icon: "time-outline" },
  reviewing: { label: "처리중", color: "#3B82F6", bg: "#DBEAFE", icon: "eye-outline" },
  resolved: { label: "처리완료", color: "#10B981", bg: "#D1FAE5", icon: "checkmark-circle-outline" },
  rejected: { label: "반려", color: "#EF4444", bg: "#FEE2E2", icon: "close-circle-outline" },
};

// 이의제기 가능한 오더 상태
const DISPUTABLE_STATUSES = [
  "in_progress", "closing_submitted", "final_amount_confirmed",
  "balance_paid", "settlement_paid", "completed", "closed",
];

export default function DisputesScreen({ navigation }: DisputesScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const [showOrderPicker, setShowOrderPicker] = useState(false);

  const { data: disputes = [], isLoading, refetch } = useQuery<Dispute[]>({
    queryKey: ["/api/helper/disputes"],
  });

  // 헬퍼의 오더 목록 (이의제기 가능한 오더만)
  const { data: myOrders = [] } = useQuery<HelperOrder[]>({
    queryKey: ["/api/helper/my-orders"],
  });

  const disputeableOrders = myOrders.filter(o => DISPUTABLE_STATUSES.includes(o.status));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  };

  // 통계
  const stats = {
    total: disputes.length,
    pending: disputes.filter(d => d.status === 'pending' || d.status === 'reviewing').length,
    resolved: disputes.filter(d => d.status === 'resolved').length,
    rejected: disputes.filter(d => d.status === 'rejected').length,
  };

  const handleCreateDispute = () => {
    if (disputeableOrders.length === 0) {
      // 오더가 없으면 바로 이동 (orderId 없이)
      navigation.navigate("DisputeCreate", {});
    } else {
      // 오더 선택 모달 표시
      setShowOrderPicker(true);
    }
  };

  const selectOrder = (orderId: number) => {
    setShowOrderPicker(false);
    navigation.navigate("DisputeCreate", { orderId });
  };

  const renderDispute = ({ item }: { item: Dispute }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

    return (
      <Pressable
        onPress={() => navigation.navigate("DisputeDetail", { disputeId: item.id })}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        <Card style={styles.disputeCard}>
          <View style={styles.cardHeader}>
            <View style={styles.typeContainer}>
              <View style={[styles.typeIconBg, { backgroundColor: BrandColors.helperLight }]}>
                <Icon
                  name={item.disputeType === "freight_accident" ? "warning-outline" : "document-text-outline"}
                  size={18}
                  color={BrandColors.helper}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.typeText, { color: theme.text }]}>
                  {DISPUTE_TYPE_LABELS[item.disputeType] || item.disputeType}
                </ThemedText>
                <ThemedText style={[styles.workDate, { color: theme.tabIconDefault }]}>
                  작업일: {item.workDate}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Icon name={statusConfig.icon as any} size={14} color={statusConfig.color} />
              <ThemedText style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.description, { color: theme.tabIconDefault }]} numberOfLines={2}>
            {item.description}
          </ThemedText>

          <View style={styles.cardFooter}>
            <View style={styles.amountRow}>
              {item.courierName && (
                <View style={styles.amountItem}>
                  <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                    운송사
                  </ThemedText>
                  <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                    {item.courierName}
                  </ThemedText>
                </View>
              )}
              {item.orderId && (
                <View style={styles.amountItem}>
                  <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                    오더번호
                  </ThemedText>
                  <ThemedText style={[styles.amountValue, { color: BrandColors.helper }]}>
                    O-{item.orderId}
                  </ThemedText>
                </View>
              )}
            </View>
            <ThemedText style={[styles.dateText, { color: theme.tabIconDefault }]}>
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>

          {item.adminReply && (
            <View style={[styles.resolvedNote, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderColor: isDark ? '#374151' : '#E5E7EB' }]}>
              <Icon name="chatbubble-outline" size={14} color={theme.tabIconDefault} />
              <ThemedText style={[styles.resolvedNoteText, { color: theme.tabIconDefault }]} numberOfLines={1}>
                {item.adminReply}
              </ThemedText>
            </View>
          )}
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl + 40,
          paddingHorizontal: Spacing.lg,
        }}
      >
        {/* 이의제기 접수 버튼 */}
        <Pressable
          onPress={handleCreateDispute}
          style={({ pressed }) => [
            styles.createButton,
            {
              backgroundColor: BrandColors.helper,
              opacity: pressed ? 0.8 : 1,
            }
          ]}
        >
          <View style={styles.createButtonContent}>
            <View style={styles.createButtonLeft}>
              <View style={styles.createIconBg}>
                <Icon name="add-circle-outline" size={32} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.createButtonTitle}>
                  이의제기 접수
                </ThemedText>
                <ThemedText style={styles.createButtonDesc}>
                  정산 오류, 수량 차이 등 접수
                </ThemedText>
              </View>
            </View>
            <Icon name="chevron-forward-outline" size={24} color="#FFFFFF" />
          </View>
        </Pressable>

        {/* 통계 카드 */}
        {disputes.length > 0 && (
          <Card style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText style={[styles.statValue, { color: theme.text }]}>
                  {stats.total}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>
                  전체
                </ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <ThemedText style={[styles.statValue, { color: '#F59E0B' }]}>
                  {stats.pending}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>
                  처리중
                </ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <ThemedText style={[styles.statValue, { color: '#10B981' }]}>
                  {stats.resolved}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>
                  완료
                </ThemedText>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <ThemedText style={[styles.statValue, { color: '#EF4444' }]}>
                  {stats.rejected}
                </ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>
                  반려
                </ThemedText>
              </View>
            </View>
          </Card>
        )}

        {/* 이의제기 목록 제목 */}
        <View style={styles.listHeader}>
          <ThemedText style={[styles.listTitle, { color: theme.text }]}>
            이의제기 내역
          </ThemedText>
          {disputes.length > 0 && (
            <ThemedText style={[styles.listCount, { color: theme.tabIconDefault }]}>
              {disputes.length}건
            </ThemedText>
          )}
        </View>

        {/* 이의제기 목록 */}
        {isLoading ? (
          <Card style={styles.emptyCard}>
            <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
              로딩중...
            </ThemedText>
          </Card>
        ) : disputes.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name="document-text-outline" size={48} color={theme.tabIconDefault} style={{ opacity: 0.3 }} />
            <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
              이의제기 내역이 없습니다
            </ThemedText>
            <ThemedText style={[styles.emptyHint, { color: theme.tabIconDefault }]}>
              정산 오류나 수량 차이가 있을 경우{'\n'}위의 버튼을 눌러 이의제기를 접수하세요
            </ThemedText>
          </Card>
        ) : (
          <View style={styles.listContainer}>
            {disputes.map((item) => (
              <View key={item.id}>
                {renderDispute({ item })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 오더 선택 모달 */}
      <Modal
        visible={showOrderPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOrderPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                오더 선택
              </ThemedText>
              <Pressable onPress={() => setShowOrderPicker(false)}>
                <Icon name="close" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ThemedText style={[styles.modalSubtitle, { color: theme.tabIconDefault }]}>
              이의제기할 오더를 선택하세요
            </ThemedText>

            <ScrollView style={styles.orderList} showsVerticalScrollIndicator={false}>
              {disputeableOrders.map((order) => (
                <Pressable
                  key={order.id}
                  style={({ pressed }) => [
                    styles.orderItem,
                    {
                      backgroundColor: pressed
                        ? (isDark ? '#374151' : '#F3F4F6')
                        : (isDark ? '#1F2937' : '#FFFFFF'),
                      borderColor: isDark ? '#374151' : '#E5E7EB',
                    },
                  ]}
                  onPress={() => selectOrder(order.id)}
                >
                  <View style={styles.orderItemLeft}>
                    <View style={[styles.orderItemIcon, { backgroundColor: BrandColors.helperLight }]}>
                      <Icon name="cube-outline" size={20} color={BrandColors.helper} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.orderItemTitle, { color: theme.text }]}>
                        {order.companyName}
                      </ThemedText>
                      <View style={styles.orderItemMeta}>
                        <ThemedText style={[styles.orderItemDate, { color: theme.tabIconDefault }]}>
                          {order.scheduledDate}
                        </ThemedText>
                        <ThemedText style={[styles.orderItemArea, { color: theme.tabIconDefault }]}>
                          {order.deliveryArea}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  <View style={styles.orderItemRight}>
                    <ThemedText style={[styles.orderItemNumber, { color: BrandColors.helper }]}>
                      O-{order.id}
                    </ThemedText>
                    <Icon name="chevron-forward-outline" size={18} color={theme.tabIconDefault} />
                  </View>
                </Pressable>
              ))}

              {disputeableOrders.length === 0 && (
                <View style={styles.noOrdersContainer}>
                  <Icon name="information-circle-outline" size={32} color={theme.tabIconDefault} />
                  <ThemedText style={[styles.noOrdersText, { color: theme.tabIconDefault }]}>
                    이의제기 가능한 오더가 없습니다
                  </ThemedText>
                </View>
              )}
            </ScrollView>

            {/* 오더 없이 접수 */}
            <Pressable
              style={[styles.noOrderButton, { borderColor: theme.backgroundTertiary }]}
              onPress={() => {
                setShowOrderPicker(false);
                navigation.navigate("DisputeCreate", {});
              }}
            >
              <Icon name="create-outline" size={18} color={theme.tabIconDefault} />
              <ThemedText style={[styles.noOrderButtonText, { color: theme.tabIconDefault }]}>
                오더 선택 없이 직접 작성
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  createButton: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  createButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  createButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    flex: 1,
  },
  createIconBg: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  createButtonDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  listCount: {
    fontSize: 14,
  },
  listContainer: {
    gap: Spacing.md,
  },
  disputeCard: {
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  typeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  typeIconBg: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  workDate: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  amountItem: {
    gap: 2,
  },
  amountLabel: {
    fontSize: 11,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
  },
  resolvedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  resolvedNoteText: {
    fontSize: 12,
    flex: 1,
  },
  emptyCard: {
    padding: Spacing.xl * 2,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  orderList: {
    maxHeight: 400,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  orderItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  orderItemIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  orderItemMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 2,
  },
  orderItemDate: {
    fontSize: 12,
  },
  orderItemArea: {
    fontSize: 12,
  },
  orderItemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderItemNumber: {
    fontSize: 12,
    fontWeight: '600',
  },
  noOrdersContainer: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  noOrdersText: {
    fontSize: 14,
  },
  noOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    marginTop: Spacing.md,
  },
  noOrderButtonText: {
    fontSize: 14,
  },
});
