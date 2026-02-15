import React, { useState } from "react";
import { View, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Step8Props } from "./types";

export default function Step8Payment({
  activeTab,
  courierForm,
  otherCourierForm,
  coldTruckForm,
  orderId,
  onComplete,
  theme,
  isDark,
  bottomPadding,
  onBack,
  contractSettings,
}: Step8Props) {
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'confirmed' | 'failed'>('pending');
  const depositRate = (contractSettings?.depositRate ?? 10) / 100;

  const getDepositAmount = () => {
    if (activeTab === "택배사") {
      const qty = parseInt(courierForm.avgQuantity) || 0;
      const price = parseInt(courierForm.unitPrice) || 0;
      return Math.round(qty * price * depositRate);
    } else if (activeTab === "기타택배") {
      const qty = parseInt(otherCourierForm.boxCount) || 0;
      const price = parseInt(otherCourierForm.unitPrice) || 0;
      return Math.round(qty * price * depositRate);
    } else {
      const freight = parseInt(coldTruckForm.freight) || 0;
      return Math.round(freight * depositRate);
    }
  };

  const getCompanyName = () => {
    if (activeTab === "택배사") return courierForm.company;
    if (activeTab === "기타택배") return otherCourierForm.companyName;
    return coldTruckForm.company;
  };

  const deposit = getDepositAmount();

  const handlePayment = () => {
    setPaymentStatus('processing');
    // 실제 결제 연동 시 PaymentScreen으로 네비게이션 하거나 API 호출
    setTimeout(() => {
      setPaymentStatus('confirmed');
    }, 1500);
  };

  const handleConfirmDeposit = () => {
    Alert.alert(
      "계약금 입금 확인",
      `${deposit.toLocaleString()}원을 입금하셨습니까?\n\n입금 확인 후 오더 등록이 최종 완료됩니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "입금 확인 요청",
          onPress: handlePayment,
        },
      ]
    );
  };

  const handleComplete = () => {
    onComplete();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            8단계: 계약금 입금 · 최종 완료
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            계약금을 입금하시면 오더 등록이 최종 완료됩니다
          </ThemedText>
        </View>

        {/* 계약금 정보 카드 */}
        <View style={[styles.depositCard, { backgroundColor: isDark ? '#1E3A5F' : '#EBF8FF', borderColor: isDark ? '#2c5282' : '#BEE3F8' }]}>
          <View style={styles.depositHeader}>
            <Icon name="wallet-outline" size={28} color={BrandColors.requester} />
            <ThemedText style={[styles.depositTitle, { color: theme.text }]}>계약금 정보</ThemedText>
          </View>

          <View style={styles.depositRow}>
            <ThemedText style={[styles.depositLabel, { color: Colors.light.tabIconDefault }]}>업체명</ThemedText>
            <ThemedText style={[styles.depositValue, { color: theme.text }]}>{getCompanyName()}</ThemedText>
          </View>
          <View style={styles.depositRow}>
            <ThemedText style={[styles.depositLabel, { color: Colors.light.tabIconDefault }]}>계약금 ({contractSettings?.depositRate ?? 10}%)</ThemedText>
            <ThemedText style={[styles.depositAmount, { color: BrandColors.requester }]}>
              {deposit.toLocaleString()}원
            </ThemedText>
          </View>
          {orderId && (
            <View style={styles.depositRow}>
              <ThemedText style={[styles.depositLabel, { color: Colors.light.tabIconDefault }]}>오더 번호</ThemedText>
              <ThemedText style={[styles.depositValue, { color: theme.text }]}>#{orderId}</ThemedText>
            </View>
          )}
        </View>

        {/* 입금 안내 */}
        <View style={[styles.guideCard, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
          <ThemedText style={[styles.guideTitle, { color: theme.text }]}>입금 안내</ThemedText>
          <View style={styles.guideItem}>
            <Icon name="card-outline" size={18} color={BrandColors.requester} />
            <ThemedText style={[styles.guideText, { color: theme.text }]}>
              PG 결제 또는 가상계좌로 입금 가능합니다
            </ThemedText>
          </View>
          <View style={styles.guideItem}>
            <Icon name="time-outline" size={18} color={BrandColors.requester} />
            <ThemedText style={[styles.guideText, { color: theme.text }]}>
              입금 확인 후 오더가 활성화됩니다
            </ThemedText>
          </View>
          <View style={styles.guideItem}>
            <Icon name="shield-checkmark-outline" size={18} color={BrandColors.requester} />
            <ThemedText style={[styles.guideText, { color: theme.text }]}>
              안전결제 시스템으로 보호됩니다
            </ThemedText>
          </View>
        </View>

        {/* 상태 표시 */}
        {paymentStatus === 'processing' && (
          <View style={[styles.statusCard, { backgroundColor: isDark ? '#1F2937' : '#FEF3C7' }]}>
            <ActivityIndicator size="small" color={BrandColors.requester} />
            <ThemedText style={[styles.statusText, { color: isDark ? '#FCD34D' : '#92400E' }]}>
              입금 확인 중...
            </ThemedText>
          </View>
        )}

        {paymentStatus === 'confirmed' && (
          <View style={[styles.statusCard, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
            <Icon name="checkmark-circle" size={24} color="#10B981" />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.statusTitle, { color: isDark ? '#6EE7B7' : '#065F46' }]}>
                입금 확인 완료!
              </ThemedText>
              <ThemedText style={[styles.statusText, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                오더 등록이 최종 완료되었습니다.
              </ThemedText>
            </View>
          </View>
        )}

        {paymentStatus === 'failed' && (
          <View style={[styles.statusCard, { backgroundColor: isDark ? '#4C0519' : '#FEE2E2' }]}>
            <Icon name="close-circle" size={24} color={BrandColors.error} />
            <ThemedText style={[styles.statusText, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
              결제에 실패했습니다. 다시 시도해주세요.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.backgroundRoot, paddingBottom: bottomPadding || 0 }]}>
        {paymentStatus === 'confirmed' ? (
          <Pressable
            style={[styles.button, styles.buttonPrimary, { backgroundColor: '#10B981', flex: 1 }]}
            onPress={handleComplete}
          >
            <Icon name="checkmark-circle-outline" size={20} color="#FFFFFF" />
            <ThemedText style={[styles.buttonText, { color: '#FFFFFF', marginLeft: Spacing.xs }]}>완료</ThemedText>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[styles.button, styles.buttonSecondary, { borderColor: BrandColors.requester }]}
              onPress={onBack}
              disabled={paymentStatus === 'processing'}
            >
              <ThemedText style={[styles.buttonText, { color: BrandColors.requester }]}>이전</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                styles.buttonPrimary,
                { backgroundColor: BrandColors.requester, opacity: paymentStatus === 'processing' ? 0.6 : 1 },
              ]}
              onPress={handleConfirmDeposit}
              disabled={paymentStatus === 'processing'}
            >
              <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>
                {paymentStatus === 'processing' ? "확인 중..." : "입금 확인 요청"}
              </ThemedText>
            </Pressable>
          </>
        )}
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
  depositCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  depositHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  depositTitle: {
    ...Typography.heading3,
    fontWeight: 'bold',
  },
  depositRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  depositLabel: {
    ...Typography.caption,
  },
  depositValue: {
    ...Typography.body,
    fontWeight: '600',
  },
  depositAmount: {
    ...Typography.heading2,
    fontWeight: 'bold',
  },
  guideCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  guideTitle: {
    ...Typography.body,
    fontWeight: 'bold',
    marginBottom: Spacing.md,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  guideText: {
    ...Typography.caption,
    flex: 1,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  statusTitle: {
    ...Typography.body,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  statusText: {
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
    flexDirection: 'row',
    justifyContent: 'center',
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
