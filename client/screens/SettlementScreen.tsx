import React, { useState, useMemo } from "react";
import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

interface WorkDay {
  date: string;
  orderId: number;
  orderTitle: string;
  dailyRate: number;
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
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export default function SettlementScreen({ navigation }: SettlementScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
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
    const map = new Map<string, WorkDay>();
    if (settlementData?.workDays) {
      settlementData.workDays.forEach(wd => {
        const d = new Date(wd.date);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        map.set(dateStr, wd);
      });
    }
    return map;
  }, [settlementData?.workDays]);

  const workDaySet = useMemo(() => {
    return new Set(workDayMap.keys());
  }, [workDayMap]);

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
    const workDay = workDayMap.get(dateStr);
    if (workDay) {
      setSelectedDate(dateStr);
      navigation.navigate('SettlementDetail', { date: dateStr, orderId: workDay.orderId });
    }
  };

  const handleWorkDayPress = (workDay: WorkDay) => {
    const d = new Date(workDay.date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    navigation.navigate('SettlementDetail', { date: dateStr, orderId: workDay.orderId });
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
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
              { color: isSelected ? Colors.light.buttonText : theme.text },
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

  const summaryData = settlementData || {
    supplyAmount: 0,
    vat: 0,
    totalAmount: 0,
    commissionRate: 0,
    commissionAmount: 0,
    deductions: 0,
    payoutAmount: 0,
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl + 60,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <Card variant="glass" padding="lg" style={styles.summaryCard}>
        <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>
          {currentYear}년 {currentMonth + 1}월 정산
        </ThemedText>
        
        {isLoading ? (
          <ActivityIndicator size="small" color={BrandColors.helper} style={{ marginVertical: Spacing.lg }} />
        ) : (
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
                <ThemedText style={[styles.summaryLabel, { color: BrandColors.warning }]}>수수료 ({summaryData.commissionRate || 0}%)</ThemedText>
                <ThemedText style={[styles.summaryValue, { color: BrandColors.warning }]}>-{formatCurrency(summaryData.commissionAmount || 0)}</ThemedText>
              </View>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <ThemedText style={[styles.summaryLabel, { color: BrandColors.error }]}>차감액</ThemedText>
                <ThemedText style={[styles.summaryValue, { color: BrandColors.error }]}>-{formatCurrency(summaryData.deductions)}</ThemedText>
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
        )}
      </Card>

      <Card variant="glass" padding="md" style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Pressable onPress={handlePrevMonth} style={styles.navButton}>
            <Icon name="chevron-back-outline" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.monthTitle, { color: theme.text }]}>
            {currentYear}년 {MONTHS[currentMonth]}
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
                { color: idx === 0 ? BrandColors.error : idx === 6 ? BrandColors.helper : theme.tabIconDefault },
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

      {!isLoading && settlementData?.workDays && settlementData.workDays.length > 0 ? (
        <Card variant="glass" padding="md" style={styles.workDaysCard}>
          <ThemedText style={[styles.workDaysTitle, { color: theme.text }]}>
            근무 내역 ({settlementData.workDays.length}건)
          </ThemedText>
          {settlementData.workDays.map((workDay, idx) => (
            <Pressable
              key={`${workDay.orderId}-${idx}`}
              style={[
                styles.workDayItem,
                idx < settlementData.workDays.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.backgroundSecondary },
              ]}
              onPress={() => handleWorkDayPress(workDay)}
            >
              <View style={styles.workDayLeft}>
                <ThemedText style={[styles.workDayDate, { color: BrandColors.helper }]}>
                  {formatShortDate(workDay.date)}
                </ThemedText>
                <View style={styles.workDayInfo}>
                  <ThemedText style={[styles.workDayTitle, { color: theme.text }]} numberOfLines={1}>
                    {workDay.orderTitle}
                  </ThemedText>
                  <View style={styles.workDayStats}>
                    <ThemedText style={[styles.workDayStat, { color: theme.tabIconDefault }]}>
                      배송 {workDay.deliveredCount ?? 0}
                    </ThemedText>
                    <ThemedText style={[styles.workDayStat, { color: theme.tabIconDefault }]}>
                      반품 {workDay.returnedCount ?? 0}
                    </ThemedText>
                  </View>
                </View>
              </View>
              <View style={styles.workDayRight}>
                <ThemedText style={[styles.workDayAmount, { color: theme.text }]}>
                  {formatCurrency(workDay.dailyRate)}
                </ThemedText>
                {workDay.hasDeduction ? (
                  <ThemedText style={[styles.workDayDeduction, { color: BrandColors.error }]}>
                    차감 -{formatCurrency(workDay.deductionAmount)}
                  </ThemedText>
                ) : null}
                <Icon name="chevron-forward-outline" size={16} color={theme.tabIconDefault} />
              </View>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {!isLoading && settlementData?.workDays && settlementData.workDays.length === 0 ? (
        <Card variant="glass" padding="xl" style={styles.emptyCard}>
          <Icon name="calendar-outline" size={48} color={theme.tabIconDefault} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
            이번 달 근무 내역이 없습니다
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
            근무일이 있으면 달력에 표시됩니다
          </ThemedText>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  calendarCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
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
  workDaysCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  workDaysTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  workDayItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  workDayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  workDayDate: {
    ...Typography.body,
    fontWeight: '700',
    width: 50,
  },
  workDayInfo: {
    flex: 1,
  },
  workDayTitle: {
    ...Typography.body,
    fontWeight: '500',
    marginBottom: 2,
  },
  workDayStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  workDayStat: {
    ...Typography.small,
  },
  workDayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  workDayAmount: {
    ...Typography.body,
    fontWeight: '600',
  },
  workDayDeduction: {
    ...Typography.small,
  },
});
