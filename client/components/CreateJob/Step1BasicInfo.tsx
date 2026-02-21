import React from "react";
import { View, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Step1Props } from "./types";

export default function Step1BasicInfo({
  activeTab,
  courierForm,
  setCourierForm,
  otherCourierForm,
  setOtherCourierForm,
  coldTruckForm,
  setColdTruckForm,
  courierOptions,
  coldTruckOptions,
  onOpenSelectModal,
  onImportPreviousOrder,
  onNext,
  onBack,
  theme,
  isDark,
}: Step1Props) {
  
  const handleNext = () => {
    if (activeTab === "택배사" && courierForm.company) {
      onNext();
    } else if (activeTab === "기타택배" && otherCourierForm.companyName) {
      onNext();
    } else if (activeTab === "냉탑전용" && coldTruckForm.company.trim().length >= 2) {
      onNext();
    }
  };

  const isValid = 
    (activeTab === "택배사" && !!courierForm.company) ||
    (activeTab === "기타택배" && !!otherCourierForm.companyName) ||
    (activeTab === "냉탑전용" && coldTruckForm.company.trim().length >= 2);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            1단계: 기본 정보
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            {activeTab === "택배사" && "택배사를 선택해주세요"}
            {activeTab === "기타택배" && "업체명을 입력해주세요"}
            {activeTab === "냉탑전용" && "냉탑 업체명을 입력해주세요"}
          </ThemedText>
        </View>

        {activeTab === "택배사" && (
          <View style={styles.section}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              택배사 선택 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
            </ThemedText>
            <Pressable
              style={[
                styles.selectButton,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              onPress={() => onOpenSelectModal("택배사", courierOptions, (value) => {
                setCourierForm({ ...courierForm, company: value });
              })}
            >
              <ThemedText style={[
                styles.selectButtonText,
                { color: courierForm.company ? theme.text : Colors.light.tabIconDefault }
              ]}>
                {courierForm.company || "택배사 선택"}
              </ThemedText>
              <Icon name="chevron-down-outline" size={20} color={theme.text} />
            </Pressable>
          </View>
        )}

        {activeTab === "기타택배" && (
          <View style={styles.section}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              업체명 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              placeholder="업체명 입력"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={otherCourierForm.companyName}
              onChangeText={(value) => setOtherCourierForm({ ...otherCourierForm, companyName: value })}
            />
          </View>
        )}

        {activeTab === "냉탑전용" && (
          <View style={styles.section}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              냉탑 업체명 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              placeholder="업체명 입력 (최소 2자)"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={coldTruckForm.company}
              onChangeText={(value) => setColdTruckForm({ ...coldTruckForm, company: value })}
            />
          </View>
        )}

        {/* 이전 이력 불러오기 버튼 */}
        <Pressable
          style={({ pressed }) => [
            styles.importButton,
            { borderColor: BrandColors.requester, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={onImportPreviousOrder}
        >
          <Icon name="time-outline" size={18} color={BrandColors.requester} />
          <ThemedText style={[styles.importButtonText, { color: BrandColors.requester }]}>
            이전 이력 불러오기
          </ThemedText>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.backgroundRoot }]}>
        <Pressable
          style={[
            styles.button,
            styles.buttonPrimary,
            { backgroundColor: BrandColors.requester, opacity: isValid ? 1 : 0.6 },
          ]}
          onPress={handleNext}
          disabled={!isValid}
        >
          <ThemedText style={styles.buttonText}>다음</ThemedText>
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
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  selectButtonText: {
    ...Typography.body,
  },
  input: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    ...Typography.body,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    borderStyle: 'dashed',
  },
  importButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundSecondary,
  },
  button: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: BrandColors.requester,
  },
  buttonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
});
