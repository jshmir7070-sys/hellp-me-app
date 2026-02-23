import React, { useEffect } from "react";
import { View, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RouteProp } from "@react-navigation/native";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type MonthlyStatementDetailScreenProps = {
  route: RouteProp<{ MonthlyStatementDetail: { statementId: number } }, "MonthlyStatementDetail">;
};

interface MonthlyStatement {
  id: number;
  helperId: string;
  year: number;
  month: number;
  totalAmount: number;
  commissionRate: number;
  commissionAmount: number;
  insuranceRate: string;
  insuranceDeduction: number;
  otherDeductions: number;
  payoutAmount: number;
  totalWorkDays: number;
  totalOrders: number;
  settlementDataJson: string | null;
  status: string;
  sentAt: string;
  viewedAt: string | null;
}

interface DailyData {
  date: string;
  orderCount: number;
  totalAmount: number;
  commission: number;
  insurance: number;
  deductions: number;
  payout: number;
}

export default function MonthlyStatementDetailScreen({
  route,
}: MonthlyStatementDetailScreenProps) {
  const { statementId } = route.params;
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ statement: MonthlyStatement }>({
    queryKey: [`/api/helper/monthly-statements/${statementId}`],
  });

  const viewedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/helper/monthly-statements/${statementId}/viewed`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/helper/monthly-statements"] });
    },
  });

  // 열람 시 자동 열람 처리
  useEffect(() => {
    if (data?.statement && data.statement.status !== "viewed") {
      viewedMutation.mutate();
    }
  }, [data?.statement?.id]);

  const statement = data?.statement;

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return "0원";
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
  };

  const dailyData: DailyData[] = (() => {
    if (!statement?.settlementDataJson) return [];
    try {
      return JSON.parse(statement.settlementDataJson);
    } catch {
      return [];
    }
  })();

  const lastDay = statement ? new Date(statement.year, statement.month, 0).getDate() : 0;
  const insuranceRate = statement?.insuranceRate ? parseFloat(statement.insuranceRate) : 0;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
      </View>
    );
  }

  if (!statement) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <Icon name="document-text-outline" size={48} color={theme.tabIconDefault} />
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
          정산서를 찾을 수 없습니다
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: Spacing.xl + 100,
        paddingHorizontal: Spacing.lg,
        ...(showDesktopLayout && {
          maxWidth: containerMaxWidth,
          alignSelf: "center" as const,
          width: "100%" as any,
        }),
      }}
    >
      {/* 1. 헤더 */}
      <Card style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <Icon name="document-text-outline" size={32} color="#6366F1" />
        </View>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
          {statement.year}년 {statement.month}월 정산서
        </ThemedText>
        <ThemedText style={[styles.headerSubtitle, { color: theme.tabIconDefault }]}>
          발급일: {statement.sentAt ? new Date(statement.sentAt).toLocaleDateString("ko-KR") : "-"}
        </ThemedText>
      </Card>

      {/* 2. 정산 기간 */}
      <Card style={styles.periodCard}>
        <View style={styles.periodRow}>
          <Icon name="calendar-outline" size={18} color={theme.tabIconDefault} />
          <ThemedText style={[styles.periodText, { color: theme.text }]}>
            정산 기간: {statement.year}.{String(statement.month).padStart(2, "0")}.01 ~ {statement.year}.{String(statement.month).padStart(2, "0")}.{String(lastDay).padStart(2, "0")}
          </ThemedText>
        </View>
        <View style={styles.periodStats}>
          <View style={styles.periodStatItem}>
            <ThemedText style={[styles.periodStatLabel, { color: theme.tabIconDefault }]}>총 근무일수</ThemedText>
            <ThemedText style={[styles.periodStatValue, { color: theme.text }]}>
              {statement.totalWorkDays || 0}일
            </ThemedText>
          </View>
          <View style={[styles.periodDivider, { backgroundColor: theme.backgroundSecondary }]} />
          <View style={styles.periodStatItem}>
            <ThemedText style={[styles.periodStatLabel, { color: theme.tabIconDefault }]}>총 오더 수</ThemedText>
            <ThemedText style={[styles.periodStatValue, { color: theme.text }]}>
              {statement.totalOrders || 0}건
            </ThemedText>
          </View>
        </View>
      </Card>

      {/* 3. 정산 내역 - 고정 레이아웃 */}
      <Card style={styles.summaryCard}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          정산 내역
        </ThemedText>

        {/* 총 금액 */}
        <View style={styles.summaryRow}>
          <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>
            총 금액 (공급가 + VAT)
          </ThemedText>
          <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
            {formatCurrency(statement.totalAmount)}
          </ThemedText>
        </View>

        {/* 수수료 */}
        <View style={styles.summaryRow}>
          <ThemedText style={[styles.summaryLabel, { color: "#F59E0B" }]}>
            수수료 ({statement.commissionRate || 0}%)
          </ThemedText>
          <ThemedText style={[styles.summaryValue, { color: "#F59E0B" }]}>
            -{formatCurrency(statement.commissionAmount)}
          </ThemedText>
        </View>

        {/* 산재보험료 */}
        <View style={styles.summaryRow}>
          <ThemedText style={[styles.summaryLabel, { color: "#EA580C" }]}>
            산재보험료 ({insuranceRate}% x 50%)
          </ThemedText>
          <ThemedText style={[styles.summaryValue, { color: "#EA580C" }]}>
            -{formatCurrency(statement.insuranceDeduction)}
          </ThemedText>
        </View>

        {/* 기타 차감 */}
        <View style={styles.summaryRow}>
          <ThemedText style={[styles.summaryLabel, { color: "#EF4444" }]}>
            기타 차감 (사고 등)
          </ThemedText>
          <ThemedText style={[styles.summaryValue, { color: "#EF4444" }]}>
            -{formatCurrency(statement.otherDeductions)}
          </ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.backgroundSecondary }]} />

        {/* 최종 지급액 */}
        <View style={styles.payoutRow}>
          <ThemedText style={[styles.payoutLabel, { color: BrandColors.helper }]}>
            최종 지급액
          </ThemedText>
          <ThemedText style={[styles.payoutValue, { color: BrandColors.helper }]}>
            {formatCurrency(statement.payoutAmount)}
          </ThemedText>
        </View>
      </Card>

      {/* 4. 일별 상세 테이블 */}
      {dailyData.length > 0 ? (
        <Card style={styles.dailyCard}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            일별 상세
          </ThemedText>

          {/* 테이블 헤더 */}
          <View style={[styles.tableHeader, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText style={[styles.tableHeaderCell, styles.dateCol, { color: theme.tabIconDefault }]}>날짜</ThemedText>
            <ThemedText style={[styles.tableHeaderCell, styles.countCol, { color: theme.tabIconDefault }]}>오더</ThemedText>
            <ThemedText style={[styles.tableHeaderCell, styles.amountCol, { color: theme.tabIconDefault }]}>금액</ThemedText>
            <ThemedText style={[styles.tableHeaderCell, styles.deductCol, { color: theme.tabIconDefault }]}>차감</ThemedText>
            <ThemedText style={[styles.tableHeaderCell, styles.payoutCol, { color: theme.tabIconDefault }]}>지급액</ThemedText>
          </View>

          {/* 테이블 바디 */}
          {dailyData.sort((a, b) => a.date.localeCompare(b.date)).map((day, idx) => {
            const dateShort = day.date ? day.date.slice(5) : "-";
            return (
              <View
                key={idx}
                style={[
                  styles.tableRow,
                  idx % 2 === 0 && { backgroundColor: theme.backgroundRoot + "40" },
                ]}
              >
                <ThemedText style={[styles.tableCell, styles.dateCol, { color: theme.text }]}>
                  {dateShort}
                </ThemedText>
                <ThemedText style={[styles.tableCell, styles.countCol, { color: theme.text }]}>
                  {day.orderCount}
                </ThemedText>
                <ThemedText style={[styles.tableCell, styles.amountCol, { color: theme.text }]}>
                  {(day.totalAmount / 10000).toFixed(1)}만
                </ThemedText>
                <ThemedText style={[styles.tableCell, styles.deductCol, { color: "#EF4444" }]}>
                  {day.deductions > 0 ? `-${(day.deductions / 10000).toFixed(1)}만` : "-"}
                </ThemedText>
                <ThemedText style={[styles.tableCell, styles.payoutCol, { color: BrandColors.helper, fontWeight: "600" }]}>
                  {(day.payout / 10000).toFixed(1)}만
                </ThemedText>
              </View>
            );
          })}
        </Card>
      ) : null}

      {/* 5. 안내 문구 */}
      <View style={styles.footerNote}>
        <Icon name="information-circle-outline" size={16} color={theme.tabIconDefault} />
        <ThemedText style={[styles.footerText, { color: theme.tabIconDefault }]}>
          산재보험료는 특고직 기준 {insuranceRate}%이며, 본사 50%와 헬퍼 50%로 분담합니다.
        </ThemedText>
      </View>
    </ScrollView>
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
  emptyTitle: {
    ...Typography.body,
    fontWeight: "600",
  },

  /* 헤더 */
  headerCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: "center",
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E0E7FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.h4,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.small,
  },

  /* 정산 기간 */
  periodCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  periodText: {
    ...Typography.body,
    fontWeight: "500",
  },
  periodStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  periodStatItem: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  periodStatLabel: {
    ...Typography.small,
  },
  periodStatValue: {
    ...Typography.body,
    fontWeight: "700",
    fontSize: 18,
  },
  periodDivider: {
    width: 1,
    height: 36,
    marginHorizontal: Spacing.md,
  },

  /* 정산 내역 */
  summaryCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  summaryLabel: {
    ...Typography.body,
    fontSize: 14,
  },
  summaryValue: {
    ...Typography.body,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  payoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  payoutLabel: {
    ...Typography.body,
    fontWeight: "700",
    fontSize: 16,
  },
  payoutValue: {
    fontSize: 22,
    fontWeight: "700",
  },

  /* 일별 상세 테이블 */
  dailyCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  tableHeaderCell: {
    ...Typography.small,
    fontWeight: "600",
    textAlign: "center",
    fontSize: 11,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  tableCell: {
    ...Typography.small,
    textAlign: "center",
    fontSize: 12,
  },
  dateCol: {
    flex: 2,
  },
  countCol: {
    flex: 1,
  },
  amountCol: {
    flex: 2,
    textAlign: "right" as any,
  },
  deductCol: {
    flex: 2,
    textAlign: "right" as any,
  },
  payoutCol: {
    flex: 2,
    textAlign: "right" as any,
  },

  /* 푸터 */
  footerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  footerText: {
    ...Typography.small,
    flex: 1,
    lineHeight: 18,
  },
});
