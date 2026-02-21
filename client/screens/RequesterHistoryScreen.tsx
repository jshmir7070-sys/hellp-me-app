import React, { useCallback, useState, useMemo } from "react";
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";

import { adaptRequesterOrder, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { OrderCard } from "@/components/order/OrderCard";
import { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

type RequesterHistoryScreenProps = NativeStackScreenProps<ProfileStackParamList, 'RequesterHistory'>;

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function parseOrderDate(order: any): Date | null {
  const raw = order.scheduledDate || order.createdAt;
  if (!raw) return null;

  // ISO 형식 (2026-02-20)
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed;

  // 한국어 형식 (2월 19일, 12월 3일)
  const korMatch = String(raw).match(/(\d{1,2})월\s*(\d{1,2})일?/);
  if (korMatch) {
    const now = new Date();
    return new Date(now.getFullYear(), parseInt(korMatch[1]) - 1, parseInt(korMatch[2]));
  }

  return null;
}

export default function RequesterHistoryScreen({ navigation }: RequesterHistoryScreenProps) {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['/api/requester/orders?status=completed'],
  });

  // 완료 상태 오더만 필터
  const completedOrders = useMemo(() => {
    if (!data) return [];
    return data.filter(order => {
      const status = order.status?.toLowerCase() || '';
      return ['closing_submitted', 'final_amount_confirmed', 'balance_paid', 'settlement_paid', 'closed', 'completed'].includes(status);
    });
  }, [data]);

  // 해당 월 오더를 날짜별로 그룹핑
  const ordersByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const order of completedOrders) {
      const date = parseOrderDate(order);
      if (!date) continue;
      if (date.getFullYear() !== currentYear || date.getMonth() !== currentMonth) continue;
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const existing = map.get(dateStr) || [];
      existing.push(order);
      map.set(dateStr, existing);
    }
    return map;
  }, [completedOrders, currentYear, currentMonth]);

  const orderDateSet = useMemo(() => new Set(ordersByDate.keys()), [ordersByDate]);

  // 선택된 날짜의 오더
  const selectedOrders = useMemo(() => {
    if (!selectedDate) return [];
    return (ordersByDate.get(selectedDate) || []).map(adaptRequesterOrder);
  }, [selectedDate, ordersByDate]);

  // 해당 월 요약
  const monthlySummary = useMemo(() => {
    let totalAmount = 0;
    let orderCount = 0;
    for (const orders of ordersByDate.values()) {
      for (const order of orders) {
        totalAmount += order.totalAmount || order.finalAmount || 0;
        orderCount++;
      }
    }
    return { totalAmount, orderCount, workDays: ordersByDate.size };
  }, [ordersByDate]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(null);
  };

  const handleDatePress = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (orderDateSet.has(dateStr)) {
      setSelectedDate(prev => prev === dateStr ? null : dateStr);
    }
  };

  const handleCardPress = useCallback((item: OrderCardDTO) => {
    const orderId = Number(item.orderId);
    if (!isNaN(orderId)) {
      (navigation.getParent()?.getParent() as any)?.navigate('WorkStatusTab', { screen: 'ClosingDetail', params: { orderId } });
    }
  }, [navigation]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasOrder = orderDateSet.has(dateStr);
      const isToday = today.getFullYear() === currentYear &&
                      today.getMonth() === currentMonth &&
                      today.getDate() === day;
      const isSelected = selectedDate === dateStr;

      days.push(
        <Pressable
          key={day}
          style={[
            styles.dayCell,
            hasOrder && { backgroundColor: BrandColors.requester + '20' },
            isSelected && { backgroundColor: BrandColors.requester },
            isToday && !isSelected && styles.todayCell,
          ]}
          onPress={() => handleDatePress(day)}
        >
          <ThemedText
            style={[
              styles.dayText,
              { color: isSelected ? '#FFFFFF' : theme.text },
              hasOrder && !isSelected && { color: BrandColors.requester, fontWeight: '700' },
            ]}
          >
            {day}
          </ThemedText>
          {hasOrder && !isSelected ? (
            <View style={[styles.orderDot, { backgroundColor: BrandColors.requester }]} />
          ) : null}
        </Pressable>
      );
    }

    return days;
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.requester} />
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
      }}
    >
      {/* ① 달력 (최상단) */}
      <Card style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Pressable onPress={handlePrevMonth} style={styles.navButton}>
            <Icon name="chevron-back-outline" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.monthTitle, { color: theme.text }]}>
            {currentYear}년 {currentMonth + 1}월
          </ThemedText>
          <Pressable onPress={handleNextMonth} style={styles.navButton}>
            <Icon name="chevron-forward-outline" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.weekdaysRow}>
          {WEEKDAYS.map((day, idx) => (
            <ThemedText
              key={day}
              style={[
                styles.weekdayText,
                { color: idx === 0 ? '#EF4444' : idx === 6 ? BrandColors.requester : theme.tabIconDefault },
              ]}
            >
              {day}
            </ThemedText>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {renderCalendar()}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: BrandColors.requester }]} />
            <ThemedText style={[styles.legendText, { color: theme.tabIconDefault }]}>이용일</ThemedText>
          </View>
        </View>
      </Card>

      {/* ② 선택된 날짜 이용내역 + 액션 버튼 */}
      {selectedDate && selectedOrders.length > 0 ? (
        <View style={styles.selectedSection}>
          <ThemedText style={[styles.selectedTitle, { color: theme.text }]}>
            {parseInt(selectedDate.split('-')[1])}월 {parseInt(selectedDate.split('-')[2])}일 이용 내역
          </ThemedText>

          {selectedOrders.map((order) => (
            <View key={order.orderId} style={styles.orderBlock}>
              {/* 오더 카드 */}
              <OrderCard
                data={order}
                context="requester_history"
                onPress={() => handleCardPress(order)}
              />

              {/* 3가지 액션 버튼 */}
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: BrandColors.requester + '12' }]}
                  onPress={() => navigation.navigate('WriteReview', { orderId: Number(order.orderId) })}
                >
                  <Icon name="star-outline" size={18} color={BrandColors.requester} />
                  <ThemedText style={[styles.actionText, { color: BrandColors.requester }]}>
                    리뷰쓰기
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.actionButton, { backgroundColor: '#F59E0B' + '12' }]}
                  onPress={() => navigation.navigate('RequesterDispute', { orderId: Number(order.orderId) })}
                >
                  <Icon name="alert-circle-outline" size={18} color="#F59E0B" />
                  <ThemedText style={[styles.actionText, { color: '#F59E0B' }]}>
                    이의제기
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.actionButton, { backgroundColor: BrandColors.error + '12' }]}
                  onPress={() => navigation.navigate('IncidentReport', { orderId: Number(order.orderId) })}
                >
                  <Icon name="warning-outline" size={18} color={BrandColors.error} />
                  <ThemedText style={[styles.actionText, { color: BrandColors.error }]}>
                    화물사고접수
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* ③ 월 요약 */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>이용 건수</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: theme.text }]}>{monthlySummary.orderCount}건</ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>이용 일수</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: theme.text }]}>{monthlySummary.workDays}일</ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>총 금액</ThemedText>
            <ThemedText style={[styles.summaryValue, { color: BrandColors.requester }]}>
              {formatCurrency(monthlySummary.totalAmount)}
            </ThemedText>
          </View>
        </View>
      </Card>

      {/* ④ 이용 내역이 없을 때 */}
      {ordersByDate.size === 0 && !isLoading ? (
        <Card style={styles.emptyCard}>
          <Icon name="calendar-outline" size={48} color={theme.tabIconDefault} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
            {currentYear}년 {currentMonth + 1}월 이력 없음
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
            해당 월에 완료된 오더가 없습니다
          </ThemedText>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* 달력 */
  calendarCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  navButton: {
    padding: Spacing.xs,
  },
  monthTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    ...Typography.small,
    fontWeight: '500',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  dayText: {
    ...Typography.body,
  },
  todayCell: {
    borderWidth: 1,
    borderColor: BrandColors.requester,
  },
  orderDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.md,
    gap: Spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...Typography.small,
  },

  /* 선택된 날짜 섹션 */
  selectedSection: {
    marginBottom: Spacing.md,
  },
  selectedTitle: {
    ...Typography.body,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  orderBlock: {
    marginBottom: Spacing.lg,
  },

  /* 3가지 액션 버튼 */
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  actionText: {
    ...Typography.small,
    fontWeight: '600',
  },

  /* 월 요약 */
  summaryCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    ...Typography.body,
    fontWeight: '700',
  },

  /* 빈 상태 */
  emptyCard: {
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  emptySubtitle: {
    ...Typography.small,
    textAlign: 'center',
  },
});
