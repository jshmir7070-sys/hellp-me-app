import React, { useState, useMemo } from "react";
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { useQuery } from "@tanstack/react-query";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

type SettlementCalendarScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface WorkDay {
  date: string;
  orderId: number;
  orderTitle: string;
  dailyRate: number;
  supplyAmount?: number;
  vatAmount?: number;
  pricePerUnit?: number;
  deliveredCount?: number;
  returnedCount?: number;
  status: string;
  closingReportId?: number;
  hasDeduction?: boolean;
  deductionAmount?: number;
}

interface MonthlySettlement {
  supplyAmount: number;
  vat: number;
  totalAmount: number;
  commissionRate?: number;
  commissionAmount?: number;
  deductions: number;
  payoutAmount: number;
  workDays: WorkDay[];
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function SettlementCalendarScreen({ navigation }: SettlementCalendarScreenProps) {
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: settlementData, isLoading } = useQuery<MonthlySettlement>({
    queryKey: [`/api/helper/settlement?year=${currentYear}&month=${currentMonth + 1}`],
  });

  const formatCurrency = (amount?: number) => {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const workDayMap = useMemo(() => {
    const map = new Map<string, WorkDay[]>();
    if (settlementData?.workDays) {
      settlementData.workDays.forEach(wd => {
        const d = new Date(wd.date);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const existing = map.get(dateStr) || [];
        existing.push(wd);
        map.set(dateStr, existing);
      });
    }
    return map;
  }, [settlementData?.workDays]);

  const workDaySet = useMemo(() => new Set(workDayMap.keys()), [workDayMap]);

  const selectedWorkDays = useMemo(() => {
    if (!selectedDate) return [];
    return workDayMap.get(selectedDate) || [];
  }, [selectedDate, workDayMap]);

  const summaryData = settlementData || {
    supplyAmount: 0,
    vat: 0,
    totalAmount: 0,
    commissionRate: 0,
    commissionAmount: 0,
    deductions: 0,
    payoutAmount: 0,
  };

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
    if (workDaySet.has(dateStr)) {
      setSelectedDate(prev => prev === dateStr ? null : dateStr);
    }
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
      const isWorkDay = workDaySet.has(dateStr);
      const isToday = today.getFullYear() === currentYear &&
                      today.getMonth() === currentMonth &&
                      today.getDate() === day;
      const isSelected = selectedDate === dateStr;

      days.push(
        <Pressable
          key={day}
          style={[
            styles.dayCell,
            isWorkDay && { backgroundColor: BrandColors.helper + '20' },
            isSelected && { backgroundColor: BrandColors.helper },
            isToday && !isSelected && styles.todayCell,
          ]}
          onPress={() => handleDatePress(day)}
        >
          <ThemedText
            style={[
              styles.dayText,
              { color: isSelected ? '#FFFFFF' : theme.text },
              isWorkDay && !isSelected && { color: BrandColors.helper, fontWeight: '700' },
            ]}
          >
            {day}
          </ThemedText>
          {isWorkDay && !isSelected ? (
            <View style={[styles.workDot, { backgroundColor: BrandColors.helper }]} />
          ) : null}
        </Pressable>
      );
    }

    return days;
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
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
      {/* ① 월 정산 요약 */}
      <Card style={styles.summaryCard}>
        <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>
          {currentYear}년 {currentMonth + 1}월 정산
        </ThemedText>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>공급가액</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>{formatCurrency(summaryData.supplyAmount)}</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>부가세 (10%)</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>{formatCurrency(summaryData.vat)}</ThemedText>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>합계</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>{formatCurrency(summaryData.totalAmount)}</ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: '#F59E0B' }]}>수수료 ({summaryData.commissionRate || 0}%)</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#F59E0B' }]}>-{formatCurrency(summaryData.commissionAmount || 0)}</ThemedText>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: '#EF4444' }]}>차감액</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#EF4444' }]}>-{formatCurrency(summaryData.deductions)}</ThemedText>
            </View>
            <View style={styles.summaryItem} />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.backgroundSecondary }]} />
          <View style={styles.summaryRow}>
            <View style={[styles.summaryItem, { flex: 1 }]}>
              <ThemedText style={[styles.summaryLabel, { color: BrandColors.helper, fontWeight: '600' }]}>지급액</ThemedText>
              <ThemedText style={[styles.summaryValueLarge, { color: BrandColors.helper }]}>{formatCurrency(summaryData.payoutAmount)}</ThemedText>
            </View>
          </View>
        </View>
      </Card>

      {/* ② 달력 */}
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
                { color: idx === 0 ? '#EF4444' : idx === 6 ? BrandColors.helper : theme.tabIconDefault },
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
            <View style={[styles.legendDot, { backgroundColor: BrandColors.helper }]} />
            <ThemedText style={[styles.legendText, { color: theme.tabIconDefault }]}>근무일</ThemedText>
          </View>
        </View>
      </Card>

      {/* ③ 선택된 날짜 근무카드 + 3버튼 */}
      {selectedDate && selectedWorkDays.length > 0 ? (
        <View style={styles.selectedSection}>
          <ThemedText style={[styles.selectedTitle, { color: theme.text }]}>
            {parseInt(selectedDate.split('-')[1])}월 {parseInt(selectedDate.split('-')[2])}일 근무 내역
          </ThemedText>

          {selectedWorkDays.map((workDay, idx) => (
            <View key={`${workDay.orderId}-${idx}`} style={styles.orderBlock}>
              {/* 근무(마감) 카드 */}
              <Pressable onPress={() => navigation.navigate('SettlementDetail', { date: selectedDate, orderId: workDay.orderId })}>
                <Card style={styles.workCard}>
                  <View style={styles.workCardHeader}>
                    <View style={styles.orderBadge}>
                      <ThemedText style={styles.orderBadgeText}>O-{workDay.orderId}</ThemedText>
                    </View>
                    <ThemedText style={[styles.workCardStatus, { color: theme.tabIconDefault }]}>
                      {workDay.status === 'settlement_paid' ? '정산완료' : '확인중'}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.workCardTitle, { color: theme.text }]} numberOfLines={1}>
                    {workDay.orderTitle}
                  </ThemedText>
                  <View style={styles.workCardStats}>
                    <ThemedText style={[styles.workCardStat, { color: theme.tabIconDefault }]}>
                      배송 {workDay.deliveredCount ?? 0}건
                    </ThemedText>
                    <ThemedText style={[styles.workCardStat, { color: theme.tabIconDefault }]}>
                      반품 {workDay.returnedCount ?? 0}건
                    </ThemedText>
                  </View>
                  {(() => {
                    const rate = summaryData.commissionRate || 0;
                    const commission = Math.round((workDay.dailyRate || 0) * rate / 100);
                    const deduction = workDay.deductionAmount || 0;
                    const minPayout = (workDay.dailyRate || 0) - commission - deduction;
                    return (
                      <View style={styles.workCardAmountRow}>
                        <ThemedText style={[styles.workCardAmountLabel, { color: BrandColors.helper }]}>최소 수령금액</ThemedText>
                        <ThemedText style={[styles.workCardAmount, { color: BrandColors.helper }]}>
                          {formatCurrency(minPayout)}
                        </ThemedText>
                      </View>
                    );
                  })()}
                </Card>
              </Pressable>

              {/* 3가지 액션 버튼 */}
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.actionButton, { backgroundColor: BrandColors.helper + '12' }]}
                  onPress={() => navigation.navigate('SettlementDetail', { date: selectedDate, orderId: workDay.orderId })}
                >
                  <Icon name="receipt-outline" size={18} color={BrandColors.helper} />
                  <ThemedText style={[styles.actionText, { color: BrandColors.helper }]}>
                    정산내역
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.actionButton, { backgroundColor: '#F59E0B' + '12' }]}
                  onPress={() => navigation.navigate('HelperDisputeSubmit', { orderId: workDay.orderId, workDate: selectedDate, orderTitle: workDay.orderTitle })}
                >
                  <Icon name="alert-circle-outline" size={18} color="#F59E0B" />
                  <ThemedText style={[styles.actionText, { color: '#F59E0B' }]}>
                    이의제기
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.actionButton, { backgroundColor: BrandColors.error + '12' }]}
                  onPress={() => navigation.navigate('HelperIncidentList', { orderId: workDay.orderId })}
                >
                  <Icon name="warning-outline" size={18} color={BrandColors.error} />
                  <ThemedText style={[styles.actionText, { color: BrandColors.error }]}>
                    사고내역
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* ④ 빈 상태 */}
      {workDayMap.size === 0 && !isLoading ? (
        <Card style={styles.emptyCard}>
          <Icon name="calendar-outline" size={48} color={theme.tabIconDefault} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
            {currentYear}년 {currentMonth + 1}월 근무 내역 없음
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
            해당 월에 근무 내역이 없습니다
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

  /* 월 정산 요약 */
  summaryCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  summaryTitle: {
    ...Typography.h4,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  summaryGrid: {
    gap: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    ...Typography.body,
    fontWeight: '600',
  },
  summaryValueLarge: {
    ...Typography.h4,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
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
    borderColor: BrandColors.helper,
  },
  workDot: {
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

  /* 근무(마감) 카드 */
  workCard: {
    padding: Spacing.lg,
  },
  workCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  orderBadge: {
    backgroundColor: BrandColors.helper,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  orderBadgeText: {
    ...Typography.small,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  workCardStatus: {
    ...Typography.small,
  },
  workCardTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  workCardStats: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  workCardStat: {
    ...Typography.small,
  },
  workCardAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  workCardAmountLabel: {
    ...Typography.small,
  },
  workCardAmount: {
    ...Typography.body,
    fontWeight: '700',
  },
  workCardDeduction: {
    ...Typography.small,
    fontWeight: '600',
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
