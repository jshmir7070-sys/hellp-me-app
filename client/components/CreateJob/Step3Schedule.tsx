import React, { useState } from "react";
import { View, Pressable, StyleSheet, ScrollView, Platform } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Step3Props } from "./types";
import DateTimePicker from "@react-native-community/datetimepicker";
import { WebCalendar } from "@/components/WebCalendar";

export default function Step3Schedule({
  activeTab,
  courierForm,
  setCourierForm,
  otherCourierForm,
  setOtherCourierForm,
  coldTruckForm,
  setColdTruckForm,
  onNext,
  onBack,
  theme,
  isDark,
  bottomPadding,
}: Step3Props) {
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseStringToDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date();
  };

  const openDatePicker = (mode: 'start' | 'end', currentValue: string) => {
    setDatePickerMode(mode);
    setTempDate(currentValue ? parseStringToDate(currentValue) : new Date());
    setShowDatePicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      const dateStr = formatDateToString(selectedDate);
      
      if (activeTab === "택배사") {
        if (datePickerMode === 'start') {
          setCourierForm({ ...courierForm, requestDate: dateStr });
        } else {
          setCourierForm({ ...courierForm, requestDateEnd: dateStr });
        }
      } else if (activeTab === "기타택배") {
        if (datePickerMode === 'start') {
          setOtherCourierForm({ ...otherCourierForm, requestDate: dateStr });
        } else {
          setOtherCourierForm({ ...otherCourierForm, requestDateEnd: dateStr });
        }
      } else {
        if (datePickerMode === 'start') {
          setColdTruckForm({ ...coldTruckForm, requestDate: dateStr });
        } else {
          setColdTruckForm({ ...coldTruckForm, requestDateEnd: dateStr });
        }
      }
      
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  };

  const getCurrentStartDate = () => {
    if (activeTab === "택배사") return courierForm.requestDate;
    if (activeTab === "기타택배") return otherCourierForm.requestDate;
    return coldTruckForm.requestDate;
  };

  const getCurrentEndDate = () => {
    if (activeTab === "택배사") return courierForm.requestDateEnd;
    if (activeTab === "기타택배") return otherCourierForm.requestDateEnd;
    return coldTruckForm.requestDateEnd;
  };

  const isValid = 
    (activeTab === "택배사" && !!courierForm.requestDate && !!courierForm.requestDateEnd) ||
    (activeTab === "기타택배" && !!otherCourierForm.requestDate && !!otherCourierForm.requestDateEnd) ||
    (activeTab === "냉탑전용" && !!coldTruckForm.requestDate && !!coldTruckForm.requestDateEnd);

  const handleNext = () => {
    if (isValid) onNext();
  };

  const renderDateButton = (label: string, value: string, mode: 'start' | 'end') => (
    <Pressable
      style={[
        styles.dateButton,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
        },
      ]}
      onPress={() => openDatePicker(mode, value)}
    >
      <Icon name="calendar-outline" size={18} color={value ? theme.text : Colors.light.tabIconDefault} />
      <ThemedText style={[
        styles.dateButtonText,
        { color: value ? theme.text : Colors.light.tabIconDefault }
      ]}>
        {value || label}
      </ThemedText>
      <Icon name="chevron-down-outline" size={18} color={theme.text} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            3단계: 배송 일정
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            배송 시작일과 종료일을 선택해주세요
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            배송 시작일 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
          </ThemedText>
          {renderDateButton("시작일 선택", getCurrentStartDate(), 'start')}
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            배송 종료일 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
          </ThemedText>
          {renderDateButton("종료일 선택", getCurrentEndDate(), 'end')}
        </View>

        {getCurrentStartDate() && getCurrentEndDate() && (
          <View style={[styles.infoBox, { backgroundColor: isDark ? '#1E3A5F' : '#EBF8FF' }]}>
            <Icon name="information-circle-outline" size={20} color={BrandColors.requester} />
            <ThemedText style={[styles.infoText, { color: theme.text }]}>
              선택하신 기간: {getCurrentStartDate()} ~ {getCurrentEndDate()}
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {showDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {showDatePicker && Platform.OS === 'web' && (
        <WebCalendar
          value={tempDate}
          onChange={(date) => {
            handleDateChange(null, date);
            setShowDatePicker(false);
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      <View style={[styles.footer, { backgroundColor: theme.backgroundRoot, paddingBottom: bottomPadding || 0 }]}>
        <Pressable
          style={[styles.button, styles.buttonSecondary, { borderColor: BrandColors.requester }]}
          onPress={onBack}
        >
          <ThemedText style={[styles.buttonText, { color: BrandColors.requester }]}>이전</ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.button,
            styles.buttonPrimary,
            { backgroundColor: BrandColors.requester, opacity: isValid ? 1 : 0.6 },
          ]}
          onPress={handleNext}
          disabled={!isValid}
        >
          <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>다음</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  stepTitle: {
    ...Typography.heading2,
    marginBottom: Spacing.xs,
  },
  stepDescription: {
    ...Typography.body,
  },
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  dateButtonText: {
    ...Typography.body,
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.caption,
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundSecondary,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: BrandColors.requester,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    ...Typography.button,
  },
});
