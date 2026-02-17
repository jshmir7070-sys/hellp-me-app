import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Modal } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';
import { Icon } from "@/components/Icon";

interface WebCalendarProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  selectedDate?: Date;
  title?: string;
  minimumDate?: Date;
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export function WebCalendar({ visible, onClose, onSelect, selectedDate, title = '날짜 선택', minimumDate }: WebCalendarProps) {
  const { theme, isDark } = useTheme();
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date());
  const [viewDate, setViewDate] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDate = (day: number) => {
    const selected = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onSelect(selected);
    onClose();
  };

  const handleToday = () => {
    const today = new Date();
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelect(today);
    onClose();
  };

  const renderCalendarDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const today = new Date();
    
    const days: React.ReactNode[] = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = 
        today.getFullYear() === year && 
        today.getMonth() === month && 
        today.getDate() === day;
      
      const isSelected = 
        selectedDate &&
        selectedDate.getFullYear() === year && 
        selectedDate.getMonth() === month && 
        selectedDate.getDate() === day;

      const cellDate = new Date(year, month, day);
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const minDate = minimumDate ? new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate()) : todayStart;
      const effectiveMin = minDate > todayStart ? minDate : todayStart;
      const isPast = cellDate < effectiveMin;
      
      days.push(
        <Pressable
          key={day}
          style={[
            styles.dayCell,
            isToday && styles.todayCell,
            isSelected && { backgroundColor: BrandColors.requester },
          ]}
          onPress={() => handleSelectDate(day)}
          disabled={isPast}
        >
          <ThemedText
            style={[
              styles.dayText,
              { color: isPast ? Colors.light.tabIconDefault : theme.text },
              isToday && !isSelected && { color: BrandColors.requester, fontWeight: '700' },
              isSelected && { color: '#fff', fontWeight: '700' },
            ]}
          >
            {day}
          </ThemedText>
        </Pressable>
      );
    }
    
    return days;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View 
          style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <ThemedText style={[styles.title, { color: theme.text }]}>{title}</ThemedText>
            <Pressable onPress={onClose}>
              <Icon name="close-outline" size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.monthHeader}>
            <Pressable onPress={handlePrevMonth} style={styles.navButton}>
              <Icon name="chevron-back-outline" size={24} color={theme.text} />
            </Pressable>
            <ThemedText style={[styles.monthText, { color: theme.text }]}>
              {viewDate.getFullYear()}년 {MONTHS[viewDate.getMonth()]}
            </ThemedText>
            <Pressable onPress={handleNextMonth} style={styles.navButton}>
              <Icon name="chevron-forward-outline" size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.weekHeader}>
            {DAYS.map((day, index) => (
              <View key={day} style={styles.dayCell}>
                <ThemedText 
                  style={[
                    styles.weekDayText, 
                    { color: index === 0 ? '#EF4444' : index === 6 ? '#3B82F6' : Colors.light.tabIconDefault }
                  ]}
                >
                  {day}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {renderCalendarDays()}
          </View>

          <View style={styles.footer}>
            <Pressable 
              style={[styles.todayButton, { borderColor: BrandColors.requester }]} 
              onPress={handleToday}
            >
              <ThemedText style={{ color: BrandColors.requester, fontWeight: '600' }}>오늘</ThemedText>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 360,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    ...Typography.body,
    fontWeight: '600',
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  navButton: {
    padding: Spacing.sm,
  },
  monthText: {
    ...Typography.body,
    fontWeight: '600',
  },
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  weekDayText: {
    ...Typography.small,
    fontWeight: '500',
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.sm,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: BrandColors.requester,
  },
  dayText: {
    ...Typography.body,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  todayButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
});
