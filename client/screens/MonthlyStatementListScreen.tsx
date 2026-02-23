import React, { useMemo } from "react";
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { useQuery } from "@tanstack/react-query";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

type MonthlyStatementListScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface MonthlyStatement {
  id: number;
  helperId: string;
  year: number;
  month: number;
  totalAmount: number;
  commissionAmount: number;
  insuranceDeduction: number;
  otherDeductions: number;
  payoutAmount: number;
  totalWorkDays: number;
  totalOrders: number;
  status: string;
  sentAt: string;
  viewedAt: string | null;
}

export default function MonthlyStatementListScreen({ navigation }: MonthlyStatementListScreenProps) {
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();

  const { data, isLoading } = useQuery<{ statements: MonthlyStatement[] }>({
    queryKey: ["/api/helper/monthly-statements"],
  });

  const formatCurrency = (amount?: number) => {
    if (!amount && amount !== 0) return "0원";
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
  };

  // 최근 12개월 고정 리스트 생성
  const monthList = useMemo(() => {
    const now = new Date();
    const statements = data?.statements || [];
    const stmtMap = new Map<string, MonthlyStatement>();
    statements.forEach((s) => {
      stmtMap.set(`${s.year}-${s.month}`, s);
    });

    const months: { year: number; month: number; statement: MonthlyStatement | null }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      months.push({
        year: y,
        month: m,
        statement: stmtMap.get(`${y}-${m}`) || null,
      });
    }
    return months;
  }, [data]);

  const renderItem = ({
    item,
  }: {
    item: { year: number; month: number; statement: MonthlyStatement | null };
  }) => {
    const hasSent = !!item.statement;
    const isViewed = item.statement?.status === "viewed";

    return (
      <Pressable
        disabled={!hasSent}
        onPress={() => {
          if (item.statement) {
            navigation.navigate("MonthlyStatementDetail", {
              statementId: item.statement.id,
            });
          }
        }}
      >
        <Card
          style={[
            styles.statementCard,
            !hasSent && { opacity: 0.6 },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.monthInfo}>
              <Icon
                name={hasSent ? "document-text-outline" : "time-outline"}
                size={24}
                color={hasSent ? "#6366F1" : theme.tabIconDefault}
              />
              <ThemedText style={[styles.monthText, { color: theme.text }]}>
                {item.year}년 {item.month}월
              </ThemedText>
            </View>

            {hasSent ? (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isViewed ? "#D1FAE5" : "#FEF3C7",
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.badgeText,
                    { color: isViewed ? "#059669" : "#D97706" },
                  ]}
                >
                  {isViewed ? "열람완료" : "미열람"}
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.badgeText, { color: theme.tabIconDefault }]}>
                  미전송
                </ThemedText>
              </View>
            )}
          </View>

          {hasSent && item.statement ? (
            <View style={styles.cardBody}>
              <View style={styles.amountRow}>
                <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                  총 금액
                </ThemedText>
                <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                  {formatCurrency(item.statement.totalAmount)}
                </ThemedText>
              </View>
              <View style={styles.amountRow}>
                <ThemedText style={[styles.amountLabel, { color: BrandColors.helper }]}>
                  지급액
                </ThemedText>
                <ThemedText
                  style={[styles.amountValue, { color: BrandColors.helper, fontWeight: "700" }]}
                >
                  {formatCurrency(item.statement.payoutAmount)}
                </ThemedText>
              </View>
              <View style={styles.metaRow}>
                <ThemedText style={[styles.metaText, { color: theme.tabIconDefault }]}>
                  근무 {item.statement.totalWorkDays || 0}일 · 오더 {item.statement.totalOrders || 0}건
                </ThemedText>
                <Icon name="chevron-forward-outline" size={16} color={theme.tabIconDefault} />
              </View>
            </View>
          ) : (
            <View style={styles.notSentBody}>
              <Icon name="information-circle-outline" size={18} color={theme.tabIconDefault} />
              <ThemedText style={[styles.notSentText, { color: theme.tabIconDefault }]}>
                마감이 아직 안되었습니다
              </ThemedText>
            </View>
          )}
        </Card>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
      </View>
    );
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
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
      data={monthList}
      keyExtractor={(item) => `${item.year}-${item.month}`}
      renderItem={renderItem}
      ListHeaderComponent={
        <View style={styles.headerSection}>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            월 정산서
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.tabIconDefault }]}>
            최근 12개월 정산서 목록입니다
          </ThemedText>
        </View>
      }
    />
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
  headerSection: {
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    ...Typography.h4,
    fontWeight: "700",
  },
  headerSubtitle: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  statementCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  monthInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  monthText: {
    ...Typography.body,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    ...Typography.small,
    fontSize: 11,
    fontWeight: "600",
  },
  cardBody: {
    gap: Spacing.xs,
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
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  metaText: {
    ...Typography.small,
  },
  notSentBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  notSentText: {
    ...Typography.small,
  },
});
