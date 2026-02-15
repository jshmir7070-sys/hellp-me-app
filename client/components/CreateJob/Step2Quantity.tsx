import React from "react";
import { View, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Step2Props } from "./types";
import { quantityOptions, generatePriceOptions } from "@/constants/regionData";

export default function Step2Quantity({
  activeTab,
  courierForm,
  setCourierForm,
  otherCourierForm,
  setOtherCourierForm,
  coldTruckForm,
  setColdTruckForm,
  couriers,
  getCourierPolicy,
  calcFinalPricePerBox,
  onOpenSelectModal,
  onNext,
  onBack,
  theme,
  isDark,
  bottomPadding,
}: Step2Props) {
  
  const handleNext = () => {
    const isValid = 
      (activeTab === "택배사" && courierForm.avgQuantity && courierForm.unitPrice) ||
      (activeTab === "기타택배" && otherCourierForm.boxCount && otherCourierForm.unitPrice) ||
      (activeTab === "냉탑전용" && coldTruckForm.freight);
    
    if (isValid) onNext();
  };

  const isValid = 
    (activeTab === "택배사" && !!courierForm.avgQuantity && !!courierForm.unitPrice) ||
    (activeTab === "기타택배" && !!otherCourierForm.boxCount && !!otherCourierForm.unitPrice) ||
    (activeTab === "냉탑전용" && !!coldTruckForm.freight);

  // 택배사 가격 계산
  const renderCourierPriceInfo = () => {
    if (!courierForm.company || !courierForm.avgQuantity) return null;
    
    const policy = getCourierPolicy(courierForm.company);
    const quantity = parseInt(courierForm.avgQuantity) || 0;
    const basePrice = parseInt(courierForm.unitPrice) || policy.basePricePerBox;
    
    const priceCalc = calcFinalPricePerBox(
      basePrice,
      quantity,
      policy.minTotal,
      policy.urgentSurchargeRate,
      courierForm.isUrgent
    );
    
    if (priceCalc.message) {
      return (
        <View style={[styles.infoBox, { backgroundColor: isDark ? '#1E3A5F' : '#EBF8FF' }]}>
          <Icon name="information-circle-outline" size={20} color={BrandColors.requester} />
          <ThemedText style={[styles.infoText, { color: theme.text }]}>
            {priceCalc.message}
          </ThemedText>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            2단계: 수량 & 가격
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            {activeTab === "택배사" && "평균 수량과 박스 단가를 입력해주세요"}
            {activeTab === "기타택배" && "박스 수량과 단가를 입력해주세요"}
            {activeTab === "냉탑전용" && "운임을 입력해주세요"}
          </ThemedText>
        </View>

        {activeTab === "택배사" && (
          <>
            <View style={styles.row}>
              <View style={styles.halfSection}>
                <ThemedText style={[styles.label, { color: theme.text }]}>
                  평균수량 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
                </ThemedText>
                <Pressable
                  style={[
                    styles.selectButton,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                    },
                  ]}
                  onPress={() => onOpenSelectModal("평균수량", quantityOptions.map(n => n.toString()), (value) => {
                    setCourierForm({ ...courierForm, avgQuantity: value });
                  })}
                >
                  <ThemedText style={[
                    styles.selectButtonText,
                    { color: courierForm.avgQuantity ? theme.text : Colors.light.tabIconDefault }
                  ]}>
                    {courierForm.avgQuantity || "선택"}
                  </ThemedText>
                  <Icon name="chevron-down-outline" size={20} color={theme.text} />
                </Pressable>
              </View>

              <View style={styles.halfSection}>
                <ThemedText style={[styles.label, { color: theme.text }]}>
                  단가 (VAT별도) <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
                </ThemedText>
                <Pressable
                  style={[
                    styles.selectButton,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                    },
                  ]}
                  onPress={() => {
                    const policy = getCourierPolicy(courierForm.company);
                    const priceOptions = generatePriceOptions(policy.basePricePerBox || 1000);
                    onOpenSelectModal("단가", priceOptions.map(p => p.toString()), (value) => {
                      setCourierForm({ ...courierForm, unitPrice: value });
                    });
                  }}
                >
                  <ThemedText style={[
                    styles.selectButtonText,
                    { color: courierForm.unitPrice ? theme.text : Colors.light.tabIconDefault }
                  ]}>
                    {courierForm.unitPrice ? `${parseInt(courierForm.unitPrice).toLocaleString()}원` : "선택"}
                  </ThemedText>
                  <Icon name="chevron-down-outline" size={20} color={theme.text} />
                </Pressable>
              </View>
            </View>

            {renderCourierPriceInfo()}

            {courierForm.avgQuantity && courierForm.unitPrice && (
              <View style={[styles.summaryBox, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
                <ThemedText style={[styles.summaryLabel, { color: Colors.light.tabIconDefault }]}>
                  예상 총액 (VAT 포함)
                </ThemedText>
                <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                  {Math.round(parseInt(courierForm.avgQuantity) * parseInt(courierForm.unitPrice) * 1.1).toLocaleString()}원
                </ThemedText>
              </View>
            )}
          </>
        )}

        {activeTab === "기타택배" && (
          <>
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                박스 수량 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
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
                placeholder="박스 수량 입력"
                placeholderTextColor={Colors.light.tabIconDefault}
                keyboardType="number-pad"
                value={otherCourierForm.boxCount}
                onChangeText={(value) => setOtherCourierForm({ ...otherCourierForm, boxCount: value })}
              />
            </View>

            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                단가 (VAT별도) <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
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
                placeholder="단가 입력"
                placeholderTextColor={Colors.light.tabIconDefault}
                keyboardType="number-pad"
                value={otherCourierForm.unitPrice}
                onChangeText={(value) => setOtherCourierForm({ ...otherCourierForm, unitPrice: value })}
              />
            </View>

            {otherCourierForm.boxCount && otherCourierForm.unitPrice && (
              <View style={[styles.summaryBox, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
                <ThemedText style={[styles.summaryLabel, { color: Colors.light.tabIconDefault }]}>
                  예상 총액 (VAT 포함)
                </ThemedText>
                <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                  {Math.round(parseInt(otherCourierForm.boxCount) * parseInt(otherCourierForm.unitPrice) * 1.1).toLocaleString()}원
                </ThemedText>
              </View>
            )}
          </>
        )}

        {activeTab === "냉탑전용" && (
          <>
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                운임 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
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
                placeholder="운임 입력"
                placeholderTextColor={Colors.light.tabIconDefault}
                keyboardType="number-pad"
                value={coldTruckForm.freight}
                onChangeText={(value) => setColdTruckForm({ ...coldTruckForm, freight: value })}
              />
            </View>

            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                권장 수수료
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
                placeholder="권장 수수료"
                placeholderTextColor={Colors.light.tabIconDefault}
                keyboardType="number-pad"
                value={coldTruckForm.recommendedFee}
                onChangeText={(value) => setColdTruckForm({ ...coldTruckForm, recommendedFee: value })}
              />
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
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  halfSection: {
    flex: 1,
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
  infoBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  infoText: {
    ...Typography.caption,
    flex: 1,
  },
  summaryBox: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  summaryLabel: {
    ...Typography.caption,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    ...Typography.heading2,
    fontWeight: 'bold',
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
