import React from "react";
import { View, TextInput, Pressable, StyleSheet, ScrollView, Switch } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Step4Props, formatPhoneNumber } from "./types";

export default function Step4Vehicle({
  activeTab,
  courierForm,
  setCourierForm,
  otherCourierForm,
  setOtherCourierForm,
  coldTruckForm,
  setColdTruckForm,
  vehicleOptions,
  onOpenSelectModal,
  onNext,
  onBack,
  theme,
  isDark,
  bottomPadding,
}: Step4Props) {
  
  const isValid = 
    (activeTab === "택배사" && !!courierForm.vehicleType && !!courierForm.managerContact) ||
    (activeTab === "기타택배" && !!otherCourierForm.vehicleType && !!otherCourierForm.contact) ||
    (activeTab === "냉탑전용" && !!coldTruckForm.vehicleType && !!coldTruckForm.contact);

  const handleNext = () => {
    if (isValid) onNext();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            4단계: 차량 & 연락처
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            차량 타입과 담당자 연락처를 입력해주세요
          </ThemedText>
        </View>

        {activeTab === "택배사" && (
          <>
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                차량 타입 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
              </ThemedText>
              <Pressable
                style={[
                  styles.selectButton,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                onPress={() => onOpenSelectModal("차량타입", vehicleOptions, (value) => {
                  setCourierForm({ ...courierForm, vehicleType: value });
                })}
              >
                <ThemedText style={[
                  styles.selectButtonText,
                  { color: courierForm.vehicleType ? theme.text : Colors.light.tabIconDefault }
                ]}>
                  {courierForm.vehicleType || "차량 타입 선택"}
                </ThemedText>
                <Icon name="chevron-down-outline" size={20} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                담당자 연락처 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
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
                placeholder="010-0000-0000"
                placeholderTextColor={Colors.light.tabIconDefault}
                keyboardType="phone-pad"
                value={courierForm.managerContact}
                onChangeText={(value) => {
                  const formatted = formatPhoneNumber(value);
                  setCourierForm({ ...courierForm, managerContact: formatted });
                }}
                maxLength={13}
              />
            </View>
          </>
        )}

        {activeTab === "기타택배" && (
          <>
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                차량 타입 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
              </ThemedText>
              <Pressable
                style={[
                  styles.selectButton,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                onPress={() => onOpenSelectModal("차량타입", vehicleOptions, (value) => {
                  setOtherCourierForm({ ...otherCourierForm, vehicleType: value });
                })}
              >
                <ThemedText style={[
                  styles.selectButtonText,
                  { color: otherCourierForm.vehicleType ? theme.text : Colors.light.tabIconDefault }
                ]}>
                  {otherCourierForm.vehicleType || "차량 타입 선택"}
                </ThemedText>
                <Icon name="chevron-down-outline" size={20} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                연락처 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
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
                placeholder="010-0000-0000"
                placeholderTextColor={Colors.light.tabIconDefault}
                keyboardType="phone-pad"
                value={otherCourierForm.contact}
                onChangeText={(value) => {
                  const formatted = formatPhoneNumber(value);
                  setOtherCourierForm({ ...otherCourierForm, contact: formatted });
                }}
                maxLength={13}
              />
            </View>
          </>
        )}

        {activeTab === "냉탑전용" && (
          <>
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                차량 타입 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
              </ThemedText>
              <Pressable
                style={[
                  styles.selectButton,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                onPress={() => onOpenSelectModal("차량타입", vehicleOptions, (value) => {
                  setColdTruckForm({ ...coldTruckForm, vehicleType: value });
                })}
              >
                <ThemedText style={[
                  styles.selectButtonText,
                  { color: coldTruckForm.vehicleType ? theme.text : Colors.light.tabIconDefault }
                ]}>
                  {coldTruckForm.vehicleType || "차량 타입 선택"}
                </ThemedText>
                <Icon name="chevron-down-outline" size={20} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                연락처 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
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
                placeholder="010-0000-0000"
                placeholderTextColor={Colors.light.tabIconDefault}
                keyboardType="phone-pad"
                value={coldTruckForm.contact}
                onChangeText={(value) => {
                  const formatted = formatPhoneNumber(value);
                  setColdTruckForm({ ...coldTruckForm, contact: formatted });
                }}
                maxLength={13}
              />
            </View>

            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                냉탑 옵션
              </ThemedText>
              <View style={[styles.optionRow, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText style={[styles.optionLabel, { color: theme.text }]}>
                  타코미터 보유
                </ThemedText>
                <Switch
                  value={coldTruckForm.hasTachometer}
                  onValueChange={(value) => setColdTruckForm({ ...coldTruckForm, hasTachometer: value })}
                  trackColor={{ false: '#D1D5DB', true: BrandColors.requester }}
                  thumbColor={coldTruckForm.hasTachometer ? '#FFFFFF' : '#F3F4F6'}
                />
              </View>

              <View style={[styles.optionRow, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText style={[styles.optionLabel, { color: theme.text }]}>
                  칸막이 보유
                </ThemedText>
                <Switch
                  value={coldTruckForm.hasPartition}
                  onValueChange={(value) => setColdTruckForm({ ...coldTruckForm, hasPartition: value })}
                  trackColor={{ false: '#D1D5DB', true: BrandColors.requester }}
                  thumbColor={coldTruckForm.hasPartition ? '#FFFFFF' : '#F3F4F6'}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>

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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  optionLabel: {
    ...Typography.body,
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
