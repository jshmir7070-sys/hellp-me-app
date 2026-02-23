import React from "react";
import { View, FlatList, StyleSheet, RefreshControl, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Settlement {
  id: number;
  settlementId?: number;
  date?: string;
  orderTitle?: string;
  requesterName?: string;
  deliveryCount: number;
  returnCount: number;
  pickupCount: number;
  otherCount: number;
  supplyAmount: number;
  taxAmount: number;
  deductionAmount: number;
  netAmount: number;
  status: string;
  helperConfirmed?: boolean;
}

export default function SettlementHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const queryClient = useQueryClient();
  const primaryColor = BrandColors.helper;

  const { data: settlements = [], isLoading, refetch, isRefetching } = useQuery<Settlement[]>({
    queryKey: ['/api/helpers/me/settlements'],
  });

  const [confirmingId, setConfirmingId] = React.useState<number | null>(null);

  const confirmMutation = useMutation({
    mutationFn: async (settlementId: number) => {
      setConfirmingId(settlementId);
      const res = await apiRequest('PATCH', `/api/helpers/settlements/${settlementId}/confirm`);
      return res.json();
    },
    onMutate: async (settlementId: number) => {
      await queryClient.cancelQueries({ queryKey: ['/api/helpers/me/settlements'] });
      const previousData = queryClient.getQueryData<Settlement[]>(['/api/helpers/me/settlements']);
      queryClient.setQueryData<Settlement[]>(['/api/helpers/me/settlements'], (old) =>
        old?.map((s) => (s.id === settlementId ? { ...s, helperConfirmed: true } : s)) ?? []
      );
      return { previousData };
    },
    onSuccess: () => {
      if (Platform.OS !== 'web') {
        Alert.alert('알림', '정산 내역을 확인했습니다.');
      }
    },
    onError: (error: Error, _settlementId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['/api/helpers/me/settlements'], context.previousData);
      }
      if (Platform.OS !== 'web') {
        Alert.alert('오류', error.message || '확인에 실패했습니다.');
      }
    },
    onSettled: () => {
      setConfirmingId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/helpers/me/settlements'] });
    },
  });

  const handleConfirm = (settlement: Settlement) => {
    if (settlement.helperConfirmed) return;
    
    if (Platform.OS !== 'web') {
      Alert.alert(
        '정산 확인',
        '해당 정산 내역을 확인하시겠습니까? 확인 후에는 취소할 수 없습니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '확인', onPress: () => confirmMutation.mutate(settlement.id) },
        ]
      );
    } else {
      confirmMutation.mutate(settlement.id);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const getStatusBadge = (settlement: Settlement) => {
    if (settlement.helperConfirmed) {
      return { label: '확인완료', color: BrandColors.success, bgColor: BrandColors.successLight };
    }
    return { label: '미확인', color: BrandColors.warning, bgColor: BrandColors.warningLight };
  };

  const renderItem = ({ item }: { item: Settlement }) => {
    const badge = getStatusBadge(item);
    const totalCount = item.deliveryCount + item.returnCount + item.pickupCount + item.otherCount;

    return (
      <Card style={styles.settlementCard}>
        <View style={styles.cardHeader}>
          <View style={styles.dateContainer}>
            <Icon name="calendar-outline" size={14} color={theme.tabIconDefault} />
            <ThemedText style={[styles.dateText, { color: theme.tabIconDefault }]}>
              {formatDate(item.date)}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: badge.bgColor }]}>
            <ThemedText style={[styles.statusText, { color: badge.color }]}>
              {badge.label}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.orderTitle, { color: theme.text }]} numberOfLines={1}>
          {item.orderTitle || item.requesterName || '정산 내역'}
        </ThemedText>

        <View style={styles.countRow}>
          <View style={styles.countItem}>
            <ThemedText style={[styles.countLabel, { color: theme.tabIconDefault }]}>배송</ThemedText>
            <ThemedText style={[styles.countValue, { color: theme.text }]}>{item.deliveryCount}</ThemedText>
          </View>
          <View style={styles.countItem}>
            <ThemedText style={[styles.countLabel, { color: theme.tabIconDefault }]}>반품</ThemedText>
            <ThemedText style={[styles.countValue, { color: theme.text }]}>{item.returnCount}</ThemedText>
          </View>
          <View style={styles.countItem}>
            <ThemedText style={[styles.countLabel, { color: theme.tabIconDefault }]}>픽업</ThemedText>
            <ThemedText style={[styles.countValue, { color: theme.text }]}>{item.pickupCount}</ThemedText>
          </View>
          <View style={styles.countItem}>
            <ThemedText style={[styles.countLabel, { color: theme.tabIconDefault }]}>기타</ThemedText>
            <ThemedText style={[styles.countValue, { color: theme.text }]}>{item.otherCount}</ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.backgroundSecondary }]} />

        <View style={styles.amountSection}>
          <View style={styles.amountRow}>
            <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>공급가액</ThemedText>
            <ThemedText style={[styles.amountValue, { color: theme.text }]}>{formatCurrency(item.supplyAmount)}</ThemedText>
          </View>
          <View style={styles.amountRow}>
            <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>부가세</ThemedText>
            <ThemedText style={[styles.amountValue, { color: theme.text }]}>{formatCurrency(item.taxAmount)}</ThemedText>
          </View>
          {item.deductionAmount > 0 ? (
            <View style={styles.amountRow}>
              <ThemedText style={[styles.amountLabel, { color: BrandColors.error }]}>공제</ThemedText>
              <ThemedText style={[styles.amountValue, { color: BrandColors.error }]}>-{formatCurrency(item.deductionAmount)}</ThemedText>
            </View>
          ) : null}
          <View style={[styles.amountRow, styles.totalRow]}>
            <ThemedText style={[styles.totalLabel, { color: theme.text }]}>정산금액</ThemedText>
            <ThemedText style={[styles.totalValue, { color: primaryColor }]}>{formatCurrency(item.netAmount)}</ThemedText>
          </View>
        </View>

        {!item.helperConfirmed ? (
          <Pressable
            style={[styles.confirmButton, { backgroundColor: primaryColor, opacity: confirmingId === item.id ? 0.6 : 1 }]}
            onPress={() => handleConfirm(item)}
            disabled={confirmingId === item.id}
          >
            {confirmingId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="checkmark-outline" size={16} color="#fff" />
                <ThemedText style={styles.confirmButtonText}>정산 확인</ThemedText>
              </>
            )}
          </Pressable>
        ) : null}
      </Card>
    );
  };

  const renderEmpty = () => (
    <Card style={styles.emptyCard}>
      <View style={[styles.emptyIcon, { backgroundColor: BrandColors.helperLight }]}>
        <Icon name="cash-outline" size={32} color={primaryColor} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        정산 내역이 없습니다
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
        업무 완료 후 정산 내역이 표시됩니다
      </ThemedText>
    </Card>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: showDesktopLayout ? Spacing.xl : tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: 1,
        ...(showDesktopLayout && {
          maxWidth: containerMaxWidth,
          alignSelf: 'center' as const,
          width: '100%' as any,
        }),
      }}
      data={settlements}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={primaryColor}
        />
      }
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settlementCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dateText: {
    ...Typography.small,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.md,
  },
  countItem: {
    alignItems: 'center',
  },
  countLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  countValue: {
    ...Typography.body,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  amountSection: {
    gap: Spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    ...Typography.small,
  },
  amountValue: {
    ...Typography.small,
  },
  totalRow: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  totalLabel: {
    ...Typography.body,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 44,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyCard: {
    flex: 1,
    padding: Spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing['4xl'],
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.small,
    textAlign: 'center',
  },
});
