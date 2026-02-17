import React, { useRef, useEffect } from "react";
import { View, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { useFormValidation } from "@/hooks/useFormValidation";
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
  onNext,
  onBack,
  theme,
  isDark,
  bottomPadding,
}: Step1Props) {

  // Refs for auto-scroll and focus
  const scrollViewRef = useRef<ScrollView>(null);
  const courierCompanyRef = useRef<View>(null);
  const otherCompanyRef = useRef<TextInput>(null);
  const coldTruckCompanyRef = useRef<View>(null);

  const { validate, registerField } = useFormValidation();

  // Register fields based on active tab
  useEffect(() => {
    if (activeTab === "택배사") {
      registerField('courierCompany', courierCompanyRef, scrollViewRef);
    } else if (activeTab === "기타택배") {
      registerField('otherCompany', otherCompanyRef, scrollViewRef);
    } else if (activeTab === "냉탑전용") {
      registerField('coldTruckCompany', coldTruckCompanyRef, scrollViewRef);
    }
  }, [activeTab]);

  const handleNext = () => {
    let validationRules: any[] = [];

    if (activeTab === "택배사") {
      validationRules = [
        {
          fieldName: 'courierCompany',
          displayName: '택배사',
          value: courierForm.company,
          required: true,
        },
      ];
    } else if (activeTab === "기타택배") {
      validationRules = [
        {
          fieldName: 'otherCompany',
          displayName: '업체명',
          value: otherCourierForm.companyName,
          required: true,
          minLength: 2,
          errorMessage: '업체명은 최소 2자 이상 입력해주세요.',
        },
      ];
    } else if (activeTab === "냉탑전용") {
      validationRules = [
        {
          fieldName: 'coldTruckCompany',
          displayName: '냉탑 업체',
          value: coldTruckForm.company,
          required: true,
        },
      ];
    }

    const isValid = validate(validationRules);

    if (isValid) {
      onNext();
    }
  };

  const isValid = 
    (activeTab === "택배사" && !!courierForm.company) ||
    (activeTab === "기타택배" && !!otherCourierForm.companyName) ||
    (activeTab === "냉탑전용" && !!coldTruckForm.company);

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollViewRef} style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            1단계: 기본 정보
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            {activeTab === "택배사" && "택배사를 선택해주세요"}
            {activeTab === "기타택배" && "업체명을 입력해주세요"}
            {activeTab === "냉탑전용" && "냉탑 업체를 선택해주세요"}
          </ThemedText>
        </View>

        {activeTab === "택배사" && (
          <View style={styles.section}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              택배사 선택 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
            </ThemedText>
            <Pressable
              ref={courierCompanyRef}
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
              ref={otherCompanyRef}
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
              value={otherCourierForm.companyName}
              onChangeText={(value) => setOtherCourierForm({ ...otherCourierForm, companyName: value })}
            />
          </View>
        )}

        {activeTab === "냉탑전용" && (
          <View style={styles.section}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              냉탑 업체 선택 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
            </ThemedText>
            <Pressable
              ref={coldTruckCompanyRef}
              style={[
                styles.selectButton,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              onPress={() => onOpenSelectModal("냉탑업체", coldTruckOptions, (value) => {
                setColdTruckForm({ ...coldTruckForm, company: value });
              })}
            >
              <ThemedText style={[
                styles.selectButtonText,
                { color: coldTruckForm.company ? theme.text : Colors.light.tabIconDefault }
              ]}>
                {coldTruckForm.company || "냉탑 업체 선택"}
              </ThemedText>
              <Icon name="chevron-down-outline" size={20} color={theme.text} />
            </Pressable>
          </View>
        )}
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
    paddingBottom: Spacing.lg,
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
  footer: {
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
  buttonText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
});
