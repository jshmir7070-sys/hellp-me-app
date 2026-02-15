import React, { useCallback } from "react";
import { View, StyleSheet, Alert, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { OrderListPage } from "@/components/order/OrderListPage";
import { adaptRequesterOrder, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { Spacing, Typography, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { QueryErrorState } from "@/components/QueryErrorState";
type RequesterClosingScreenProps = NativeStackScreenProps<any, 'RequesterClosing'>;

export default function RequesterClosingScreen({ navigation }: RequesterClosingScreenProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const { data, isLoading, isRefetching, refetch, isError, error } = useQuery<any[]>({
    queryKey: ['/api/requester/orders'],
  });

  if (isError) return <QueryErrorState error={error as Error} onRetry={refetch} />;

  const closingOrders = React.useMemo(() => {
    if (!data) return [];
    return data.filter(order => 
      ['closing_submitted', 'in_progress', 'scheduled', 'final_amount_confirmed', 'balance_paid', 'settlement_paid', 'closed'].includes(order.status?.toLowerCase() || '')
    );
  }, [data]);

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
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>
              마감 대기
            </ThemedText>
            <ThemedText style={[styles.infoValue, { color: BrandColors.requester }]}>
              {closingOrders.filter(o => o.status === 'closing_submitted').length}건
            </ThemedText>
          </View>
          <View style={styles.infoItem}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>
              업무중
            </ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {closingOrders.filter(o => ['in_progress', 'scheduled'].includes(o.status)).length}건
            </ThemedText>
          </View>
        </View>
      </Card>
    </View>
  );

  return (
    <OrderListPage
      data={closingOrders}
      context="requester_closing"
      adapter={adaptRequesterOrder}
      isLoading={isLoading}
      isRefreshing={isRefetching}
      onRefresh={() => refetch()}
      onCardPress={handleCardPress}
      onCardAction={handleCardAction}
      ListHeaderComponent={headerComponent}
      emptyIcon="document-text-outline"
      emptyTitle="마감 대기 중인 오더가 없습니다"
      emptySubtitle="헬퍼가 마감자료를 제출하면 여기에 표시됩니다"
    />
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.lg,
  },
  infoCard: {
    padding: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  infoValue: {
    ...Typography.h3,
    fontWeight: '700',
  },
});
