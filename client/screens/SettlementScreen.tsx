import React from "react";
import { View, FlatList, StyleSheet, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { useQuery } from "@tanstack/react-query";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

type SettlementScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface SettlementSummary {
  totalAmount: number;
  payoutAmount: number;
  commissionRate?: number;
  commissionAmount?: number;
  deductions?: number;
  workDays: any[];
}

export default function SettlementScreen({ navigation }: SettlementScreenProps) {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  const { data: settlementData, isLoading, refetch, isRefetching } = useQuery<SettlementSummary>({
    queryKey: [`/api/helper/settlement?year=${currentYear}&month=${currentMonth + 1}`],
  });

  const formatCurrency = (amount?: number) => {
    if (!amount && amount !== 0) return '0원';
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const recentWorkDays = (settlementData?.workDays || []).slice(-5).reverse();

  const renderItem = ({ item }: { item: any }) => {
    const rate = settlementData?.commissionRate || 0;
    const commission = Math.round((item.dailyRate || 0) * rate / 100);
    const deduction = item.deductionAmount || 0;
    const minPayout = (item.dailyRate || 0) - commission - deduction;

    return (
      <Card style={styles.workDayCard}>
        <View style={styles.workDayHeader}>
          <ThemedText style={[styles.workDayTitle, { color: theme.text }]} numberOfLines={1}>
            {item.orderTitle || `오더 #${item.orderId}`}
          </ThemedText>
          <ThemedText style={[styles.workDayAmount, { color: BrandColors.helper }]}>
            {formatCurrency(minPayout)}
          </ThemedText>
        </View>
        <View style={styles.workDayMeta}>
          <ThemedText style={[styles.workDayDate, { color: theme.tabIconDefault }]}>
            {new Date(item.date).toLocaleDateString('ko-KR')}
          </ThemedText>
          <ThemedText style={[styles.workDayStat, { color: theme.tabIconDefault }]}>
            배송 {item.deliveredCount ?? 0} · 반품 {item.returnedCount ?? 0}
          </ThemedText>
        </View>
      </Card>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={BrandColors.helper} />
          <ThemedText style={[styles.emptyTitle, { color: theme.tabIconDefault }]}>
            불러오는 중...
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Icon name="receipt-outline" size={48} color={theme.tabIconDefault} />
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
          이번 달 정산 내역이 없습니다
        </ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
          근무를 시작하면 정산 내역이 표시됩니다
        </ThemedText>
      </View>
    );
  };

  const QuickAccessMenu = (
    <View style={[styles.menuSection, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.menuGrid}>
        <Pressable
          style={({ pressed }) => [
            styles.menuButton,
            {
              backgroundColor: theme.backgroundDefault,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => navigation.navigate('SettlementCalendar')}
        >
          <View style={[styles.menuIconContainer, { backgroundColor: BrandColors.helperLight || '#D1FAE5' }]}>
            <Icon name="receipt-outline" size={24} color={BrandColors.helper} />
          </View>
          <ThemedText style={[styles.menuButtonText, { color: theme.text }]}>
            정산 내역
          </ThemedText>
          <ThemedText style={[styles.menuButtonDesc, { color: theme.tabIconDefault }]}>
            근무 정산
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.menuButton,
            {
              backgroundColor: theme.backgroundDefault,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => navigation.navigate('HelperDisputeList')}
        >
          <View style={[styles.menuIconContainer, { backgroundColor: '#FEF3C7' }]}>
            <Icon name="alert-circle-outline" size={24} color="#F59E0B" />
          </View>
          <ThemedText style={[styles.menuButtonText, { color: theme.text }]}>
            이의제기
          </ThemedText>
          <ThemedText style={[styles.menuButtonDesc, { color: theme.tabIconDefault }]}>
            분쟁 내역
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.menuButton,
            {
              backgroundColor: theme.backgroundDefault,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => navigation.navigate('HelperIncidentList')}
        >
          <View style={[styles.menuIconContainer, { backgroundColor: '#FEE2E2' }]}>
            <Icon name="warning-outline" size={24} color="#EF4444" />
          </View>
          <ThemedText style={[styles.menuButtonText, { color: theme.text }]}>
            화물사고
          </ThemedText>
          <ThemedText style={[styles.menuButtonDesc, { color: theme.tabIconDefault }]}>
            사고 접수
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: 1,
      }}
      data={recentWorkDays}
      keyExtractor={(item, index) => `${item.orderId}-${index}`}
      renderItem={renderItem}
      ListHeaderComponent={QuickAccessMenu}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={BrandColors.helper}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  menuSection: {
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  menuGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  menuButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 120,
    justifyContent: 'center',
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  menuButtonText: {
    ...Typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  menuButtonDesc: {
    ...Typography.small,
    fontSize: 11,
    textAlign: 'center',
  },
  workDayCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  workDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  workDayTitle: {
    ...Typography.body,
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  workDayAmount: {
    ...Typography.body,
    fontWeight: '700',
  },
  workDayMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workDayDate: {
    ...Typography.small,
  },
  workDayStat: {
    ...Typography.small,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl * 3,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...Typography.small,
    textAlign: 'center',
  },
});
