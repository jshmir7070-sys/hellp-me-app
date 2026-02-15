import React, { useState } from "react";
import { View, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Step7Props } from "./types";
import { useAuth } from "@/contexts/AuthContext";

export default function Step7Contract({
  activeTab,
  courierForm,
  otherCourierForm,
  coldTruckForm,
  onNext,
  onBack,
  onSubmit,
  isSubmitting,
  theme,
  isDark,
  bottomPadding,
}: Step7Props) {
  const { user } = useAuth();
  const [hasReadContract, setHasReadContract] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const getCompanyName = () => {
    if (activeTab === "택배사") return courierForm.company;
    if (activeTab === "기타택배") return otherCourierForm.companyName;
    return coldTruckForm.company;
  };

  const handleSignatureComplete = (signature: string) => {
    setSignatureData(signature);
    setShowSignature(false);
  };

  const handleVerify = () => {
    Alert.alert(
      "본인인증",
      "본인인증을 진행하시겠습니까?\n(SMS 인증으로 진행됩니다)",
      [
        { text: "취소", style: "cancel" },
        {
          text: "인증하기",
          onPress: () => {
            // 실제 SMS 본인인증 연동 시 여기에 구현
            setIsVerified(true);
            Alert.alert("인증 완료", "본인인증이 완료되었습니다.");
          },
        },
      ]
    );
  };

  const handleNext = () => {
    if (!hasReadContract) {
      Alert.alert("알림", "계약서를 먼저 확인해주세요.");
      return;
    }
    if (!signatureData) {
      Alert.alert("알림", "서명을 완료해주세요.");
      return;
    }
    if (!isVerified) {
      Alert.alert("알림", "본인인증을 완료해주세요.");
      return;
    }
    // 오더 제출 (API 호출)
    onSubmit();
  };

  const isAllComplete = hasReadContract && !!signatureData && isVerified;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            7단계: 계약서 작성 · 서명 · 본인인증
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            계약서를 확인하고 서명 후 본인인증을 완료해주세요
          </ThemedText>
        </View>

        {/* 1. 계약서 확인 */}
        <View style={[styles.stepCard, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
          <View style={styles.stepCardHeader}>
            <View style={[styles.stepBadge, { backgroundColor: hasReadContract ? '#10B981' : BrandColors.requester }]}>
              {hasReadContract ? (
                <Icon name="checkmark-outline" size={16} color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.stepBadgeText}>1</ThemedText>
              )}
            </View>
            <ThemedText style={[styles.stepCardTitle, { color: theme.text }]}>
              계약서 확인
            </ThemedText>
          </View>
          <ThemedText style={[styles.stepCardDescription, { color: Colors.light.tabIconDefault }]}>
            {getCompanyName()} 오더에 대한 운송주선 계약서입니다
          </ThemedText>
          <Pressable
            style={[styles.actionButton, { borderColor: BrandColors.requester, backgroundColor: hasReadContract ? (isDark ? '#064E3B' : '#ECFDF5') : 'transparent' }]}
            onPress={() => setHasReadContract(true)}
          >
            <Icon name={hasReadContract ? "checkmark-circle-outline" : "document-text-outline"} size={20} color={hasReadContract ? '#10B981' : BrandColors.requester} />
            <ThemedText style={[styles.actionButtonText, { color: hasReadContract ? '#10B981' : BrandColors.requester }]}>
              {hasReadContract ? "계약서 확인 완료" : "계약서 확인하기"}
            </ThemedText>
          </Pressable>
        </View>

        {/* 2. 전자 서명 */}
        <View style={[styles.stepCard, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
          <View style={styles.stepCardHeader}>
            <View style={[styles.stepBadge, { backgroundColor: signatureData ? '#10B981' : BrandColors.requester }]}>
              {signatureData ? (
                <Icon name="checkmark-outline" size={16} color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.stepBadgeText}>2</ThemedText>
              )}
            </View>
            <ThemedText style={[styles.stepCardTitle, { color: theme.text }]}>
              전자 서명
            </ThemedText>
          </View>
          <ThemedText style={[styles.stepCardDescription, { color: Colors.light.tabIconDefault }]}>
            계약서에 동의하는 서명을 해주세요
          </ThemedText>
          {signatureData ? (
            <View style={[styles.signaturePreview, { borderColor: '#10B981' }]}>
              <Icon name="checkmark-circle" size={24} color="#10B981" />
              <ThemedText style={[styles.signaturePreviewText, { color: '#10B981' }]}>서명 완료</ThemedText>
              <Pressable onPress={() => { setSignatureData(null); setShowSignature(true); }}>
                <ThemedText style={{ color: BrandColors.requester }}>다시 서명</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.actionButton, { borderColor: BrandColors.requester }]}
              onPress={() => setShowSignature(true)}
              disabled={!hasReadContract}
            >
              <Icon name="create-outline" size={20} color={hasReadContract ? BrandColors.requester : Colors.light.tabIconDefault} />
              <ThemedText style={[styles.actionButtonText, { color: hasReadContract ? BrandColors.requester : Colors.light.tabIconDefault }]}>
                서명하기
              </ThemedText>
            </Pressable>
          )}
        </View>

        {/* 3. 본인인증 */}
        <View style={[styles.stepCard, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
          <View style={styles.stepCardHeader}>
            <View style={[styles.stepBadge, { backgroundColor: isVerified ? '#10B981' : BrandColors.requester }]}>
              {isVerified ? (
                <Icon name="checkmark-outline" size={16} color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.stepBadgeText}>3</ThemedText>
              )}
            </View>
            <ThemedText style={[styles.stepCardTitle, { color: theme.text }]}>
              본인인증
            </ThemedText>
          </View>
          <ThemedText style={[styles.stepCardDescription, { color: Colors.light.tabIconDefault }]}>
            {user?.phone || "등록된 전화번호"}로 SMS 인증을 진행합니다
          </ThemedText>
          <Pressable
            style={[styles.actionButton, {
              borderColor: isVerified ? '#10B981' : BrandColors.requester,
              backgroundColor: isVerified ? (isDark ? '#064E3B' : '#ECFDF5') : 'transparent'
            }]}
            onPress={handleVerify}
            disabled={!signatureData || isVerified}
          >
            <Icon name={isVerified ? "checkmark-circle-outline" : "shield-checkmark-outline"} size={20} color={isVerified ? '#10B981' : (signatureData ? BrandColors.requester : Colors.light.tabIconDefault)} />
            <ThemedText style={[styles.actionButtonText, { color: isVerified ? '#10B981' : (signatureData ? BrandColors.requester : Colors.light.tabIconDefault) }]}>
              {isVerified ? "인증 완료" : "본인인증 하기"}
            </ThemedText>
          </Pressable>
        </View>

        {isAllComplete && (
          <View style={[styles.infoBox, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
            <Icon name="checkmark-circle" size={20} color="#10B981" />
            <ThemedText style={[styles.infoText, { color: isDark ? '#6EE7B7' : '#065F46' }]}>
              모든 절차가 완료되었습니다. 다음 단계로 진행해주세요.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {showSignature && (
        <View style={[StyleSheet.absoluteFill, styles.signatureOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.97)' }]}>
          <View style={styles.signatureHeader}>
            <ThemedText style={[styles.signatureTitle, { color: theme.text }]}>전자 서명</ThemedText>
            <Pressable onPress={() => setShowSignature(false)}>
              <Icon name="close-outline" size={28} color={theme.text} />
            </Pressable>
          </View>
          <View style={[styles.signaturePad, { borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
            <ThemedText style={[styles.signaturePlaceholder, { color: Colors.light.tabIconDefault }]}>
              아래 영역에 서명해주세요
            </ThemedText>
            {/* 간단한 터치 서명 영역 */}
            <Pressable
              style={[styles.signatureArea, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}
              onPress={() => handleSignatureComplete("signature-data-placeholder")}
            >
              <Icon name="create-outline" size={40} color={Colors.light.tabIconDefault} />
              <ThemedText style={{ color: Colors.light.tabIconDefault, marginTop: Spacing.sm }}>
                터치하여 서명 완료
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.footer, { backgroundColor: theme.backgroundRoot, paddingBottom: bottomPadding || 0 }]}>
        <Pressable
          style={[styles.button, styles.buttonSecondary, { borderColor: BrandColors.requester }]}
          onPress={onBack}
          disabled={isSubmitting}
        >
          <ThemedText style={[styles.buttonText, { color: BrandColors.requester }]}>이전</ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.button,
            styles.buttonPrimary,
            { backgroundColor: BrandColors.requester, opacity: isAllComplete && !isSubmitting ? 1 : 0.6 },
          ]}
          onPress={handleNext}
          disabled={!isAllComplete || isSubmitting}
        >
          <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>
            {isSubmitting ? "제출 중..." : "오더 제출"}
          </ThemedText>
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
  stepCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepCardTitle: {
    ...Typography.body,
    fontWeight: 'bold',
  },
  stepCardDescription: {
    ...Typography.caption,
    marginBottom: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  actionButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  signaturePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  signaturePreviewText: {
    ...Typography.body,
    fontWeight: '600',
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
  signatureOverlay: {
    zIndex: 100,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  signatureTitle: {
    ...Typography.heading2,
  },
  signaturePad: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  signaturePlaceholder: {
    ...Typography.caption,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  signatureArea: {
    height: 200,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
