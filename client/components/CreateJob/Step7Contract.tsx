import React, { useState, useRef } from "react";
import { View, Pressable, StyleSheet, ScrollView, Alert, Modal, TextInput } from "react-native";
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
  contractSettings,
}: Step7Props) {
  const depositRate = contractSettings?.depositRate ?? 10;
  const cancelBefore24h = contractSettings?.cancelBefore24hRefundRate ?? 100;
  const cancelWithin24h = contractSettings?.cancelWithin24hRefundRate ?? 50;
  const cancelSameDay = contractSettings?.cancelSameDayRefundRate ?? 0;
  const { user } = useAuth();
  const [hasReadContract, setHasReadContract] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [sentCode, setSentCode] = useState("");

  const getCompanyName = () => {
    if (activeTab === "택배사") return courierForm.company;
    if (activeTab === "기타택배") return otherCourierForm.companyName;
    return coldTruckForm.company;
  };

  const getDeliveryArea = () => {
    if (activeTab === "택배사") return `${courierForm.regionLarge} ${courierForm.regionMedium}`;
    if (activeTab === "기타택배") return `${otherCourierForm.regionLarge} ${otherCourierForm.regionMedium}`;
    return coldTruckForm.loadingPoint;
  };

  const getVehicleType = () => {
    if (activeTab === "택배사") return courierForm.vehicleType;
    if (activeTab === "기타택배") return otherCourierForm.vehicleType;
    return coldTruckForm.vehicleType;
  };

  const getSchedule = () => {
    if (activeTab === "택배사") return `${courierForm.requestDate} ~ ${courierForm.requestDateEnd}`;
    if (activeTab === "기타택배") return `${otherCourierForm.requestDate} ~ ${otherCourierForm.requestDateEnd}`;
    return `${coldTruckForm.requestDate} ~ ${coldTruckForm.requestDateEnd}`;
  };

  const getTodayFormatted = () => {
    const today = new Date();
    return `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  };

  const handleOpenContract = () => {
    setShowContractModal(true);
  };

  const handleConfirmContract = () => {
    setHasReadContract(true);
    setShowContractModal(false);
  };

  const handleSignatureComplete = () => {
    if (!signatureName.trim()) {
      Alert.alert("알림", "서명자 성명을 입력해주세요.");
      return;
    }
    setSignatureData(signatureName.trim());
    setShowSignature(false);
  };

  const handleRequestVerification = () => {
    // 6자리 인증번호 생성
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setSentCode(code);
    setShowVerificationModal(true);
    Alert.alert("인증번호 발송", `${user?.phone || "등록된 번호"}로 인증번호가 발송되었습니다.\n\n(테스트용 인증번호: ${code})`);
  };

  const handleVerifyCode = () => {
    if (verificationCode === sentCode) {
      setIsVerified(true);
      setShowVerificationModal(false);
      Alert.alert("인증 완료", "본인인증이 완료되었습니다.");
    } else {
      Alert.alert("인증 실패", "인증번호가 일치하지 않습니다. 다시 입력해주세요.");
    }
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
    onSubmit();
  };

  const isAllComplete = hasReadContract && !!signatureData && isVerified;

  const renderContractContent = () => (
    <ScrollView style={styles.contractScroll}>
      <ThemedText style={[styles.contractTitle, { color: theme.text }]}>
        운송주선 계약서
      </ThemedText>

      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        본 계약은 「화물자동차 운수사업법」 및 관련 법령에 따라 아래 당사자 간에 운송주선에 관한 사항을 정하기 위하여 체결합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제1조 (계약 당사자)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 위탁자(이하 "갑"): {user?.name || user?.username || "(요청자)"}{"\n"}
        2. 수탁자(이하 "을"): 헬프미 주식회사{"\n"}
        3. 운송사: {getCompanyName() || "(미정)"}
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제2조 (계약 목적)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        "을"은 "갑"의 위탁에 따라 화물 운송을 주선하며, "갑"은 이에 대한 대가를 지급합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제3조 (운송 내용)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 운송 구간: {getDeliveryArea() || "-"}{"\n"}
        2. 차량 종류: {getVehicleType() || "-"}{"\n"}
        3. 운송 기간: {getSchedule()}{"\n"}
        4. 운송 유형: {activeTab}
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제4조 (운임 및 대금 지급)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 운임은 "갑"과 "을"이 합의한 단가 기준으로 산정합니다.{"\n"}
        2. "갑"은 오더 등록 시 계약금(총 운임의 {depositRate}%)을 선납합니다.{"\n"}
        3. 잔금은 운송 완료 후 정산일에 지급합니다.{"\n"}
        4. 긴급 오더의 경우 추가 할증이 적용될 수 있습니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제5조 (갑의 의무)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. "갑"은 정확한 화물 정보 및 배송지 정보를 제공하여야 합니다.{"\n"}
        2. "갑"은 합의된 일정에 따라 상·하차에 협조하여야 합니다.{"\n"}
        3. "갑"은 위험물, 불법 화물을 의뢰할 수 없습니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제6조 (을의 의무)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. "을"은 적합한 운송 차량 및 인력을 배정하여야 합니다.{"\n"}
        2. "을"은 화물의 안전한 운송을 위해 최선을 다하여야 합니다.{"\n"}
        3. "을"은 운송 중 발생한 사고에 대해 관련 법령에 따라 책임을 집니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제7조 (계약 해지 및 위약금)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 운송 시작 24시간 전까지 취소 시 계약금의 {cancelBefore24h}%가 환불됩니다.{"\n"}
        2. 운송 시작 24시간 이내 취소 시 계약금의 {100 - cancelWithin24h}%가 위약금으로 공제됩니다.{"\n"}
        3. 운송 당일 취소 시 계약금의 {100 - cancelSameDay}%가 위약금으로 공제됩니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제8조 (손해배상)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 운송 중 "을"의 귀책 사유로 화물이 멸실·훼손된 경우, "을"은 실손해액 범위 내에서 배상합니다.{"\n"}
        2. "갑"이 제공한 정보의 부정확으로 인한 손해는 "갑"이 부담합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제9조 (분쟁 해결)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        본 계약과 관련한 분쟁은 당사자 간 협의하여 해결하며, 협의가 이루어지지 않을 경우 관할 법원에 따릅니다.
      </ThemedText>

      <ThemedText style={[styles.contractDate, { color: theme.text }]}>
        {"\n"}계약일: {getTodayFormatted()}
      </ThemedText>
    </ScrollView>
  );

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
            onPress={handleOpenContract}
          >
            <Icon name={hasReadContract ? "checkmark-circle-outline" : "document-text-outline"} size={20} color={hasReadContract ? '#10B981' : BrandColors.requester} />
            <ThemedText style={[styles.actionButtonText, { color: hasReadContract ? '#10B981' : BrandColors.requester }]}>
              {hasReadContract ? "계약서 확인 완료 (다시 보기)" : "계약서 확인하기"}
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
              <ThemedText style={[styles.signaturePreviewText, { color: '#10B981' }]}>
                서명 완료 ({signatureData})
              </ThemedText>
              <Pressable onPress={() => { setSignatureData(null); setSignatureName(""); }}>
                <ThemedText style={{ color: BrandColors.requester }}>다시 서명</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.actionButton, { borderColor: BrandColors.requester, opacity: hasReadContract ? 1 : 0.5 }]}
              onPress={() => { if (hasReadContract) setShowSignature(true); }}
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
              backgroundColor: isVerified ? (isDark ? '#064E3B' : '#ECFDF5') : 'transparent',
              opacity: (signatureData && !isVerified) ? 1 : (isVerified ? 1 : 0.5),
            }]}
            onPress={handleRequestVerification}
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
              모든 절차가 완료되었습니다. "오더 제출" 버튼을 눌러주세요.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* 계약서 모달 */}
      <Modal visible={showContractModal} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>운송주선 계약서</ThemedText>
            <Pressable onPress={() => setShowContractModal(false)}>
              <Icon name="close-outline" size={28} color={theme.text} />
            </Pressable>
          </View>
          {renderContractContent()}
          <View style={[styles.modalFooter, { backgroundColor: theme.backgroundRoot, borderTopColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
            <Pressable
              style={[styles.modalButton, { backgroundColor: BrandColors.requester }]}
              onPress={handleConfirmContract}
            >
              <ThemedText style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                {hasReadContract ? "확인 완료" : "계약서 내용을 확인하였습니다"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 서명 모달 */}
      <Modal visible={showSignature} animationType="slide" transparent>
        <View style={styles.signatureOverlay}>
          <View style={[styles.signatureModal, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.signatureHeader, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <ThemedText style={[styles.signatureTitle, { color: theme.text }]}>전자 서명</ThemedText>
              <Pressable onPress={() => setShowSignature(false)}>
                <Icon name="close-outline" size={28} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.signatureBody}>
              <ThemedText style={[styles.signatureLabel, { color: theme.text }]}>
                서명자 성명 입력
              </ThemedText>
              <ThemedText style={[styles.signatureHint, { color: Colors.light.tabIconDefault }]}>
                본인의 실명을 정확히 입력해주세요. 전자서명법에 따라 계약 당사자의 서명으로 인정됩니다.
              </ThemedText>
              <TextInput
                style={[
                  styles.signatureInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                placeholder="성명을 입력해주세요"
                placeholderTextColor={Colors.light.tabIconDefault}
                value={signatureName}
                onChangeText={setSignatureName}
                autoFocus
              />

              <View style={[styles.signaturePreviewBox, { borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0', backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
                <ThemedText style={[styles.signaturePreviewLabel, { color: Colors.light.tabIconDefault }]}>
                  서명 미리보기
                </ThemedText>
                <ThemedText style={[styles.signatureDisplayText, { color: theme.text }]}>
                  {signatureName || " "}
                </ThemedText>
                <ThemedText style={[styles.signatureDateText, { color: Colors.light.tabIconDefault }]}>
                  {getTodayFormatted()}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.signatureFooter, { borderTopColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <Pressable
                style={[styles.signatureCancel, { borderColor: BrandColors.requester }]}
                onPress={() => setShowSignature(false)}
              >
                <ThemedText style={[styles.signatureCancelText, { color: BrandColors.requester }]}>취소</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.signatureConfirm, { backgroundColor: BrandColors.requester, opacity: signatureName.trim() ? 1 : 0.5 }]}
                onPress={handleSignatureComplete}
                disabled={!signatureName.trim()}
              >
                <ThemedText style={styles.signatureConfirmText}>서명 완료</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 본인인증 모달 */}
      <Modal visible={showVerificationModal} animationType="slide" transparent>
        <View style={styles.signatureOverlay}>
          <View style={[styles.signatureModal, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.signatureHeader, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <ThemedText style={[styles.signatureTitle, { color: theme.text }]}>SMS 본인인증</ThemedText>
              <Pressable onPress={() => setShowVerificationModal(false)}>
                <Icon name="close-outline" size={28} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.signatureBody}>
              <ThemedText style={[styles.signatureLabel, { color: theme.text }]}>
                인증번호 입력
              </ThemedText>
              <ThemedText style={[styles.signatureHint, { color: Colors.light.tabIconDefault }]}>
                {user?.phone || "등록된 전화번호"}로 발송된 6자리 인증번호를 입력해주세요.
              </ThemedText>
              <TextInput
                style={[
                  styles.signatureInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                    textAlign: 'center',
                    fontSize: 24,
                    letterSpacing: 8,
                  },
                ]}
                placeholder="000000"
                placeholderTextColor={Colors.light.tabIconDefault}
                value={verificationCode}
                onChangeText={setVerificationCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <Pressable onPress={handleRequestVerification} style={styles.resendButton}>
                <ThemedText style={{ color: BrandColors.requester }}>
                  인증번호 재발송
                </ThemedText>
              </Pressable>
            </View>

            <View style={[styles.signatureFooter, { borderTopColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <Pressable
                style={[styles.signatureCancel, { borderColor: BrandColors.requester }]}
                onPress={() => setShowVerificationModal(false)}
              >
                <ThemedText style={[styles.signatureCancelText, { color: BrandColors.requester }]}>취소</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.signatureConfirm, { backgroundColor: BrandColors.requester, opacity: verificationCode.length === 6 ? 1 : 0.5 }]}
                onPress={handleVerifyCode}
                disabled={verificationCode.length !== 6}
              >
                <ThemedText style={styles.signatureConfirmText}>인증 확인</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
    paddingBottom: 150,
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
    paddingHorizontal: Spacing.md,
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
  // 계약서 모달
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  modalTitle: {
    ...Typography.heading2,
  },
  contractScroll: {
    flex: 1,
    padding: Spacing.lg,
  },
  contractTitle: {
    ...Typography.heading2,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  contractSectionTitle: {
    ...Typography.body,
    fontWeight: 'bold',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  contractText: {
    ...Typography.body,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  contractDate: {
    ...Typography.body,
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  modalFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  modalButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalButtonText: {
    ...Typography.button,
    fontWeight: 'bold',
  },
  // 서명 모달
  signatureOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  signatureModal: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  signatureTitle: {
    ...Typography.heading3,
    fontWeight: 'bold',
  },
  signatureBody: {
    padding: Spacing.lg,
  },
  signatureLabel: {
    ...Typography.body,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  signatureHint: {
    ...Typography.caption,
    marginBottom: Spacing.md,
  },
  signatureInput: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  signaturePreviewBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  signaturePreviewLabel: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
  },
  signatureDisplayText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  signatureDateText: {
    ...Typography.caption,
  },
  signatureFooter: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
  },
  signatureCancel: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  signatureCancelText: {
    ...Typography.button,
  },
  signatureConfirm: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  signatureConfirmText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
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
