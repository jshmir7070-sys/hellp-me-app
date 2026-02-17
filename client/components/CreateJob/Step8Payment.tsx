import React, { useState } from "react";
import { View, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator, Clipboard } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Step8Props } from "./types";

// 고정 가상계좌 정보 (테스트용)
const VIRTUAL_ACCOUNT = {
  bank: "국민은행",
  accountNumber: "123-456-789012",
  holder: "헬프미(주)",
  validUntil: "입금 기한: 발급일로부터 24시간",
};

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
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'accountIssued' | 'processing' | 'confirmed' | 'failed'>('pending');
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

  const handleRequestVirtualAccount = () => {
    // 가상계좌 발급 (테스트: 즉시 발급)
    setPaymentStatus('accountIssued');
  };

  const handleConfirmDeposit = () => {
    Alert.alert(
      "입금 확인",
      `${VIRTUAL_ACCOUNT.bank} ${VIRTUAL_ACCOUNT.accountNumber}로\n${deposit.toLocaleString()}원을 입금하셨습니까?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "입금 확인",
          onPress: () => {
            setPaymentStatus('processing');
            // 실제 연동 시 API 호출로 대체
            setTimeout(() => {
              setPaymentStatus('confirmed');
            }, 1500);
          },
        },
      ]
    );
  };

  const handleCopyAccount = () => {
    Clipboard.setString(VIRTUAL_ACCOUNT.accountNumber);
    Alert.alert("복사 완료", "계좌번호가 복사되었습니다.");
  };

  const handleComplete = () => {
    onComplete();
  };

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
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

        {/* 가상계좌 미발급 시: 안내 */}
        {paymentStatus === 'pending' && (
          <View style={[styles.guideCard, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
            <ThemedText style={[styles.guideTitle, { color: theme.text }]}>입금 안내</ThemedText>
            <View style={styles.guideItem}>
              <Icon name="card-outline" size={18} color={BrandColors.requester} />
              <ThemedText style={[styles.guideText, { color: theme.text }]}>
                가상계좌를 발급받아 계약금을 입금해주세요
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
        )}

        {/* 가상계좌 발급 완료 시: 계좌 정보 표시 */}
        {(paymentStatus === 'accountIssued' || paymentStatus === 'processing') && (
          <View style={[styles.accountCard, { backgroundColor: isDark ? '#1A2332' : '#F0FFF4', borderColor: isDark ? '#2D3748' : '#C6F6D5' }]}>
            <View style={styles.accountHeader}>
              <Icon name="business-outline" size={24} color={BrandColors.requester} />
              <ThemedText style={[styles.accountHeaderText, { color: theme.text }]}>가상계좌 정보</ThemedText>
            </View>

            <View style={styles.accountInfoRow}>
              <ThemedText style={[styles.accountLabel, { color: Colors.light.tabIconDefault }]}>은행</ThemedText>
              <ThemedText style={[styles.accountValue, { color: theme.text }]}>{VIRTUAL_ACCOUNT.bank}</ThemedText>
            </View>
            <View style={styles.accountInfoRow}>
              <ThemedText style={[styles.accountLabel, { color: Colors.light.tabIconDefault }]}>계좌번호</ThemedText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <ThemedText style={[styles.accountNumberText, { color: BrandColors.requester }]}>
                  {VIRTUAL_ACCOUNT.accountNumber}
                </ThemedText>
                <Pressable onPress={handleCopyAccount} style={styles.copyButton}>
                  <Icon name="copy-outline" size={16} color={BrandColors.requester} />
                  <ThemedText style={[styles.copyText, { color: BrandColors.requester }]}>복사</ThemedText>
                </Pressable>
              </View>
            </View>
            <View style={styles.accountInfoRow}>
              <ThemedText style={[styles.accountLabel, { color: Colors.light.tabIconDefault }]}>예금주</ThemedText>
              <ThemedText style={[styles.accountValue, { color: theme.text }]}>{VIRTUAL_ACCOUNT.holder}</ThemedText>
            </View>
            <View style={styles.accountInfoRow}>
              <ThemedText style={[styles.accountLabel, { color: Colors.light.tabIconDefault }]}>입금액</ThemedText>
              <ThemedText style={[styles.accountAmountText, { color: BrandColors.requester }]}>
                {deposit.toLocaleString()}원
              </ThemedText>
            </View>
            <View style={[styles.accountInfoRow, { borderBottomWidth: 0 }]}>
              <ThemedText style={[styles.accountLabel, { color: Colors.light.tabIconDefault }]}>입금 기한</ThemedText>
              <ThemedText style={[styles.accountValue, { color: theme.text }]}>발급일로부터 24시간</ThemedText>
            </View>
          </View>
        )}

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

      <View style={[styles.footer, { backgroundColor: theme.backgroundRoot }]}>
        {paymentStatus === 'confirmed' ? (
          <Pressable
            style={[styles.button, styles.buttonPrimary, { backgroundColor: '#10B981', flex: 1 }]}
            onPress={handleComplete}
          >
            <Icon name="checkmark-circle-outline" size={20} color="#FFFFFF" />
            <ThemedText style={[styles.buttonText, { color: '#FFFFFF', marginLeft: Spacing.xs }]}>완료</ThemedText>
          </Pressable>
        ) : paymentStatus === 'pending' ? (
          <>
            <Pressable
              style={[styles.button, styles.buttonSecondary, { borderColor: BrandColors.requester }]}
              onPress={onBack}
            >
              <ThemedText style={[styles.buttonText, { color: BrandColors.requester }]}>이전</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.button, styles.buttonPrimary, { backgroundColor: BrandColors.requester }]}
              onPress={handleRequestVirtualAccount}
            >
              <Icon name="card-outline" size={18} color="#FFFFFF" />
              <ThemedText style={[styles.buttonText, { color: '#FFFFFF', marginLeft: Spacing.xs }]}>
                가상계좌 요청
              </ThemedText>
            </Pressable>
          </>
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
              <Icon name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <ThemedText style={[styles.buttonText, { color: '#FFFFFF', marginLeft: Spacing.xs }]}>
                {paymentStatus === 'processing' ? "확인 중..." : "입금 확인"}
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
  accountCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  accountHeaderText: {
    ...Typography.heading3,
    fontWeight: 'bold',
  },
  accountInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  accountLabel: {
    ...Typography.caption,
  },
  accountValue: {
    ...Typography.body,
    fontWeight: '600',
  },
  accountNumberText: {
    ...Typography.body,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  accountAmountText: {
    ...Typography.heading2,
    fontWeight: 'bold',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.requester,
  },
  copyText: {
    fontSize: 12,
    fontWeight: '600',
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
