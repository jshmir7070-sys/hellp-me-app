import React, { useState, useCallback } from "react";
import { View, StyleSheet, Alert, Platform, Pressable } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { OrderListPage } from "@/components/order/OrderListPage";
import { adaptRequesterOrder, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { Spacing, Typography, BorderRadius, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
type RequesterClosingScreenProps = NativeStackScreenProps<any, 'RequesterClosing'>;

type RequesterFilterTab = 'all' | 'in_progress' | 'closing_submitted' | 'closing_completed';

export default function RequesterClosingScreen({ navigation }: RequesterClosingScreenProps) {
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<RequesterFilterTab>('all');

  // 마감 화면: completed 필터로 숨겨진 마감 오더도 포함 + 업무중 오더도 가져오기
  const { data: completedData, isLoading: isLoadingCompleted, isRefetching: isRefetchingCompleted, refetch: refetchCompleted } = useQuery<any[]>({
    queryKey: ['/api/requester/orders', 'completed'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/requester/orders?status=completed');
      if (!res.ok) throw new Error('Failed to fetch completed orders');
      return res.json();
    },
  });

  const { data: activeData, isLoading: isLoadingActive, isRefetching: isRefetchingActive, refetch: refetchActive } = useQuery<any[]>({
    queryKey: ['/api/requester/orders', 'in_progress'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/requester/orders?status=in_progress');
      if (!res.ok) throw new Error('Failed to fetch active orders');
      return res.json();
    },
  });

  const isLoading = isLoadingCompleted || isLoadingActive;
  const isRefetching = isRefetchingCompleted || isRefetchingActive;
  const refetch = useCallback(() => {
    refetchCompleted();
    refetchActive();
  }, [refetchCompleted, refetchActive]);

  const closingOrders = React.useMemo(() => {
    const combined = [...(completedData || []), ...(activeData || [])];
    // 중복 제거 (orderId 기준)
    const seen = new Set<string>();
    return combined.filter(order => {
      const key = String(order.orderId || order.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return ['closing_submitted', 'in_progress', 'scheduled', 'final_amount_confirmed', 'balance_paid', 'settlement_paid', 'closed'].includes(order.status?.toLowerCase() || '');
    });
  }, [completedData, activeData]);

  const inProgressCount = closingOrders.filter(o => ['in_progress', 'scheduled'].includes(o.status)).length;
  const closingSubmittedCount = closingOrders.filter(o => o.status === 'closing_submitted').length;
  const closingCompletedCount = closingOrders.filter(o => ['final_amount_confirmed', 'balance_paid', 'settlement_paid', 'closed'].includes(o.status)).length;

  const filteredOrders = React.useMemo(() => {
    switch (activeFilter) {
      case 'in_progress':
        return closingOrders.filter(o => ['in_progress', 'scheduled'].includes(o.status));
      case 'closing_submitted':
        return closingOrders.filter(o => o.status === 'closing_submitted');
      case 'closing_completed':
        return closingOrders.filter(o => ['final_amount_confirmed', 'balance_paid', 'settlement_paid', 'closed'].includes(o.status));
      default:
        return closingOrders;
    }
  }, [activeFilter, closingOrders]);

  const confirmMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest('POST', `/api/orders/${orderId}/closing/confirm`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/requester/orders'] });
      if (Platform.OS === 'web') {
        alert('마감자료를 확인했습니다.');
      } else {
        Alert.alert('확인 완료', '마감자료 확인이 완료되었습니다. 잔금 결제를 진행해주세요.');
      }
    },
    onError: (err: any) => {
      if (Platform.OS === 'web') {
        alert(err.message || '확인에 실패했습니다.');
      } else {
        Alert.alert('오류', err.message || '확인에 실패했습니다.');
      }
    },
  });

  const handleCardPress = useCallback((item: OrderCardDTO) => {
    const orderId = Number(item.orderId);
    if (!isNaN(orderId)) {
      // ClosingDetail is in ClosingStackNavigator; if we're in HomeStack, navigate via root
      const state = navigation.getState();
      const hasClosingDetail = state.routeNames?.includes('ClosingDetail');
      if (hasClosingDetail) {
        navigation.navigate('ClosingDetail', { orderId });
      } else {
        navigation.navigate('Main' as any, { screen: 'WorkStatusTab', params: { screen: 'ClosingDetail', params: { orderId } } });
      }
    }
  }, [navigation]);

  const handleCardAction = useCallback((action: string, item: OrderCardDTO) => {
    const orderId = Number(item.orderId);
    
    switch (action) {
      case 'view_detail':
      case 'review_closing':
        handleCardPress(item);
        break;
      case 'confirm_closing':
        if (Platform.OS === 'web') {
          if (confirm('마감자료를 확인하시겠습니까?')) {
            confirmMutation.mutate(orderId);
          }
        } else {
          Alert.alert(
            '마감 확인',
            '헬퍼의 마감자료를 확인하시겠습니까?',
            [
              { text: '취소', style: 'cancel' },
              { text: '확인', onPress: () => confirmMutation.mutate(orderId) },
            ]
          );
        }
        break;
      case 'pay_balance':
        // Payment screen is in RootStackNavigator
        navigation.getParent()?.getParent()?.navigate('Payment', { orderId: String(orderId), paymentType: 'balance' });
        break;
    }
  }, [handleCardPress, confirmMutation, navigation]);

  const headerComponent = (
    <View style={styles.header}>
      <Card style={styles.infoCard}>
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterTab, activeFilter === 'all' && { backgroundColor: isDark ? '#2d3748' : '#EDF2F7' }]}
            onPress={() => setActiveFilter('all')}
          >
            <ThemedText style={[styles.filterLabel, { color: activeFilter === 'all' ? theme.text : theme.tabIconDefault }, activeFilter === 'all' && { fontWeight: '700' }]}>
              전체
            </ThemedText>
            <ThemedText style={[styles.filterValue, { color: activeFilter === 'all' ? BrandColors.requester : theme.tabIconDefault }]}>
              {closingOrders.length}건
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.filterTab, activeFilter === 'in_progress' && { backgroundColor: isDark ? '#2d3320' : '#FFFBEB' }]}
            onPress={() => setActiveFilter('in_progress')}
          >
            <ThemedText style={[styles.filterLabel, { color: activeFilter === 'in_progress' ? BrandColors.warning : theme.tabIconDefault }, activeFilter === 'in_progress' && { fontWeight: '700' }]}>
              업무중
            </ThemedText>
            <ThemedText style={[styles.filterValue, { color: BrandColors.warning }]}>
              {inProgressCount}건
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.filterTab, activeFilter === 'closing_submitted' && { backgroundColor: isDark ? '#1a2940' : '#FFF5F5' }]}
            onPress={() => setActiveFilter('closing_submitted')}
          >
            <ThemedText style={[styles.filterLabel, { color: activeFilter === 'closing_submitted' ? BrandColors.requester : theme.tabIconDefault }, activeFilter === 'closing_submitted' && { fontWeight: '700' }]}>
              마감 대기
            </ThemedText>
            <ThemedText style={[styles.filterValue, { color: BrandColors.requester }]}>
              {closingSubmittedCount}건
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.filterTab, activeFilter === 'closing_completed' && { backgroundColor: isDark ? '#1a2e1a' : '#F0FFF4' }]}
            onPress={() => setActiveFilter('closing_completed')}
          >
            <ThemedText style={[styles.filterLabel, { color: activeFilter === 'closing_completed' ? BrandColors.success : theme.tabIconDefault }, activeFilter === 'closing_completed' && { fontWeight: '700' }]}>
              마감 완료
            </ThemedText>
            <ThemedText style={[styles.filterValue, { color: BrandColors.success }]}>
              {closingCompletedCount}건
            </ThemedText>
          </Pressable>
        </View>
      </Card>
    </View>
  );

  return (
    <OrderListPage
      data={filteredOrders}
      context="requester_closing"
      adapter={adaptRequesterOrder}
      isLoading={isLoading}
      isRefreshing={isRefetching}
      onRefresh={() => refetch()}
      onCardPress={handleCardPress}
      onCardAction={handleCardAction}
      ListHeaderComponent={headerComponent}
      emptyIcon="document-text-outline"
      emptyTitle={
        activeFilter === 'all' ? '마감 관련 오더가 없습니다' :
        activeFilter === 'in_progress' ? '업무중인 오더가 없습니다' :
        activeFilter === 'closing_submitted' ? '마감 대기 중인 오더가 없습니다' :
        '마감 완료된 오더가 없습니다'
      }
      emptySubtitle={
        activeFilter === 'all' ? '헬퍼가 마감자료를 제출하면 여기에 표시됩니다' :
        activeFilter === 'in_progress' ? '현재 진행 중인 오더가 없습니다' :
        activeFilter === 'closing_submitted' ? '헬퍼가 마감자료를 제출하면 여기에 표시됩니다' :
        '아직 마감 완료된 오더가 없습니다'
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.lg,
  },
  infoCard: {
    padding: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  filterLabel: {
    ...Typography.small,
    fontSize: 11,
    marginBottom: 2,
  },
  filterValue: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
});
