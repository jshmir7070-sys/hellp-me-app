import React, { useCallback, useState, useMemo } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { format, subMonths, isSameMonth, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

import { OrderListPage } from "@/components/order/OrderListPage";
import { adaptRequesterOrder, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors, Colors } from "@/constants/theme";

type RequesterHistoryScreenProps = NativeStackScreenProps<ProfileStackParamList, 'RequesterHistory'>;

export default function RequesterHistoryScreen({ navigation }: RequesterHistoryScreenProps) {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  const { data, isLoading, isRefetching, refetch } = useQuery<any[]>({
    queryKey: ['/api/requester/orders?status=completed'],
  });

  const months = useMemo(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      result.push(subMonths(new Date(), i));
    }
    return result;
  }, []);

  const completedOrders = useMemo(() => {
    if (!data) return [];
    return data.filter(order => {
      const isCompleted = ['closing_submitted', 'final_amount_confirmed', 'balance_paid', 'settlement_paid', 'closed'].includes(order.status?.toLowerCase() || '');
      if (!isCompleted) return false;
      
      const orderDate = order.scheduledDate || order.createdAt;
      if (!orderDate) return true;
      
      try {
        const date = typeof orderDate === 'string' ? parseISO(orderDate) : new Date(orderDate);
        return isSameMonth(date, selectedMonth);
      } catch {
        return true;
      }
    });
  }, [data, selectedMonth]);

  const handleCardPress = useCallback((item: OrderCardDTO) => {
    const orderId = Number(item.orderId);
    if (!isNaN(orderId)) {
      // ClosingDetail은 WorkStatusTab(ClosingStack)에 등록됨
      (navigation.getParent()?.getParent() as any)?.navigate('WorkStatusTab', { screen: 'ClosingDetail', params: { orderId } });
    }
  }, [navigation]);

  const handleCardAction = useCallback((action: string, item: OrderCardDTO) => {
    switch (action) {
      case 'view_detail':
        handleCardPress(item);
        break;
      case 'write_review':
        navigation.navigate('WriteReview', { orderId: Number(item.orderId) });
        break;
      case 'incident_report':
        navigation.navigate('IncidentReport', { orderId: Number(item.orderId) });
        break;
      case 'dispute':
        navigation.navigate('RequesterDispute', { orderId: Number(item.orderId) });
        break;
    }
  }, [handleCardPress, navigation]);

  const theme = isDark ? Colors.dark : Colors.light;

  const MonthFilterHeader = (
    <View style={[styles.filterContainer, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
      >
        {months.map((month, index) => {
          const isSelected = isSameMonth(month, selectedMonth);
          return (
            <Pressable
              key={index}
              onPress={() => setSelectedMonth(month)}
              style={[
                styles.monthChip,
                { 
                  backgroundColor: isSelected ? BrandColors.requester : theme.backgroundSecondary,
                  borderColor: isSelected ? BrandColors.requester : theme.backgroundTertiary,
                }
              ]}
            >
              <ThemedText 
                style={[
                  styles.monthText,
                  { color: isSelected ? '#fff' : theme.text }
                ]}
              >
                {format(month, 'yyyy.MM', { locale: ko })}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <OrderListPage
      data={completedOrders}
      context="requester_history"
      adapter={adaptRequesterOrder}
      isLoading={isLoading}
      isRefreshing={isRefetching}
      onRefresh={() => refetch()}
      onCardPress={handleCardPress}
      onCardAction={handleCardAction}
      emptyIcon="time-outline"
      emptyTitle={`${format(selectedMonth, 'yyyy년 M월', { locale: ko })} 이력 없음`}
      emptySubtitle="해당 월에 완료된 오더가 없습니다"
      ListHeaderComponent={MonthFilterHeader}
    />
  );
}

const styles = StyleSheet.create({
  filterContainer: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  filterScroll: {
    gap: Spacing.xs,
  },
  monthChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  monthText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
