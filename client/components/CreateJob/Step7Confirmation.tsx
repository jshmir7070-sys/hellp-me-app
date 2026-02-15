import React from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Step7Props } from "./types";

export default function Step7Confirmation({
  activeTab,
  courierForm,
  otherCourierForm,
  coldTruckForm,
  setCourierForm,
  setOtherCourierForm,
  setColdTruckForm,
  onSubmit,
  isSubmitting,
  onBack,
  theme,
  isDark,
  bottomPadding,
}: Step7Props) {
  
  const isAgreed = 
    (activeTab === "택배사" && courierForm.agreeToSubmit) ||
    (activeTab === "기타택배" && otherCourierForm.agreeToSubmit) ||
    (activeTab === "냉탑전용" && coldTruckForm.agreeToSubmit);

  const renderInfoRow = (label: string, value: string | number | boolean) => (
    <View style={styles.infoRow}>
      <ThemedText style={[styles.infoLabel, { color: Colors.light.tabIconDefault }]}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.infoValue, { color: theme.text }]}>
        {typeof value === 'boolean' ? (value ? '예' : '아니오') : value || '-'}
      </ThemedText>
    </View>
  );

  const renderSummary = () => {
    if (activeTab === "택배사") {
      return (
        <>
          {renderInfoRow("택배사", courierForm.company)}
          {renderInfoRow("평균수량", courierForm.avgQuantity)}
          {renderInfoRow("단가", `${courierForm.unitPrice}원`)}
          {renderInfoRow("배송 시작일", courierForm.requestDate)}
          {renderInfoRow("배송 종료일", courierForm.requestDateEnd)}
          {renderInfoRow("차량 타입", courierForm.vehicleType)}
          {renderInfoRow("담당자 연락처", courierForm.managerContact)}
          {renderInfoRow("지역", `${courierForm.regionLarge} > ${courierForm.regionMedium}`)}
          {renderInfoRow("캠프 주소", courierForm.campAddress)}
          {courierForm.campAddressDetail && renderInfoRow("캠프 주소 상세", courierForm.campAddressDetail)}
          {courierForm.deliveryGuide && renderInfoRow("배송 가이드", courierForm.deliveryGuide)}
          {renderInfoRow("긴급 오더", courierForm.isUrgent)}
        </>
      );
    } else if (activeTab === "기타택배") {
      return (
        <>
          {renderInfoRow("업체명", otherCourierForm.companyName)}
          {renderInfoRow("박스 수량", otherCourierForm.boxCount)}
          {renderInfoRow("단가", `${otherCourierForm.unitPrice}원`)}
          {renderInfoRow("배송 시작일", otherCourierForm.requestDate)}
          {renderInfoRow("배송 종료일", otherCourierForm.requestDateEnd)}
          {renderInfoRow("차량 타입", otherCourierForm.vehicleType)}
          {renderInfoRow("연락처", otherCourierForm.contact)}
          {renderInfoRow("지역", `${otherCourierForm.regionLarge} > ${otherCourierForm.regionMedium}`)}
          {renderInfoRow("캠프 주소", otherCourierForm.campAddress)}
          {otherCourierForm.campAddressDetail && renderInfoRow("캠프 주소 상세", otherCourierForm.campAddressDetail)}
          {otherCourierForm.deliveryGuide && renderInfoRow("배송 가이드", otherCourierForm.deliveryGuide)}
          {renderInfoRow("긴급 오더", otherCourierForm.isUrgent)}
        </>
      );
    } else {
      return (
        <>
          {renderInfoRow("냉탑 업체", coldTruckForm.company)}
          {renderInfoRow("운임", `${coldTruckForm.freight}원`)}
          {renderInfoRow("권장 수수료", `${coldTruckForm.recommendedFee}원`)}
          {renderInfoRow("배송 시작일", coldTruckForm.requestDate)}
          {renderInfoRow("배송 종료일", coldTruckForm.requestDateEnd)}
          {renderInfoRow("차량 타입", coldTruckForm.vehicleType)}
          {renderInfoRow("연락처", coldTruckForm.contact)}
          {renderInfoRow("상차지", coldTruckForm.loadingPoint)}
          {coldTruckForm.loadingPointDetail && renderInfoRow("상차지 상세", coldTruckForm.loadingPointDetail)}
          {coldTruckForm.waypoints.filter(w => w).length > 0 && (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: Colors.light.tabIconDefault }]}>
                경유지
              </ThemedText>
              <View style={styles.waypointsList}>
                {coldTruckForm.waypoints.filter(w => w).map((waypoint, index) => (
                  <ThemedText key={index} style={[styles.infoValue, { color: theme.text }]}>
                    {index + 1}. {waypoint}
                  </ThemedText>
                ))}
              </View>
            </View>
          )}
          {renderInfoRow("타코미터 보유", coldTruckForm.hasTachometer)}
          {renderInfoRow("칸막이 보유", coldTruckForm.hasPartition)}
          {coldTruckForm.deliveryGuide && renderInfoRow("배송 가이드", coldTruckForm.deliveryGuide)}
          {renderInfoRow("긴급 오더", coldTruckForm.isUrgent)}
        </>
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            6단계: 오더확인 · 계약금확인 · 동의
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            입력하신 정보와 계약금을 확인 후 동의해주세요
          </ThemedText>
        </View>

        <View style={[styles.summaryBox, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
          <View style={[styles.summaryHeader, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
            <Icon name="document-text-outline" size={24} color={BrandColors.requester} />
            <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>
              오더 정보
            </ThemedText>
          </View>
          {renderSummary()}
        </View>

        <View style={styles.consentSection}>
          <Pressable 
            style={styles.consentRow}
            onPress={() => {
              if (activeTab === "택배사") {
                setCourierForm({ ...courierForm, agreeToSubmit: !courierForm.agreeToSubmit });
              } else if (activeTab === "기타택배") {
                setOtherCourierForm({ ...otherCourierForm, agreeToSubmit: !otherCourierForm.agreeToSubmit });
              } else {
                setColdTruckForm({ ...coldTruckForm, agreeToSubmit: !coldTruckForm.agreeToSubmit });
              }
            }}
          >
            <View style={[
              styles.checkbox,
              { 
                backgroundColor: isAgreed ? BrandColors.requester : 'transparent',
                borderColor: isAgreed ? BrandColors.requester : '#D1D5DB',
              }
            ]}>
              {isAgreed && <Icon name="checkmark-outline" size={14} color="#FFFFFF" />}
            </View>
            <ThemedText style={[styles.consentText, { color: theme.text }]}>
              위 내용으로 오더를 등록하시겠습니까? <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
            </ThemedText>
          </Pressable>
        </View>

        <View style={[styles.infoBox, { backgroundColor: isDark ? '#1E3A5F' : '#EBF8FF' }]}>
          <Icon name="information-circle-outline" size={20} color={BrandColors.requester} />
          <View style={styles.infoTextContainer}>
            <ThemedText style={[styles.infoText, { color: theme.text }]}>
              동의 후 다음 단계에서 계약서 작성 → 서명 → 본인인증이 진행됩니다
            </ThemedText>
          </View>
        </View>
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
            { backgroundColor: BrandColors.requester, opacity: isAgreed ? 1 : 0.6 },
          ]}
          onPress={() => { if (isAgreed) onNext(); }}
          disabled={!isAgreed}
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
  summaryBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  summaryTitle: {
    ...Typography.heading3,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundSecondary,
  },
  infoLabel: {
    ...Typography.caption,
    flex: 1,
  },
  infoValue: {
    ...Typography.body,
    flex: 1,
    textAlign: 'right',
  },
  waypointsList: {
    flex: 1,
    alignItems: 'flex-end',
  },
  consentSection: {
    marginBottom: Spacing.xl,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentText: {
    ...Typography.body,
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoText: {
    ...Typography.caption,
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
