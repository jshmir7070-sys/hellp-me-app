import React, { useCallback, useState, useMemo } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { format, subMonths, isSameMonth, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

import { OrderListPage } from "@/components/order/OrderListPage";
import { adaptWorkHistory, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors, Colors } from "@/constants/theme";

type HelperHistoryScreenProps = NativeStackScreenProps<ProfileStackParamList, 'HelperHistory'>;

export default function HelperHistoryScreen({ navigation }: HelperHistoryScreenProps) {
  const { isDark } = useTheme();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  const { data, isLoading, isRefetching, refetch } = useQuery<any[]>({
    queryKey: ['/api/helper/work-history'],
  });

  const months = useMemo(() => {
    const result = [];
    for (let i = 0; i < 12; i++) {
      result.push(subMonths(new Date(), i));
    }
    return result;
  }, []);

  const filteredHistory = useMemo(() => {
    if (!data) return [];
    return data.filter(item => {
      const itemDate = item.date || item.createdAt;
      if (!itemDate) return true;
      
      try {
        const date = typeof itemDate === 'string' ? parseISO(itemDate) : new Date(itemDate);
        return isSameMonth(date, selectedMonth);
      } catch {
        return true;
      }
    });
  }, [data, selectedMonth]);

  const handleCardPress = useCallback((item: OrderCardDTO) => {
    const orderId = Number(item.orderId);
    if (!isNaN(orderId)) {
      navigation.navigate('HistoryDetail', { orderId, settlementId: item.contractId });
    }
  }, [navigation]);

  const handleCardAction = useCallback((action: string, item: OrderCardDTO) => {
    if (action === 'view_detail') {
      handleCardPress(item);
    } else if (action === 'dispute') {
      const orderId = Number(item.orderId);
      if (!isNaN(orderId)) {
        navigation.navigate('DisputeCreate', { orderId });
      } else {
        navigation.navigate('Disputes');
      }
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
                  backgroundColor: isSelected ? BrandColors.helper : theme.backgroundSecondary,
                  borderColor: isSelected ? BrandColors.helper : theme.backgroundTertiary,
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
      data={filteredHistory}
      context="helper_history"
      adapter={adaptWorkHistory}
      isLoading={isLoading}
      isRefreshing={isRefetching}
      onRefresh={() => refetch()}
      onCardPress={handleCardPress}
      onCardAction={handleCardAction}
      emptyIcon="time-outline"
      emptyTitle={`${format(selectedMonth, 'yyyy년 M월', { locale: ko })} 이력 없음`}
      emptySubtitle="해당 월에 완료된 업무가 없습니다"
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
