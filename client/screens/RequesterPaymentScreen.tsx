import React, { useState } from "react";
import { View, Pressable, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

interface PaymentItem {
  id: number;
  orderId: number;
  companyName: string;
  deliveryArea: string;
  scheduledDate: string;
  depositAmount: number;
  balanceAmount?: number;
  totalPaid?: number;
  totalAmount?: number;
  balancePaid?: boolean;
  balanceDueDate?: string;
  cancelReason?: string;
  cancelledAt?: string;
  paidAt?: string;
  createdAt?: string;
  status: string;
}

interface PaymentData {
  paid: PaymentItem[];
  unpaid: PaymentItem[];
  refunds: PaymentItem[];
}

type TabType = "paid" | "unpaid" | "refunds";

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: "paid", label: "결제금", icon: "checkmark-circle-outline" },
  { key: "unpaid", label: "미결제금", icon: "time-outline" },
  { key: "refunds", label: "환불", icon: "arrow-undo-outline" },
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "-";
  }
}

function formatMoney(amount?: number | null): string {
  if (!amount && amount !== 0) return "0";
  return amount.toLocaleString("ko-KR");
}

export default function RequesterPaymentScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const [activeTab, setActiveTab] = useState<TabType>("paid");

  const { data, isLoading, refetch } = useQuery<PaymentData>({
    queryKey: ["/api/requester/payments"],
  });

  const paid = data?.paid || [];
  const unpaid = data?.unpaid || [];
  const refunds = data?.refunds || [];

  const totalPaidAmount = paid.reduce((sum, p) => sum + (p.totalPaid || p.depositAmount || 0), 0);
  // 미결제금: unpaid 배열 + paid에서 잔금 미결제인 항목
  const unpaidFromPaid = paid.reduce((sum, p) => sum + (!p.balancePaid && (p.balanceAmount || 0) > 0 ? p.balanceAmount : 0), 0);
  const totalUnpaidAmount = unpaid.reduce((sum, p) => sum + (p.balanceAmount || 0), 0) + unpaidFromPaid;
  const totalRefundAmount = refunds.reduce((sum, p) => sum + (p.depositAmount || 0), 0);

  const currentList =
    activeTab === "paid" ? paid : activeTab === "unpaid" ? unpaid : refunds;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: showDesktopLayout ? Spacing.xl : tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        ...(showDesktopLayout && {
          maxWidth: containerMaxWidth,
          alignSelf: "center" as const,
          width: "100%" as any,
        }),
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <Card style={[styles.summaryCard, { borderLeftColor: BrandColors.success, borderLeftWidth: 3 }]}>
          <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>
            총 결제금
          </ThemedText>
          <ThemedText style={[styles.summaryValue, { color: BrandColors.success }]}>
            {formatMoney(totalPaidAmount)}원
          </ThemedText>
        </Card>
        <Card style={[styles.summaryCard, { borderLeftColor: BrandColors.warning, borderLeftWidth: 3 }]}>
          <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>
            미결제금
          </ThemedText>
          <ThemedText style={[styles.summaryValue, { color: BrandColors.warning }]}>
            {formatMoney(totalUnpaidAmount)}원
          </ThemedText>
        </Card>
        <Card style={[styles.summaryCard, { borderLeftColor: BrandColors.error, borderLeftWidth: 3 }]}>
          <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>
            환불 대기
          </ThemedText>
          <ThemedText style={[styles.summaryValue, { color: BrandColors.error }]}>
            {formatMoney(totalRefundAmount)}원
          </ThemedText>
        </Card>
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.backgroundDefault }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count =
            tab.key === "paid" ? paid.length : tab.key === "unpaid" ? unpaid.length : refunds.length;
          return (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                isActive && { borderBottomColor: BrandColors.requester, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Icon
                name={tab.icon as any}
                size={18}
                color={isActive ? BrandColors.requester : theme.tabIconDefault}
              />
              <ThemedText
                style={[
                  styles.tabText,
                  { color: isActive ? BrandColors.requester : theme.tabIconDefault },
                  isActive && { fontWeight: "700" },
                ]}
              >
                {tab.label}
              </ThemedText>
              {count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    { backgroundColor: isActive ? BrandColors.requester : theme.tabIconDefault + "40" },
                  ]}
                >
                  <ThemedText style={styles.tabBadgeText}>{count}</ThemedText>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      {currentList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="receipt-outline" size={48} color={theme.tabIconDefault} />
          <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
            {activeTab === "paid"
              ? "결제 내역이 없습니다"
              : activeTab === "unpaid"
              ? "미결제 내역이 없습니다"
              : "환불 내역이 없습니다"}
          </ThemedText>
        </View>
      ) : (
        currentList.map((item) => (
          <Card key={`${activeTab}-${item.id}`} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={styles.itemHeaderLeft}>
                <ThemedText style={[styles.itemCompany, { color: theme.text }]}>
                  {item.companyName}
                </ThemedText>
                <ThemedText style={[styles.itemArea, { color: theme.tabIconDefault }]}>
                  {item.deliveryArea}
                </ThemedText>
              </View>
              <View style={[styles.orderIdBadge, { backgroundColor: BrandColors.requester + "15" }]}>
                <ThemedText style={[styles.orderIdText, { color: BrandColors.requester }]}>
                  #{item.orderId}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.tabIconDefault + "20" }]} />

            {activeTab === "paid" && (
              <View style={styles.itemBody}>
                <View style={styles.amountRow}>
                  <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                    계약금
                  </ThemedText>
                  <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                    {formatMoney(item.depositAmount)}원
                  </ThemedText>
                </View>
                {(item.balanceAmount || 0) > 0 && (
                  <View style={styles.amountRow}>
                    <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                      잔금 {!item.balancePaid ? '(미결제)' : ''}
                    </ThemedText>
                    <ThemedText style={[styles.amountValue, { color: item.balancePaid ? theme.text : BrandColors.warning }]}>
                      {formatMoney(item.balanceAmount)}원
                    </ThemedText>
                  </View>
                )}
                <View style={[styles.amountRow, styles.totalRow]}>
                  <ThemedText style={[styles.amountLabel, { color: theme.text, fontWeight: "600" }]}>
                    총 결제금
                  </ThemedText>
                  <ThemedText style={[styles.totalValue, { color: BrandColors.success }]}>
                    {formatMoney(item.totalPaid)}원
                  </ThemedText>
                </View>
                <View style={styles.metaRow}>
                  <ThemedText style={[styles.metaText, { color: theme.tabIconDefault }]}>
                    입차일: {formatDate(item.scheduledDate)}
                  </ThemedText>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: item.balancePaid ? "#DEF7EC" : "#FEF3C7" },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.statusText,
                        { color: item.balancePaid ? "#03543F" : "#92400E" },
                      ]}
                    >
                      {item.balancePaid ? "완납" : "잔금 미결제"}
                    </ThemedText>
                  </View>
                </View>
              </View>
            )}

            {activeTab === "unpaid" && (
              <View style={styles.itemBody}>
                <View style={styles.amountRow}>
                  <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                    총 금액
                  </ThemedText>
                  <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                    {formatMoney(item.totalAmount)}원
                  </ThemedText>
                </View>
                <View style={styles.amountRow}>
                  <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                    계약금 (납부)
                  </ThemedText>
                  <ThemedText style={[styles.amountValue, { color: BrandColors.success }]}>
                    -{formatMoney(item.depositAmount)}원
                  </ThemedText>
                </View>
                <View style={[styles.amountRow, styles.totalRow]}>
                  <ThemedText style={[styles.amountLabel, { color: theme.text, fontWeight: "600" }]}>
                    미결제 잔금
                  </ThemedText>
                  <ThemedText style={[styles.totalValue, { color: BrandColors.warning }]}>
                    {formatMoney(item.balanceAmount)}원
                  </ThemedText>
                </View>
                <View style={styles.metaRow}>
                  <ThemedText style={[styles.metaText, { color: theme.tabIconDefault }]}>
                    입차일: {formatDate(item.scheduledDate)}
                  </ThemedText>
                  {item.balanceDueDate && (
                    <ThemedText style={[styles.metaText, { color: BrandColors.error }]}>
                      납부기한: {formatDate(item.balanceDueDate)}
                    </ThemedText>
                  )}
                </View>
              </View>
            )}

            {activeTab === "refunds" && (
              <View style={styles.itemBody}>
                <View style={styles.amountRow}>
                  <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                    납부 계약금
                  </ThemedText>
                  <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                    {formatMoney(item.depositAmount)}원
                  </ThemedText>
                </View>
                <View style={styles.amountRow}>
                  <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                    취소 사유
                  </ThemedText>
                  <ThemedText
                    style={[styles.amountValue, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {item.cancelReason || "-"}
                  </ThemedText>
                </View>
                <View style={styles.metaRow}>
                  <ThemedText style={[styles.metaText, { color: theme.tabIconDefault }]}>
                    취소일: {formatDate(item.cancelledAt)}
                  </ThemedText>
                  <View style={[styles.statusBadge, { backgroundColor: "#FEE2E2" }]}>
                    <ThemedText style={[styles.statusText, { color: "#991B1B" }]}>
                      환불 대기
                    </ThemedText>
                  </View>
                </View>
              </View>
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    flex: 1,
    padding: Spacing.md,
  },
  summaryLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  tabBar: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  tabText: {
    ...Typography.small,
    fontWeight: "500",
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"] * 2,
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
  },
  itemCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  itemHeaderLeft: {
    flex: 1,
  },
  itemCompany: {
    ...Typography.body,
    fontWeight: "600",
  },
  itemArea: {
    ...Typography.small,
    marginTop: 2,
  },
  orderIdBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  orderIdText: {
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  itemBody: {
    gap: Spacing.sm,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: {
    ...Typography.small,
  },
  amountValue: {
    ...Typography.body,
    fontWeight: "500",
  },
  totalRow: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  metaText: {
    ...Typography.small,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
