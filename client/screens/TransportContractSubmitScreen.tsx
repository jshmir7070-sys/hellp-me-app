import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getToken } from '@/utils/secure-token-storage';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, BrandColors, Colors, Typography } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

type TransportContractSubmitScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface DocumentData {
  id?: number;
  type: 'transportContract';
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'not_submitted';
  uploadedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  contractCompanyName?: string;
  contractDate?: string;
  signatureName?: string;
  verificationPhone?: string;
}

export default function TransportContractSubmitScreen({ navigation }: TransportContractSubmitScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [isUploading, setIsUploading] = useState(false);

  // Step 1: 계약서 확인 + 동의
  const [hasReadContract, setHasReadContract] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [agreeConsignment, setAgreeConsignment] = useState(false);
  const [agreeSafety, setAgreeSafety] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  // Step 2: 서명
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState('');

  // Step 3: 본인인증
  const [isVerified, setIsVerified] = useState(false);
  const [verificationPhone, setVerificationPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const { data: document } = useQuery<DocumentData>({
    queryKey: ['/api/helpers/documents/transportContract'],
  });

  const canResubmit = true; // 승인 후에도 수정 가능
  const isReadOnly = document?.status === 'reviewing'; // 검토중일 때만 읽기전용

  // 승인된/검토중인 서류 데이터 로드
  React.useEffect(() => {
    if (document && (document.status === 'approved' || document.status === 'reviewing')) {
      setSignatureName(document.signatureName || '');
      setSignatureData(document.signatureName || null);
      setVerificationPhone(document.verificationPhone || '');
      setIsVerified(!!document.verificationPhone);
      setHasReadContract(true);
      setAgreeConsignment(true);
      setAgreeSafety(true);
      setAgreePrivacy(true);
    }
  }, [document]);

  const getTodayFormatted = (): string => {
    const today = new Date();
    return `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  };

  const formatPhone = (value: string): string => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  // Step 1 handlers
  const handleConfirmContract = () => {
    if (!agreeConsignment || !agreeSafety || !agreePrivacy) {
      Alert.alert('알림', '필수 동의사항을 모두 체크해주세요.');
      return;
    }
    setHasReadContract(true);
    setShowContractModal(false);
  };

  // Step 2 handlers
  const handleSignatureComplete = () => {
    if (!signatureName.trim()) {
      Alert.alert('알림', '서명자 성명을 입력해주세요.');
      return;
    }
    setSignatureData(signatureName.trim());
    setShowSignature(false);
  };

  // Step 3 handlers
  const handleSendCode = () => {
    if (!verificationPhone.trim() || verificationPhone.replace(/[^0-9]/g, '').length < 10) {
      Alert.alert('알림', '올바른 전화번호를 입력해주세요.');
      return;
    }
    setCodeSent(true);
    Alert.alert('인증번호 발송', `${verificationPhone}로 인증번호가 발송되었습니다.\n\n(테스트 인증번호: 123456)`);
  };

  const handleVerifyCode = () => {
    if (verificationCode === '123456') {
      setIsVerified(true);
      setShowVerificationModal(false);
      Alert.alert('인증 완료', '본인인증이 완료되었습니다.');
    } else {
      Alert.alert('인증 실패', '인증번호가 일치하지 않습니다.\n(테스트 인증번호: 123456)');
    }
  };

  const allAgreed = agreeConsignment && agreeSafety && agreePrivacy;
  const isAllComplete = hasReadContract && !!signatureData && isVerified;

  const handleSubmit = async () => {
    if (!isAllComplete) {
      Alert.alert('알림', '계약서 확인, 서명, 본인인증을 모두 완료해주세요.');
      return;
    }

    setIsUploading(true);
    try {
      const token = await getToken();
      const contractDate = new Date().toISOString().split('T')[0];

      const response = await fetch(
        new URL('/api/helpers/documents/transportContract', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contractCompanyName: user?.name || '',
            contractDate,
            signatureName: signatureData,
            verificationPhone,
            contractConsent: JSON.stringify({
              agreeConsignment,
              agreeSafety,
              agreePrivacy,
              agreedAt: new Date().toISOString(),
            }),
          }),
        }
      );

      if (response.ok) {
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents'] });
        await queryClient.invalidateQueries({ queryKey: ['/api/helpers/documents/status'] });
        Alert.alert('완료', '저장되었습니다.', [
          { text: '확인', onPress: () => navigation.goBack() },
        ]);
      } else {
        const data = await response.json();
        Alert.alert('오류', data.message || '제출에 실패했습니다');
      }
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('오류', '제출에 실패했습니다');
    } finally {
      setIsUploading(false);
    }
  };

  const renderContractContent = () => (
    <ScrollView style={styles.contractScroll}>
      <ThemedText style={[styles.contractTitle, { color: theme.text }]}>
        화물자동차 운송사업 위수탁 계약서
      </ThemedText>

      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        본 계약은 「화물자동차 운수사업법」 제29조 및 같은 법 시행규칙 제28조에 따라, 화물자동차 운송사업의 위수탁에 관한 사항을 정하기 위하여 체결합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>제1조 (목적)</ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        본 계약은 위탁자(이하 "갑")가 수탁자(이하 "을")에게 화물자동차 운송사업의 일부를 위탁하고, "을"이 이를 수탁하여 성실히 운송 업무를 수행함에 있어 필요한 사항을 정함을 목적으로 합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>제2조 (계약 당사자)</ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 위탁자("갑"): 화물자동차 운송사업 허가를 받은 운송사업자{"\n"}
        2. 수탁자("을"): 본 계약에 따라 운송 업무를 수행하는 차주(헬퍼){"\n"}
        3. "을"은 「화물자동차 운수사업법」에 따른 화물운송종사자격을 보유하여야 합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>제3조 (위탁 업무 범위)</ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. "갑"은 "을"에게 택배, 화물 등의 운송 업무를 위탁합니다.{"\n"}
        2. 운송 구간, 물량, 일정 등 구체적인 업무 범위는 플랫폼을 통해 개별 오더로 배정합니다.{"\n"}
        3. "을"은 배정된 오더에 따라 성실히 운송 업무를 수행하여야 합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>제4조 (운송 차량 및 장비)</ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. "을"은 본인 소유 또는 정당한 사용 권한이 있는 화물자동차를 사용하여야 합니다.{"\n"}
        2. 차량은 자동차관리법에 따른 검사를 완료하고, 자동차보험에 가입되어 있어야 합니다.{"\n"}
        3. "을"은 운송에 필요한 장비(카트, 바코드 스캐너 등)를 자비로 준비하여야 합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>제5조 (수수료 및 정산)</ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. "갑"은 "을"의 운송 업무 수행에 대하여 플랫폼에서 정한 기준에 따라 운임을 지급합니다.{"\n"}
        2. 운임 정산은 마감 자료(실제 배송 수량) 기준으로 확정됩니다.{"\n"}
        3. 정산 주기 및 지급 방법은 플랫폼 정책에 따릅니다.{"\n"}
        4. "을"은 정산 내역에 이의가 있을 경우, 정산일로부터 7일 이내에 이의를 제기할 수 있습니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>제6조 (계약 기간)</ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 본 계약은 체결일로부터 1년간 유효하며, 별도의 해지 통보가 없는 한 동일 조건으로 자동 갱신됩니다.{"\n"}
        2. 계약 해지 시 최소 30일 전에 상대방에게 서면(전자문서 포함)으로 통보하여야 합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>제7조 (손해배상 및 보험)</ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. "을"의 고의 또는 과실로 화물이 멸실, 훼손, 지연된 경우 "을"은 손해를 배상하여야 합니다.{"\n"}
        2. "을"은 적재물배상보험 또는 공제에 가입하여야 합니다.{"\n"}
        3. 운송 중 발생한 교통사고에 대한 책임은 관련 법령에 따릅니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>제8조 (계약 해지 및 분쟁 해결)</ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 당사자 일방이 본 계약의 중요한 조항을 위반한 경우, 상대방은 계약을 해지할 수 있습니다.{"\n"}
        2. 본 계약과 관련한 분쟁은 당사자 간 협의로 해결하며, 협의 불성립 시 관할 법원에서 해결합니다.{"\n"}
        3. 본 계약에 명시되지 않은 사항은 「화물자동차 운수사업법」 및 관련 법령에 따릅니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        필수 동의사항
      </ThemedText>

      <Pressable style={styles.consentRow} onPress={() => setAgreeConsignment(!agreeConsignment)}>
        <View style={[styles.checkbox, { backgroundColor: agreeConsignment ? BrandColors.helper : 'transparent', borderColor: agreeConsignment ? BrandColors.helper : '#D1D5DB' }]}>
          {agreeConsignment && <Icon name="checkmark-outline" size={14} color="#FFFFFF" />}
        </View>
        <ThemedText style={[styles.consentText, { color: theme.text }]}>
          제1호: 「화물자동차 운수사업법」 제29조에 따른 화물운송사업 위수탁 계약의 의무와 내용을 충분히 이해하였으며, 이에 동의합니다. <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
        </ThemedText>
      </Pressable>

      <Pressable style={styles.consentRow} onPress={() => setAgreeSafety(!agreeSafety)}>
        <View style={[styles.checkbox, { backgroundColor: agreeSafety ? BrandColors.helper : 'transparent', borderColor: agreeSafety ? BrandColors.helper : '#D1D5DB' }]}>
          {agreeSafety && <Icon name="checkmark-outline" size={14} color="#FFFFFF" />}
        </View>
        <ThemedText style={[styles.consentText, { color: theme.text }]}>
          제2호: 안전운행 의무를 준수하며, 운송 중 발생하는 화물 사고 및 교통사고에 대하여 관련 법령에 따른 책임을 부담할 것에 동의합니다. <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
        </ThemedText>
      </Pressable>

      <Pressable style={styles.consentRow} onPress={() => setAgreePrivacy(!agreePrivacy)}>
        <View style={[styles.checkbox, { backgroundColor: agreePrivacy ? BrandColors.helper : 'transparent', borderColor: agreePrivacy ? BrandColors.helper : '#D1D5DB' }]}>
          {agreePrivacy && <Icon name="checkmark-outline" size={14} color="#FFFFFF" />}
        </View>
        <ThemedText style={[styles.consentText, { color: theme.text }]}>
          제3호: 본 계약 체결 및 운송 업무 수행을 위한 개인정보 수집·이용 및 계약 정보 제공에 동의합니다. <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
        </ThemedText>
      </Pressable>

      <ThemedText style={[styles.contractDate, { color: theme.text }]}>
        {"\n"}계약일: {getTodayFormatted()}
      </ThemedText>
    </ScrollView>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl + 60,
        paddingHorizontal: Spacing.lg,
      }}
    >
      {/* 상태 카드 */}
      {document && document.status !== 'not_submitted' && (
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            {document.status === 'approved' && (
              <>
                <Icon name="checkmark-circle" size={24} color="#10B981" />
                <ThemedText style={[styles.statusTitle, { color: '#10B981' }]}>승인완료</ThemedText>
              </>
            )}
            {document.status === 'reviewing' && (
              <>
                <Icon name="time-outline" size={24} color="#3B82F6" />
                <ThemedText style={[styles.statusTitle, { color: '#3B82F6' }]}>검토중</ThemedText>
              </>
            )}
            {document.status === 'rejected' && (
              <>
                <Icon name="close-circle" size={24} color="#EF4444" />
                <ThemedText style={[styles.statusTitle, { color: '#EF4444' }]}>반려됨</ThemedText>
              </>
            )}
          </View>
          {document.status === 'rejected' && document.rejectionReason && (
            <View style={[styles.rejectionBox, { backgroundColor: '#FEE2E2' }]}>
              <ThemedText style={[styles.rejectionLabel, { color: '#991B1B' }]}>반려 사유:</ThemedText>
              <ThemedText style={[styles.rejectionText, { color: '#991B1B' }]}>{document.rejectionReason}</ThemedText>
            </View>
          )}
          {document.status === 'approved' && (
            <ThemedText style={[styles.statusDescription, { color: theme.tabIconDefault }]}>
              계약서가 승인되었습니다.
            </ThemedText>
          )}
        </Card>
      )}

      {/* Step 1: 계약서 확인 */}
      <Card style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepBadge, { backgroundColor: hasReadContract ? '#10B981' : BrandColors.helper }]}>
            {hasReadContract ? (
              <Icon name="checkmark-outline" size={14} color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.stepBadgeText}>1</ThemedText>
            )}
          </View>
          <ThemedText style={[styles.stepCardTitle, { color: theme.text }]}>
            계약서 확인
          </ThemedText>
        </View>
        <ThemedText style={[styles.stepCardDescription, { color: theme.tabIconDefault }]}>
          화물위탁계약서를 확인하고 필수 동의사항에 체크해주세요
        </ThemedText>
        <Pressable
          style={[styles.actionButton, { borderColor: BrandColors.helper, backgroundColor: hasReadContract ? (isDark ? '#064E3B' : '#ECFDF5') : 'transparent', opacity: isReadOnly ? 0.6 : 1 }]}
          onPress={() => !isReadOnly && setShowContractModal(true)}
          disabled={isReadOnly}
        >
          <Icon name={hasReadContract ? "checkmark-circle-outline" : "document-text-outline"} size={20} color={hasReadContract ? '#10B981' : BrandColors.helper} />
          <ThemedText style={[styles.actionButtonText, { color: hasReadContract ? '#10B981' : BrandColors.helper }]}>
            {hasReadContract ? "계약서 확인 완료" + (isReadOnly ? "" : " (다시 보기)") : "계약서 확인하기"}
          </ThemedText>
        </Pressable>
      </Card>

      {/* Step 2: 서명 */}
      <Card style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepBadge, { backgroundColor: signatureData ? '#10B981' : BrandColors.helper }]}>
            {signatureData ? (
              <Icon name="checkmark-outline" size={14} color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.stepBadgeText}>2</ThemedText>
            )}
          </View>
          <ThemedText style={[styles.stepCardTitle, { color: theme.text }]}>
            전자 서명
          </ThemedText>
        </View>
        <ThemedText style={[styles.stepCardDescription, { color: theme.tabIconDefault }]}>
          계약에 동의하는 서명을 진행합니다
        </ThemedText>
        {signatureData ? (
          <View style={[styles.signaturePreview, { borderColor: '#10B981' }]}>
            <Icon name="checkmark-circle" size={24} color="#10B981" />
            <ThemedText style={[styles.signaturePreviewText, { color: '#10B981' }]}>
              서명 완료 ({signatureData})
            </ThemedText>
            {!isReadOnly && (
              <Pressable onPress={() => { setSignatureData(null); setSignatureName(''); }}>
                <ThemedText style={{ color: BrandColors.helper }}>다시 서명</ThemedText>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            style={[styles.actionButton, { borderColor: BrandColors.helper, opacity: (hasReadContract && !isReadOnly) ? 1 : 0.5 }]}
            onPress={() => { if (hasReadContract && !isReadOnly) setShowSignature(true); }}
            disabled={!hasReadContract || isReadOnly}
          >
            <Icon name="create-outline" size={20} color={(hasReadContract && !isReadOnly) ? BrandColors.helper : theme.tabIconDefault} />
            <ThemedText style={[styles.actionButtonText, { color: (hasReadContract && !isReadOnly) ? BrandColors.helper : theme.tabIconDefault }]}>
              서명하기
            </ThemedText>
          </Pressable>
        )}
      </Card>

      {/* Step 3: 본인인증 */}
      <Card style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <View style={[styles.stepBadge, { backgroundColor: isVerified ? '#10B981' : BrandColors.helper }]}>
            {isVerified ? (
              <Icon name="checkmark-outline" size={14} color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.stepBadgeText}>3</ThemedText>
            )}
          </View>
          <ThemedText style={[styles.stepCardTitle, { color: theme.text }]}>
            본인인증
          </ThemedText>
        </View>
        <ThemedText style={[styles.stepCardDescription, { color: theme.tabIconDefault }]}>
          전화번호를 입력하고 SMS 인증을 진행합니다
        </ThemedText>
        {isVerified && verificationPhone ? (
          <View style={[styles.signaturePreview, { borderColor: '#10B981' }]}>
            <Icon name="checkmark-circle" size={24} color="#10B981" />
            <ThemedText style={[styles.signaturePreviewText, { color: '#10B981' }]}>
              인증 완료 ({verificationPhone})
            </ThemedText>
          </View>
        ) : (
          <Pressable
            style={[styles.actionButton, { borderColor: BrandColors.helper, opacity: (signatureData && !isReadOnly) ? 1 : 0.5 }]}
            onPress={() => { if (signatureData && !isReadOnly) { setShowVerificationModal(true); setCodeSent(false); setVerificationCode(''); } }}
            disabled={!signatureData || isReadOnly}
          >
            <Icon name="shield-checkmark-outline" size={20} color={(signatureData && !isReadOnly) ? BrandColors.helper : theme.tabIconDefault} />
            <ThemedText style={[styles.actionButtonText, { color: (signatureData && !isReadOnly) ? BrandColors.helper : theme.tabIconDefault }]}>
              본인인증 하기
            </ThemedText>
          </Pressable>
        )}
      </Card>

      {/* 완료 안내 */}
      {isAllComplete && (
        <Card style={[styles.completionCard, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
          <Icon name="checkmark-circle" size={20} color="#10B981" />
          <ThemedText style={[styles.completionText, { color: isDark ? '#6EE7B7' : '#065F46' }]}>
            모든 절차가 완료되었습니다. "제출하기" 버튼을 눌러주세요.
          </ThemedText>
        </Card>
      )}

      {/* 제출 버튼 */}
      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          {
            backgroundColor: isReadOnly ? (isDark ? '#374151' : '#E5E7EB') : BrandColors.helper,
            opacity: (pressed || isUploading || (!isReadOnly && !isAllComplete)) ? 0.6 : 1
          }
        ]}
        onPress={isReadOnly ? () => navigation.goBack() : handleSubmit}
        disabled={isUploading || (!isReadOnly && !isAllComplete)}
      >
        {isUploading ? <ActivityIndicator color="#fff" /> : (
          <>
            <Icon name={isReadOnly ? "checkmark-outline" : "checkmark-circle-outline"} size={20} color={isReadOnly ? theme.text : "#fff"} />
            <ThemedText style={[styles.submitButtonText, { color: isReadOnly ? theme.text : '#fff' }]}>
              {isReadOnly ? '확인' : document?.status === 'rejected' ? '재제출하기' : document?.status === 'approved' ? '수정하기' : '제출하기'}
            </ThemedText>
          </>
        )}
      </Pressable>

      {/* 계약서 모달 */}
      <Modal visible={showContractModal} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>화물위탁계약서</ThemedText>
            <Pressable onPress={() => setShowContractModal(false)}>
              <Icon name="close-outline" size={28} color={theme.text} />
            </Pressable>
          </View>
          {renderContractContent()}
          <View style={[styles.modalFooter, { backgroundColor: theme.backgroundRoot, borderTopColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
            {!allAgreed && (
              <ThemedText style={[styles.modalFooterHint, { color: BrandColors.error }]}>
                필수 동의사항을 모두 체크해주세요
              </ThemedText>
            )}
            <Pressable
              style={[styles.modalButton, { backgroundColor: BrandColors.helper, opacity: allAgreed ? 1 : 0.5 }]}
              onPress={handleConfirmContract}
            >
              <ThemedText style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                {hasReadContract ? "계약서 확인 완료" : "위 내용에 동의하고 계약서를 확인합니다"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 서명 모달 */}
      <Modal visible={showSignature} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.signatureContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.signatureHeader, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <ThemedText style={[styles.signatureTitle, { color: theme.text }]}>전자 서명</ThemedText>
              <Pressable onPress={() => setShowSignature(false)}>
                <Icon name="close-outline" size={28} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.signatureBody}>
              <ThemedText style={[styles.signatureLabel, { color: theme.text }]}>서명자 성명</ThemedText>
              <ThemedText style={[styles.signatureHint, { color: theme.tabIconDefault }]}>
                본인의 실명을 정확히 입력해주세요.
              </ThemedText>
              <TextInput
                style={[styles.signatureInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}
                placeholder="성명을 입력해주세요"
                placeholderTextColor={theme.tabIconDefault}
                value={signatureName}
                onChangeText={setSignatureName}
                autoFocus
              />
              {signatureName.trim() && (
                <View style={[styles.signaturePreviewBox, { borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
                  <ThemedText style={[styles.signatureDisplayText, { color: theme.text }]}>
                    {signatureName.trim()}
                  </ThemedText>
                  <ThemedText style={[styles.signatureDateText, { color: theme.tabIconDefault }]}>
                    {getTodayFormatted()}
                  </ThemedText>
                </View>
              )}
            </View>
            <View style={[styles.signatureFooter, { borderTopColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <Pressable style={[styles.signatureCancel, { borderColor: BrandColors.helper }]} onPress={() => setShowSignature(false)}>
                <ThemedText style={[styles.signatureCancelText, { color: BrandColors.helper }]}>취소</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.signatureConfirm, { backgroundColor: BrandColors.helper, opacity: signatureName.trim() ? 1 : 0.5 }]}
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
        <View style={styles.modalOverlay}>
          <View style={[styles.signatureContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.signatureHeader, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <ThemedText style={[styles.signatureTitle, { color: theme.text }]}>SMS 본인인증</ThemedText>
              <Pressable onPress={() => setShowVerificationModal(false)}>
                <Icon name="close-outline" size={28} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.signatureBody}>
              <ThemedText style={[styles.signatureLabel, { color: theme.text }]}>전화번호 입력</ThemedText>
              <ThemedText style={[styles.signatureHint, { color: theme.tabIconDefault }]}>
                인증번호를 받을 전화번호를 입력해주세요.
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
                <TextInput
                  style={[styles.signatureInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0', flex: 1, marginBottom: 0 }]}
                  placeholder="010-0000-0000"
                  placeholderTextColor={theme.tabIconDefault}
                  value={verificationPhone}
                  onChangeText={(text) => setVerificationPhone(formatPhone(text))}
                  keyboardType="phone-pad"
                  maxLength={13}
                  editable={!codeSent}
                />
                <Pressable
                  style={[styles.sendCodeButton, { backgroundColor: codeSent ? '#10B981' : BrandColors.helper }]}
                  onPress={handleSendCode}
                  disabled={codeSent}
                >
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>
                    {codeSent ? '발송완료' : '인증요청'}
                  </ThemedText>
                </Pressable>
              </View>
              {codeSent && (
                <>
                  <ThemedText style={[styles.signatureLabel, { color: theme.text }]}>인증번호 입력</ThemedText>
                  <ThemedText style={[styles.signatureHint, { color: theme.tabIconDefault }]}>
                    {verificationPhone}로 발송된 6자리 인증번호를 입력해주세요.
                  </ThemedText>
                  <TextInput
                    style={[styles.signatureInput, { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0', textAlign: 'center', fontSize: 24, letterSpacing: 8 }]}
                    placeholder="123456"
                    placeholderTextColor={theme.tabIconDefault}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                  <Pressable onPress={() => { setCodeSent(false); setVerificationCode(''); }} style={styles.resendButton}>
                    <ThemedText style={{ color: BrandColors.helper }}>전화번호 변경 / 재발송</ThemedText>
                  </Pressable>
                </>
              )}
            </View>
            <View style={[styles.signatureFooter, { borderTopColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <Pressable style={[styles.signatureCancel, { borderColor: BrandColors.helper }]} onPress={() => setShowVerificationModal(false)}>
                <ThemedText style={[styles.signatureCancelText, { color: BrandColors.helper }]}>취소</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.signatureConfirm, { backgroundColor: BrandColors.helper, opacity: (codeSent && verificationCode.length === 6) ? 1 : 0.5 }]}
                onPress={handleVerifyCode}
                disabled={!codeSent || verificationCode.length !== 6}
              >
                <ThemedText style={styles.signatureConfirmText}>인증 확인</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statusCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  statusTitle: { fontSize: 18, fontWeight: '600' },
  statusDescription: { fontSize: 14, marginTop: Spacing.sm },
  rejectionBox: { padding: Spacing.md, borderRadius: BorderRadius.sm, marginTop: Spacing.sm },
  rejectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  rejectionText: { fontSize: 14 },
  stepCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  stepCardTitle: { fontSize: 16, fontWeight: '600' },
  stepCardDescription: { fontSize: 13, marginBottom: Spacing.md },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  actionButtonText: { fontSize: 14, fontWeight: '600' },
  signaturePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  signaturePreviewText: { fontSize: 14, fontWeight: '600', flex: 1 },
  completionCard: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  completionText: { fontSize: 13, flex: 1 },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  submitButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  // Contract modal
  contractScroll: { flex: 1, padding: Spacing.lg },
  contractTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.xl },
  contractSectionTitle: { fontSize: 15, fontWeight: '700', marginTop: Spacing.lg, marginBottom: Spacing.sm },
  contractText: { fontSize: 13, lineHeight: 22, marginBottom: Spacing.sm },
  contractDate: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: Spacing.lg },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  consentText: { ...Typography.caption, flex: 1, lineHeight: 20 },
  // Modal common
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  modalFooterHint: { ...Typography.caption, textAlign: 'center', marginBottom: Spacing.sm },
  modalButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalButtonText: { fontSize: 15, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  // Signature modal
  signatureContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  signatureTitle: { fontSize: 18, fontWeight: '600' },
  signatureBody: { padding: Spacing.lg },
  signatureLabel: { fontSize: 14, fontWeight: '600', marginBottom: Spacing.xs },
  signatureHint: { fontSize: 12, marginBottom: Spacing.md },
  signatureInput: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    fontSize: 15,
    marginBottom: Spacing.lg,
  },
  signaturePreviewBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  signatureDisplayText: { fontSize: 28, fontWeight: '700' },
  signatureDateText: { ...Typography.caption, marginTop: Spacing.sm },
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
  signatureCancelText: { fontSize: 15, fontWeight: '600' },
  signatureConfirm: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  signatureConfirmText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  sendCodeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendButton: { alignItems: 'center', paddingVertical: Spacing.sm },
});
