import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from "@/components/Icon";
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getToken } from '@/utils/secure-token-storage';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SignaturePad } from '@/components/SignaturePad';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import type { RootStackParamList } from '@/navigation/RootStackNavigator';

type PaymentStep = 'contract' | 'signature' | 'payment' | 'complete';

interface RequesterBusinessProfile {
  name?: string;
  businessName?: string;
  businessNumber?: string;
  phone?: string;
}

type Props = NativeStackScreenProps<RootStackParamList, 'CreateContract'>;

export default function CreateContractScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const { width: screenWidth } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [step, setStep] = useState<PaymentStep>('contract');

  // 개별 동의 체크박스 (7개)
  const [agreements, setAgreements] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const allAgreed = agreements.every(Boolean);
  const toggleAgreement = (index: number) => {
    setAgreements(prev => prev.map((v, i) => i === index ? !v : v));
  };
  const toggleAllAgreements = () => {
    const newValue = !allAgreed;
    setAgreements(new Array(7).fill(newValue));
  };
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // 서명
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // 본인인증 (서명 단계에 통합)
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  // 계약서
  const [balancePaymentDate, setBalancePaymentDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [requestTaxInvoice, setRequestTaxInvoice] = useState(false);

  // 결제
  const [depositAgreed, setDepositAgreed] = useState(false);
  const [virtualAccount, setVirtualAccount] = useState<any>(null);
  const [isRequestingAccount, setIsRequestingAccount] = useState(false);
  const [isNotifyingDeposit, setIsNotifyingDeposit] = useState(false);
  const [depositNotified, setDepositNotified] = useState(false);

  const contractCreatedAt = useState(() => new Date())[0];

  const { data: order, isLoading } = useQuery({
    queryKey: ['/api/orders', orderId],
    queryFn: async () => {
      const token = await getToken();
      const baseUrl = getApiUrl();
      const res = await fetch(new URL(`/api/orders/${orderId}`, baseUrl).href, {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      if (!res.ok) throw new Error('Order not found');
      return res.json();
    },
  });

  const { data: requesterProfile } = useQuery<RequesterBusinessProfile>({
    queryKey: ['/api/requesters/business'],
  });

  const { data: breakdown } = useQuery({
    queryKey: ['/api/orders', orderId, 'contract-breakdown'],
    queryFn: async () => {
      const token = await getToken();
      const baseUrl = getApiUrl();
      const res = await fetch(new URL(`/api/orders/${orderId}/contract-breakdown`, baseUrl).href, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!orderId,
  });

  const depositRate = breakdown?.depositRate || 20;
  const balanceRate = 100 - depositRate;
  const amounts = breakdown ? {
    total: breakdown.supplyAmount,
    totalWithVat: breakdown.totalAmount,
    deposit: breakdown.depositAmount,
    balance: breakdown.balanceAmount,
    vat: breakdown.vatAmount
  } : { total: 0, totalWithVat: 0, deposit: 0, balance: 0, vat: 0 };

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/orders/${orderId}/confirm-contract`, {
        agreed: true,
        depositAmount: amounts.deposit,
        balancePaymentDate: format(balancePaymentDate, 'yyyy-MM-dd'),
        requestTaxInvoice,
        signatureData: signatureData || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });
      setStep('complete');
      setIsProcessingPayment(false);
    },
    onError: (err: Error) => {
      setIsProcessingPayment(false);
      const msg = err.message || '계약 확정에 실패했습니다.';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('오류', msg);
      }
    },
  });

  const handleSignatureChange = (hasSig: boolean, data: string | null) => {
    setHasSignature(hasSig);
    setSignatureData(data);
  };

  const formatPhoneInput = (text: string) => {
    const numbers = text.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleSendCode = async () => {
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    if (cleanPhone.length < 10) {
      setVerificationError('올바른 휴대폰 번호를 입력해주세요');
      return;
    }

    setIsSendingCode(true);
    setVerificationError('');

    try {
      const token = await getToken();
      const res = await fetch(new URL('/api/auth/send-phone-code', getApiUrl()).href, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber: cleanPhone }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || '인증번호 발송에 실패했습니다');
      }

      setIsCodeSent(true);
      if (Platform.OS === 'web') {
        alert('인증번호가 발송되었습니다');
      } else {
        Alert.alert('알림', '인증번호가 발송되었습니다');
      }
    } catch (error: any) {
      setVerificationError(error.message || '인증번호 발송에 실패했습니다');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setVerificationError('6자리 인증번호를 입력해주세요');
      return;
    }

    setIsVerifying(true);
    setVerificationError('');

    try {
      const token = await getToken();
      const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
      const res = await fetch(new URL('/api/auth/verify-phone', getApiUrl()).href, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber: cleanPhone, code: verificationCode }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || '인증번호 확인에 실패했습니다');
      }

      setIsVerified(true);
      if (Platform.OS === 'web') {
        alert('본인인증이 완료되었습니다');
      } else {
        Alert.alert('알림', '본인인증이 완료되었습니다');
      }
    } catch (error: any) {
      setVerificationError(error.message || '인증번호 확인에 실패했습니다');
    } finally {
      setIsVerifying(false);
    }
  };

  // 가상계좌 신청
  const handleRequestVirtualAccount = async () => {
    setIsRequestingAccount(true);
    try {
      const token = await getToken();
      const res = await fetch(new URL('/api/payment/virtual-account/request', getApiUrl()).href, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId, amount: amounts.deposit }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || '가상계좌 발급에 실패했습니다');
      }
      const data = await res.json();
      setVirtualAccount(data);
    } catch (error: any) {
      const msg = error.message || '가상계좌 발급에 실패했습니다';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('오류', msg);
      }
    } finally {
      setIsRequestingAccount(false);
    }
  };

  // 입금확인 요청
  const handleNotifyDeposit = async () => {
    setIsNotifyingDeposit(true);
    try {
      const token = await getToken();
      const res = await fetch(new URL(`/api/orders/${orderId}/balance/notify`, getApiUrl()).href, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ type: 'deposit' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || '입금확인 요청에 실패했습니다');
      }
      setDepositNotified(true);
      if (Platform.OS === 'web') {
        alert('입금확인 요청이 완료되었습니다');
      } else {
        Alert.alert('알림', '입금확인 요청이 완료되었습니다. 관리자가 확인 후 처리합니다.');
      }
    } catch (error: any) {
      const msg = error.message || '입금확인 요청에 실패했습니다';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('오류', msg);
      }
    } finally {
      setIsNotifyingDeposit(false);
    }
  };

  // 등록 (계약 확정)
  const handleRegister = async () => {
    setIsProcessingPayment(true);
    confirmMutation.mutate();
  };

  // 계좌번호 복사
  const handleCopyAccount = async () => {
    if (virtualAccount?.accountNumber) {
      await Clipboard.setStringAsync(virtualAccount.accountNumber);
      if (Platform.OS === 'web') {
        alert('계좌번호가 복사되었습니다');
      } else {
        Alert.alert('알림', '계좌번호가 복사되었습니다');
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.requester} />
      </ThemedView>
    );
  }

  if (!order) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={{ textAlign: 'center', marginTop: Spacing.xl }}>
          오더 정보를 찾을 수 없습니다.
        </ThemedText>
      </ThemedView>
    );
  }

  const stepOrder: PaymentStep[] = ['contract', 'signature', 'payment', 'complete'];
  const currentStepIndex = stepOrder.indexOf(step);

  const isStepCompleted = (s: PaymentStep) => stepOrder.indexOf(s) < currentStepIndex;
  const isStepActive = (s: PaymentStep) => s === step;

  // 전체 워크플로우: 오더등록 7 + 계약 3 = 10단계
  const TOTAL_WORKFLOW_STEPS = 10;
  const getGlobalStepNumber = (s: PaymentStep): number => {
    const stepMap: Record<PaymentStep, number> = { 'contract': 8, 'signature': 9, 'payment': 10, 'complete': 10 };
    return stepMap[s];
  };
  const globalStepLabels: Record<PaymentStep, string> = {
    'contract': '계약서',
    'signature': '서명/인증',
    'payment': '결제확정',
    'complete': '완료',
  };

  const currentGlobalStep = getGlobalStepNumber(step);
  const globalProgressPercentage = (currentGlobalStep / TOTAL_WORKFLOW_STEPS) * 100;

  const renderStepIndicator = () => (
    <View style={[styles.stepIndicator, { backgroundColor: isDark ? '#1a365d' : '#EBF8FF' }]}>
      <View style={styles.stepTopRow}>
        <View style={styles.stepDots}>
          {Array.from({ length: TOTAL_WORKFLOW_STEPS }, (_, i) => i + 1).map((s) => (
            <View
              key={s}
              style={[
                styles.stepDot,
                {
                  backgroundColor: s <= currentGlobalStep ? BrandColors.requester : (isDark ? '#4A5568' : '#D1D5DB'),
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  opacity: s <= currentGlobalStep ? 1 : 0.5,
                },
              ]}
            />
          ))}
        </View>
        <ThemedText style={[styles.stepCountText, { color: BrandColors.requester }]}>
          {currentGlobalStep}/{TOTAL_WORKFLOW_STEPS}
        </ThemedText>
      </View>

      <View style={styles.stepLabelRow}>
        <ThemedText style={[styles.stepCurrentLabel, { color: BrandColors.requester }]}>
          {globalStepLabels[step]}
        </ThemedText>
        <View style={[styles.progressBarContainer, { backgroundColor: isDark ? '#2d3748' : '#E0E0E0' }]}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${globalProgressPercentage}%`, backgroundColor: BrandColors.requester }
            ]}
          />
        </View>
      </View>

      <View style={styles.stepRow}>
        {(['contract', 'signature', 'payment'] as PaymentStep[]).map((s, idx) => (
          <View key={s} style={styles.stepItemRow}>
            <View style={[
              styles.stepCircle,
              isStepActive(s) && styles.activeStep,
              isStepCompleted(s) && styles.completedStep,
            ]}>
              {isStepCompleted(s)
                ? <Icon name="checkmark-outline" size={14} color="#fff" />
                : <ThemedText style={[styles.stepNumber, isStepActive(s) && { color: '#fff' }]}>{8 + idx}</ThemedText>
              }
            </View>
            {idx < 2 && <View style={[styles.stepLine, isStepCompleted(s) && styles.completedLine]} />}
          </View>
        ))}
      </View>

      <View style={styles.stepLabelsRow}>
        <ThemedText style={[styles.stepLabelSmall, { color: isStepActive('contract') ? BrandColors.requester : (isDark ? '#A0AEC0' : '#9CA3AF'), fontWeight: isStepActive('contract') ? '600' : '400' }]}>계약서</ThemedText>
        <ThemedText style={[styles.stepLabelSmall, { color: isStepActive('signature') ? BrandColors.requester : (isDark ? '#A0AEC0' : '#9CA3AF'), fontWeight: isStepActive('signature') ? '600' : '400' }]}>서명/인증</ThemedText>
        <ThemedText style={[styles.stepLabelSmall, { color: isStepActive('payment') ? BrandColors.requester : (isDark ? '#A0AEC0' : '#9CA3AF'), fontWeight: isStepActive('payment') ? '600' : '400' }]}>결제확정</ThemedText>
      </View>
    </View>
  );

  // ─── Step 8: 계약서 (단일 문서) ───
  const agreementTexts = [
    `플랫폼이 "운송주선 사업자"이며, 직접 운송이 아닌 기사(헬퍼)가 수행함을 이해하고 동의합니다.`,
    `본 오더의 결제 구조가 "계약금 ${depositRate}% + 잔금 ${balanceRate}%"임에 동의합니다.`,
    `잔금이 "마감자료(증빙) 기준"으로 재산정될 수 있음에 동의합니다.`,
    `환불 정책에 동의합니다. (매칭 전: 100% 환불 / 매칭 후: 환불 불가)`,
    `잔금결제일(${format(balancePaymentDate, 'yyyy년 M월 d일', { locale: ko })})까지 잔금을 납부할 것에 동의합니다.`,
    `매칭 완료 시 기사에게 업무 수행 목적의 연락처가 제공될 수 있음에 동의합니다.`,
    `플랫폼 외 직거래 금지 및 위반 시 이용제한/손해배상에 동의합니다.`,
  ];

  const renderContractStep = () => (
    <>
      {/* ── 하나의 계약서 문서 ── */}
      <Card style={[styles.card, { padding: Spacing.xl }]}>
        {/* 계약서 제목 + 생성일시 */}
        <View style={styles.contractHeader}>
          <ThemedText style={[styles.contractTitle, { color: theme.text }]}>
            화물운송 위탁배송 계약서
          </ThemedText>
          <ThemedText style={[styles.signDateText, { color: isDark ? '#A0AEC0' : Colors.light.tabIconDefault }]}>
            작성일시: {format(contractCreatedAt, 'yyyy년 M월 d일 HH:mm', { locale: ko })}
          </ThemedText>
        </View>

        <View style={[styles.contractDivider, { borderColor: isDark ? '#4A5568' : '#E0E0E0' }]} />

        {/* ── 당사자 정보 ── */}
        <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>당사자 정보</ThemedText>
        <View style={[styles.partySection, { backgroundColor: isDark ? '#1a365d' : '#EBF8FF', marginBottom: Spacing.md }]}>
          <ThemedText style={[styles.partyTitle, { color: BrandColors.requester }]}>플랫폼(회사)</ThemedText>
          <View style={styles.partyRow}>
            <ThemedText style={[styles.partyLabel, { color: Colors.light.tabIconDefault }]}>상호</ThemedText>
            <ThemedText style={[styles.partyValue, { color: theme.text }]}>헬프미</ThemedText>
          </View>
          <View style={styles.partyRow}>
            <ThemedText style={[styles.partyLabel, { color: Colors.light.tabIconDefault }]}>사업자등록번호</ThemedText>
            <ThemedText style={[styles.partyValue, { color: theme.text }]}>(자동 기입)</ThemedText>
          </View>
        </View>
        <View style={[styles.partySection, { backgroundColor: isDark ? '#1c4532' : '#F0FFF4' }]}>
          <ThemedText style={[styles.partyTitle, { color: BrandColors.requester }]}>요청자(화주)</ThemedText>
          <View style={styles.partyRow}>
            <ThemedText style={[styles.partyLabel, { color: Colors.light.tabIconDefault }]}>상호/성명</ThemedText>
            <ThemedText style={[styles.partyValue, { color: theme.text }]}>{requesterProfile?.name || requesterProfile?.businessName || '(자동 기입)'}</ThemedText>
          </View>
          <View style={styles.partyRow}>
            <ThemedText style={[styles.partyLabel, { color: Colors.light.tabIconDefault }]}>사업자등록번호</ThemedText>
            <ThemedText style={[styles.partyValue, { color: theme.text }]}>{requesterProfile?.businessNumber || '(해당 시)'}</ThemedText>
          </View>
          <View style={styles.partyRow}>
            <ThemedText style={[styles.partyLabel, { color: Colors.light.tabIconDefault }]}>담당자/연락처</ThemedText>
            <ThemedText style={[styles.partyValue, { color: theme.text }]}>{requesterProfile?.phone || '(자동 기입)'}</ThemedText>
          </View>
        </View>

        <View style={[styles.contractDivider, { borderColor: isDark ? '#4A5568' : '#E0E0E0' }]} />

        {/* ── 오더 정보 ── */}
        <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>오더 정보</ThemedText>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>회사명</ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>{order.companyName}</ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>배송지역</ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>{order.deliveryArea || '-'}</ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>일정</ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>
            {order.scheduledDate || '-'}
            {order.scheduledDateEnd && order.scheduledDateEnd !== order.scheduledDate ? ` ~ ${order.scheduledDateEnd}` : ''}
          </ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>차종</ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>{order.vehicleType}</ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>단가</ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>{formatCurrency(order.pricePerUnit)}</ThemedText>
        </View>
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>평균수량</ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>{order.averageQuantity}</ThemedText>
        </View>

        <View style={[styles.contractDivider, { borderColor: isDark ? '#4A5568' : '#E0E0E0' }]} />

        {/* ── 결제 정보 ── */}
        <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>결제 정보</ThemedText>
        <View style={styles.amountRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>공급가액</ThemedText>
          <ThemedText style={[styles.amountValue, { color: theme.text }]}>{formatCurrency(amounts.total)}</ThemedText>
        </View>
        <View style={styles.amountRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>부가세 (10%)</ThemedText>
          <ThemedText style={[styles.amountValue, { color: theme.text }]}>{formatCurrency(amounts.vat)}</ThemedText>
        </View>
        <View style={[styles.amountRow, { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: Spacing.md }]}>
          <ThemedText style={[styles.label, { color: theme.text, fontWeight: '600' }]}>총 금액 (VAT 포함)</ThemedText>
          <ThemedText style={[styles.amountValue, { color: theme.text, fontWeight: '600' }]}>{formatCurrency(amounts.totalWithVat)}</ThemedText>
        </View>
        <View style={[styles.amountRow, styles.highlightRow, { backgroundColor: isDark ? '#1a365d' : '#EBF8FF' }]}>
          <View>
            <ThemedText style={[styles.label, { color: BrandColors.requester }]}>계약금 ({depositRate}%)</ThemedText>
            <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>계약 시 결제</ThemedText>
          </View>
          <ThemedText style={[styles.amountValue, { color: BrandColors.requester, fontWeight: '700' }]}>{formatCurrency(amounts.deposit)}</ThemedText>
        </View>
        <View style={styles.amountRow}>
          <View>
            <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>잔금 ({balanceRate}%)</ThemedText>
            <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>배송 완료 후 정산</ThemedText>
          </View>
          <ThemedText style={[styles.amountValue, { color: theme.text }]}>{formatCurrency(amounts.balance)}</ThemedText>
        </View>

        {/* 잔금입금일 */}
        <View style={[styles.amountRow, { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: Spacing.md, borderBottomWidth: 0 }]}>
          <View>
            <ThemedText style={[styles.label, { color: theme.text, fontWeight: '600' }]}>
              잔금입금일 <ThemedText style={{ color: '#EF4444' }}>*</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>잔금 입금 예정일 (필수)</ThemedText>
          </View>
          <Pressable
            style={[styles.datePickerButton, { borderColor: isDark ? '#4A5568' : '#E0E0E0' }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Icon name="calendar-outline" size={18} color={BrandColors.requester} />
            <ThemedText style={[styles.dateText, { color: theme.text }]}>
              {format(balancePaymentDate, 'yyyy년 M월 d일', { locale: ko })}
            </ThemedText>
          </Pressable>
        </View>

        {/* 세금계산서 */}
        <View style={[styles.amountRow, { borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingTop: Spacing.md }]}>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.label, { color: theme.text, fontWeight: '600' }]}>세금계산서 발행 요청</ThemedText>
            <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>정산 완료 후 세금계산서를 받으시겠습니까?</ThemedText>
          </View>
          <Pressable
            style={[styles.checkboxContainer, { borderColor: requestTaxInvoice ? BrandColors.requester : (isDark ? '#4A5568' : '#E0E0E0') }]}
            onPress={() => setRequestTaxInvoice(!requestTaxInvoice)}
          >
            {requestTaxInvoice
              ? <Icon name="checkbox" size={24} color={BrandColors.requester} />
              : <Icon name="square-outline" size={24} color={isDark ? '#4A5568' : '#9CA3AF'} />
            }
          </Pressable>
        </View>

        {requestTaxInvoice && !requesterProfile?.businessNumber && (
          <View style={[styles.warningBox, { backgroundColor: isDark ? '#7C2D12' : '#FEF3C7' }]}>
            <Icon name="warning-outline" size={20} color="#D97706" />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText style={[styles.warningText, { color: '#92400E' }]}>사업자정보가 등록되지 않았습니다</ThemedText>
              <ThemedText style={[styles.warningHint, { color: '#B45309' }]}>세금계산서 발행을 위해 나의정보에서 사업자정보를 등록해주세요</ThemedText>
            </View>
          </View>
        )}

        <View style={[styles.contractDivider, { borderColor: isDark ? '#4A5568' : '#E0E0E0' }]} />

        {/* ── 화물운송 위탁배송 법적조항 ── */}
        <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
          화물운송 위탁배송 계약 조항
        </ThemedText>
        <View style={styles.legalClausesList}>
          <View style={styles.legalClause}>
            <ThemedText style={[styles.clauseNumber, { color: BrandColors.requester }]}>제1조</ThemedText>
            <ThemedText style={[styles.clauseText, { color: theme.text }]}>
              본 플랫폼(헬프미)은 화물자동차 운수사업법상 "운송주선사업자"로서, 화주(요청자)와 기사(헬퍼) 간 운송을 주선하며, 직접 운송 행위를 수행하지 않습니다.
            </ThemedText>
          </View>
          <View style={styles.legalClause}>
            <ThemedText style={[styles.clauseNumber, { color: BrandColors.requester }]}>제2조</ThemedText>
            <ThemedText style={[styles.clauseText, { color: theme.text }]}>
              본 계약에 따른 위탁배송 업무는 기사(헬퍼)가 독립사업자 자격으로 수행하며, 플랫폼과 기사 간에는 고용관계가 존재하지 않습니다.
            </ThemedText>
          </View>
          <View style={styles.legalClause}>
            <ThemedText style={[styles.clauseNumber, { color: BrandColors.requester }]}>제3조</ThemedText>
            <ThemedText style={[styles.clauseText, { color: theme.text }]}>
              환불 규정: 기사(헬퍼) 매칭 전 계약 취소 시 계약금 100% 환불 / 매칭 완료 후 취소 시 환불 불가.
            </ThemedText>
          </View>
          <View style={styles.legalClause}>
            <ThemedText style={[styles.clauseNumber, { color: BrandColors.requester }]}>제4조</ThemedText>
            <ThemedText style={[styles.clauseText, { color: theme.text }]}>
              결제 구조는 계약금(총 금액의 {depositRate}%)을 계약 시 납부하고, 잔금({balanceRate}%)은 설정한 잔금결제일까지 납부합니다.
            </ThemedText>
          </View>
          <View style={styles.legalClause}>
            <ThemedText style={[styles.clauseNumber, { color: BrandColors.requester }]}>제5조</ThemedText>
            <ThemedText style={[styles.clauseText, { color: theme.text }]}>
              잔금은 마감자료(증빙) 기준으로 재산정될 수 있으며, 실제 배송 수량에 따라 정산 금액이 변동될 수 있습니다.
            </ThemedText>
          </View>
          <View style={styles.legalClause}>
            <ThemedText style={[styles.clauseNumber, { color: BrandColors.requester }]}>제6조</ThemedText>
            <ThemedText style={[styles.clauseText, { color: theme.text }]}>
              매칭 완료 시 업무 수행 목적으로 기사(헬퍼)에게 요청자의 연락처가 제공될 수 있습니다.
            </ThemedText>
          </View>
          <View style={styles.legalClause}>
            <ThemedText style={[styles.clauseNumber, { color: BrandColors.requester }]}>제7조</ThemedText>
            <ThemedText style={[styles.clauseText, { color: theme.text }]}>
              플랫폼 외 직거래는 엄격히 금지되며, 위반 시 이용제한 및 손해배상 청구 대상이 됩니다.
            </ThemedText>
          </View>
        </View>

        <View style={[styles.contractDivider, { borderColor: isDark ? '#4A5568' : '#E0E0E0' }]} />

        {/* ── 필수 동의사항 (개별 체크박스) ── */}
        <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>필수 동의사항</ThemedText>

        {/* 전체 동의 */}
        <Pressable
          style={[styles.allAgreeRow, { backgroundColor: isDark ? '#1a365d' : '#EBF8FF', borderColor: allAgreed ? BrandColors.requester : (isDark ? '#4A5568' : '#D1D5DB') }]}
          onPress={toggleAllAgreements}
        >
          <View style={[
            styles.checkboxLarge,
            { borderColor: allAgreed ? BrandColors.requester : Colors.light.tabIconDefault },
            allAgreed && { backgroundColor: BrandColors.requester }
          ]}>
            {allAgreed ? <Icon name="checkmark-outline" size={16} color="#fff" /> : null}
          </View>
          <ThemedText style={[styles.allAgreeText, { color: theme.text }]}>
            전체 동의
          </ThemedText>
        </Pressable>

        {/* 개별 동의 항목 */}
        <View style={styles.agreementsList}>
          {agreementTexts.map((text, index) => (
            <Pressable
              key={index}
              style={styles.agreementItem}
              onPress={() => toggleAgreement(index)}
            >
              <View style={[
                styles.checkbox,
                { borderColor: agreements[index] ? BrandColors.requester : Colors.light.tabIconDefault },
                agreements[index] && { backgroundColor: BrandColors.requester }
              ]}>
                {agreements[index] ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
              </View>
              <ThemedText style={[styles.agreementText, { color: theme.text }]}>
                {text}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          onPress={() => setStep('signature')}
          disabled={!allAgreed}
          style={{ backgroundColor: allAgreed ? BrandColors.requester : Colors.light.tabIconDefault }}
        >
          다음: 서명/인증
        </Button>
        <Pressable
          style={({ pressed }) => [styles.cancelButton, { opacity: pressed ? 0.5 : 1 }]}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.dispatch(CommonActions.navigate({ name: 'Main' }));
            }
          }}
        >
          <ThemedText style={[styles.cancelText, { color: Colors.light.tabIconDefault }]}>취소하고 돌아가기</ThemedText>
        </Pressable>
      </View>
    </>
  );

  // ─── Step 9: 서명 + 본인인증 (통합) ───
  const renderSignatureStep = () => (
    <>
      {/* 전자서명 */}
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Icon name="create-outline" size={24} color={BrandColors.requester} />
          <ThemedText style={[styles.title, { color: theme.text }]}>전자서명</ThemedText>
        </View>
        <ThemedText style={[styles.subtitle, { color: Colors.light.tabIconDefault }]}>
          계약 동의를 위해 아래에 서명해 주세요.
        </ThemedText>
      </Card>

      <Card style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>서명란</ThemedText>
        <View style={styles.signatureContainer}>
          <SignaturePad
            onSignatureChange={handleSignatureChange}
            width={Math.min(screenWidth - 80, 320)}
            height={150}
            primaryColor={BrandColors.requester}
          />
        </View>
        <View style={styles.signatureInfo}>
          <Icon name="information-circle-outline" size={14} color={Colors.light.tabIconDefault} />
          <ThemedText style={[styles.signatureInfoText, { color: Colors.light.tabIconDefault }]}>
            손가락 또는 마우스로 서명해 주세요
          </ThemedText>
        </View>
        {hasSignature && (
          <View style={[styles.verifiedBadge, { backgroundColor: '#D1FAE5', marginTop: Spacing.sm }]}>
            <Icon name="checkmark-circle-outline" size={16} color={BrandColors.success} />
            <ThemedText style={[styles.verifiedText, { color: BrandColors.success }]}>서명 완료</ThemedText>
          </View>
        )}
      </Card>

      {/* 휴대폰 본인인증 */}
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Icon name="phone-portrait-outline" size={24} color={BrandColors.requester} />
          <ThemedText style={[styles.title, { color: theme.text }]}>휴대폰 본인인증</ThemedText>
        </View>
        <ThemedText style={[styles.subtitle, { color: Colors.light.tabIconDefault }]}>
          계약 체결을 위해 본인 확인이 필요합니다.
        </ThemedText>

        <View style={{ marginTop: Spacing.md }}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>휴대폰 번호</ThemedText>
          <View style={styles.phoneInputRow}>
            <TextInput
              style={[
                styles.phoneInput,
                {
                  backgroundColor: isDark ? '#1a1a2e' : '#F5F5F5',
                  color: theme.text,
                  borderColor: isDark ? '#444' : '#E0E0E0',
                }
              ]}
              placeholder="010-0000-0000"
              placeholderTextColor={Colors.light.tabIconDefault}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => setPhoneNumber(formatPhoneInput(text))}
              maxLength={13}
              editable={!isCodeSent}
            />
            <Button
              onPress={handleSendCode}
              disabled={isSendingCode || phoneNumber.length < 12}
              style={{
                backgroundColor: phoneNumber.length >= 12 ? BrandColors.requester : Colors.light.tabIconDefault,
                minWidth: 100,
              }}
            >
              {isSendingCode ? '발송중...' : isCodeSent ? '재발송' : '인증요청'}
            </Button>
          </View>

          {isCodeSent && (
            <>
              <ThemedText style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>인증번호</ThemedText>
              <View style={styles.phoneInputRow}>
                <TextInput
                  style={[
                    styles.phoneInput,
                    {
                      backgroundColor: isDark ? '#1a1a2e' : '#F5F5F5',
                      color: theme.text,
                      borderColor: isVerified ? BrandColors.requester : (isDark ? '#444' : '#E0E0E0'),
                    }
                  ]}
                  placeholder="6자리 숫자"
                  placeholderTextColor={Colors.light.tabIconDefault}
                  keyboardType="number-pad"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  maxLength={6}
                  editable={!isVerified}
                />
                <Button
                  onPress={handleVerifyCode}
                  disabled={isVerifying || verificationCode.length !== 6 || isVerified}
                  style={{
                    backgroundColor: isVerified ? BrandColors.success : (verificationCode.length === 6 ? BrandColors.requester : Colors.light.tabIconDefault),
                    minWidth: 100,
                  }}
                >
                  {isVerifying ? '확인중...' : isVerified ? '인증완료' : '확인'}
                </Button>
              </View>
            </>
          )}

          {verificationError ? (
            <ThemedText style={styles.errorText}>{verificationError}</ThemedText>
          ) : null}

          {isVerified ? (
            <View style={styles.verifiedBadge}>
              <Icon name="checkmark-circle-outline" size={20} color={BrandColors.success} />
              <ThemedText style={[styles.verifiedText, { color: BrandColors.success }]}>본인인증이 완료되었습니다</ThemedText>
            </View>
          ) : null}
        </View>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          onPress={() => setStep('payment')}
          disabled={!hasSignature || !isVerified}
          style={{ backgroundColor: (hasSignature && isVerified) ? BrandColors.requester : Colors.light.tabIconDefault }}
        >
          다음: 결제
        </Button>
        <Pressable style={styles.cancelButton} onPress={() => setStep('contract')}>
          <ThemedText style={[styles.cancelText, { color: Colors.light.tabIconDefault }]}>이전 단계로</ThemedText>
        </Pressable>
      </View>
    </>
  );

  // ─── Step 10: 결제확정 ───
  const renderPaymentStep = () => (
    <>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Icon name="card-outline" size={24} color={BrandColors.requester} />
          <ThemedText style={[styles.title, { color: theme.text }]}>계약금 결제</ThemedText>
        </View>
      </Card>

      {/* 계약금 금액 표기 */}
      <Card style={styles.card}>
        <View style={[styles.paymentSummary, { backgroundColor: isDark ? '#1a365d' : '#EBF8FF' }]}>
          <ThemedText style={[styles.paymentLabel, { color: Colors.light.tabIconDefault }]}>계약금 ({depositRate}%)</ThemedText>
          <ThemedText style={[styles.paymentAmount, { color: BrandColors.requester }]}>{formatCurrency(amounts.deposit)}</ThemedText>
        </View>
        <View style={styles.paymentInfo}>
          <View style={styles.paymentInfoRow}>
            <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>회사명</ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>{order.companyName}</ThemedText>
          </View>
          <View style={styles.paymentInfoRow}>
            <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>일정</ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>{order.scheduledDate}{order.scheduledDateEnd && order.scheduledDateEnd !== order.scheduledDate ? ` ~ ${order.scheduledDateEnd}` : ''}</ThemedText>
          </View>
        </View>
      </Card>

      {/* 동의 체크 */}
      <Pressable style={styles.agreeRow} onPress={() => setDepositAgreed(!depositAgreed)}>
        <View style={[
          styles.checkbox,
          { borderColor: depositAgreed ? BrandColors.requester : Colors.light.tabIconDefault },
          depositAgreed && { backgroundColor: BrandColors.requester }
        ]}>
          {depositAgreed ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
        </View>
        <ThemedText style={[styles.agreeText, { color: theme.text }]}>
          계약금 {formatCurrency(amounts.deposit)}을 입금하겠습니다.
        </ThemedText>
      </Pressable>

      {/* 가상계좌 */}
      <Card style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>가상계좌</ThemedText>

        {!virtualAccount ? (
          <Button
            onPress={handleRequestVirtualAccount}
            disabled={!depositAgreed || isRequestingAccount}
            style={{ backgroundColor: depositAgreed ? BrandColors.requester : Colors.light.tabIconDefault }}
          >
            {isRequestingAccount ? '발급 중...' : '가상계좌 신청'}
          </Button>
        ) : (
          <View>
            <View style={[styles.accountInfoBox, { backgroundColor: isDark ? '#1a365d' : '#EBF8FF' }]}>
              <View style={styles.accountInfoRow}>
                <ThemedText style={[styles.accountLabel, { color: Colors.light.tabIconDefault }]}>은행</ThemedText>
                <ThemedText style={[styles.accountValue, { color: theme.text }]}>{virtualAccount.bankName || '신한은행'}</ThemedText>
              </View>
              <View style={styles.accountInfoRow}>
                <ThemedText style={[styles.accountLabel, { color: Colors.light.tabIconDefault }]}>계좌번호</ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                  <ThemedText style={[styles.accountValue, { color: theme.text, fontWeight: '700' }]}>{virtualAccount.accountNumber}</ThemedText>
                  <Pressable
                    style={[styles.copyButton, { backgroundColor: BrandColors.requester }]}
                    onPress={handleCopyAccount}
                  >
                    <Icon name="copy-outline" size={14} color="#fff" />
                    <ThemedText style={styles.copyButtonText}>복사</ThemedText>
                  </Pressable>
                </View>
              </View>
              <View style={styles.accountInfoRow}>
                <ThemedText style={[styles.accountLabel, { color: Colors.light.tabIconDefault }]}>예금주</ThemedText>
                <ThemedText style={[styles.accountValue, { color: theme.text }]}>{virtualAccount.accountHolder || '헬프미'}</ThemedText>
              </View>
              <View style={styles.accountInfoRow}>
                <ThemedText style={[styles.accountLabel, { color: Colors.light.tabIconDefault }]}>입금금액</ThemedText>
                <ThemedText style={[styles.accountValue, { color: BrandColors.requester, fontWeight: '700' }]}>{formatCurrency(amounts.deposit)}</ThemedText>
              </View>
              {virtualAccount.expireAt && (
                <View style={styles.accountInfoRow}>
                  <ThemedText style={[styles.accountLabel, { color: Colors.light.tabIconDefault }]}>입금기한</ThemedText>
                  <ThemedText style={[styles.accountValue, { color: '#EF4444' }]}>{virtualAccount.expireAt}</ThemedText>
                </View>
              )}
            </View>

            {/* 입금확인 요청 */}
            <View style={{ marginTop: Spacing.md }}>
              <Button
                onPress={handleNotifyDeposit}
                disabled={isNotifyingDeposit || depositNotified}
                style={{ backgroundColor: depositNotified ? BrandColors.success : BrandColors.requester }}
              >
                {isNotifyingDeposit ? '요청 중...' : depositNotified ? '입금확인 요청 완료' : '입금확인 요청'}
              </Button>
            </View>
          </View>
        )}
      </Card>

      {/* 등록 버튼 */}
      <View style={styles.buttonContainer}>
        <Button
          onPress={handleRegister}
          disabled={!virtualAccount || isProcessingPayment || confirmMutation.isPending}
          style={{ backgroundColor: virtualAccount ? BrandColors.requester : Colors.light.tabIconDefault }}
        >
          {isProcessingPayment || confirmMutation.isPending ? '처리 중...' : '등록'}
        </Button>
        <Pressable style={styles.cancelButton} onPress={() => setStep('signature')}>
          <ThemedText style={[styles.cancelText, { color: Colors.light.tabIconDefault }]}>이전 단계로</ThemedText>
        </Pressable>
      </View>
    </>
  );

  // ─── 완료 ───
  const renderCompleteStep = () => (
    <>
      <Card style={StyleSheet.flatten([styles.card, styles.completeCard])}>
        <View style={styles.completeIcon}>
          <View style={[styles.completeCircle, { backgroundColor: BrandColors.requester }]}>
            <Icon name="checkmark-outline" size={40} color="#fff" />
          </View>
        </View>
        <ThemedText style={[styles.completeTitle, { color: theme.text }]}>계약 등록 완료</ThemedText>
        <ThemedText style={[styles.completeSubtitle, { color: Colors.light.tabIconDefault }]}>
          계약금 입금이 확인되면 오더가 공개됩니다.
        </ThemedText>
      </Card>

      <Card style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>다음 단계</ThemedText>
        <View style={styles.nextSteps}>
          <View style={styles.nextStepItem}>
            <View style={[styles.nextStepNumber, { backgroundColor: '#FEF3C7' }]}>
              <ThemedText style={{ color: '#D97706', fontWeight: '700' }}>1</ThemedText>
            </View>
            <View style={styles.nextStepContent}>
              <ThemedText style={[styles.nextStepTitle, { color: theme.text }]}>입금 확인</ThemedText>
              <ThemedText style={[styles.nextStepDesc, { color: Colors.light.tabIconDefault }]}>관리자가 입금을 확인합니다.</ThemedText>
            </View>
          </View>
          <View style={styles.nextStepItem}>
            <View style={[styles.nextStepNumber, { backgroundColor: '#DBEAFE' }]}>
              <ThemedText style={{ color: '#2563EB', fontWeight: '700' }}>2</ThemedText>
            </View>
            <View style={styles.nextStepContent}>
              <ThemedText style={[styles.nextStepTitle, { color: theme.text }]}>오더 공개</ThemedText>
              <ThemedText style={[styles.nextStepDesc, { color: Colors.light.tabIconDefault }]}>입금 확인 후 헬퍼 앱에 오더가 공개됩니다.</ThemedText>
            </View>
          </View>
          <View style={styles.nextStepItem}>
            <View style={[styles.nextStepNumber, { backgroundColor: '#D1FAE5' }]}>
              <ThemedText style={{ color: '#059669', fontWeight: '700' }}>3</ThemedText>
            </View>
            <View style={styles.nextStepContent}>
              <ThemedText style={[styles.nextStepTitle, { color: theme.text }]}>헬퍼 매칭</ThemedText>
              <ThemedText style={[styles.nextStepDesc, { color: Colors.light.tabIconDefault }]}>헬퍼가 신청하면 매칭이 진행됩니다.</ThemedText>
            </View>
          </View>
        </View>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          onPress={() => {
            navigation.dispatch(
              CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] })
            );
          }}
          style={{ backgroundColor: BrandColors.requester }}
        >
          내 오더 확인하기
        </Button>
      </View>
    </>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing['2xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {renderStepIndicator()}
        {step === 'contract' && renderContractStep()}
        {step === 'signature' && renderSignatureStep()}
        {step === 'payment' && renderPaymentStep()}
        {step === 'complete' && renderCompleteStep()}
      </ScrollView>

      {/* 잔금입금일 DatePicker */}
      {Platform.OS === 'web' && showDatePicker ? (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable style={styles.datePickerOverlay} onPress={() => setShowDatePicker(false)}>
            <View
              style={[styles.datePickerContainer, { backgroundColor: theme.backgroundRoot }]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.datePickerHeader}>
                <ThemedText style={[styles.datePickerTitle, { color: theme.text }]}>잔금입금일 선택</ThemedText>
                <Pressable onPress={() => setShowDatePicker(false)}>
                  <Icon name="close-outline" size={24} color={theme.text} />
                </Pressable>
              </View>
              <input
                type="date"
                value={format(balancePaymentDate, 'yyyy-MM-dd')}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => {
                  const date = new Date(e.target.value);
                  if (!isNaN(date.getTime())) {
                    setBalancePaymentDate(date);
                  }
                }}
                style={{
                  width: '100%',
                  padding: 16,
                  fontSize: 18,
                  borderRadius: 8,
                  border: `1px solid ${isDark ? '#4A5568' : '#E0E0E0'}`,
                  backgroundColor: isDark ? '#2D3748' : '#FFFFFF',
                  color: isDark ? '#FFFFFF' : '#1A202C',
                  marginBottom: 16,
                }}
              />
              <Pressable
                style={[styles.datePickerDoneButton, { backgroundColor: BrandColors.requester }]}
                onPress={() => setShowDatePicker(false)}
              >
                <ThemedText style={styles.datePickerDoneText}>완료</ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}

      {Platform.OS !== 'web' && showDatePicker ? (
        Platform.OS === 'ios' ? (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <Pressable style={styles.datePickerOverlay} onPress={() => setShowDatePicker(false)}>
              <View style={[styles.datePickerContainer, { backgroundColor: theme.backgroundRoot }]}>
                <View style={styles.datePickerHeader}>
                  <ThemedText style={[styles.datePickerTitle, { color: theme.text }]}>잔금입금일 선택</ThemedText>
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <Icon name="close-outline" size={24} color={theme.text} />
                  </Pressable>
                </View>
                <DateTimePicker
                  value={balancePaymentDate}
                  mode="date"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    if (date) setBalancePaymentDate(date);
                  }}
                  locale="ko"
                />
                <Pressable
                  style={[styles.datePickerDoneButton, { backgroundColor: BrandColors.requester }]}
                  onPress={() => setShowDatePicker(false)}
                >
                  <ThemedText style={styles.datePickerDoneText}>완료</ThemedText>
                </Pressable>
              </View>
            </Pressable>
          </Modal>
        ) : (
          <DateTimePicker
            value={balancePaymentDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (event.type === 'set' && date) {
                setBalancePaymentDate(date);
              }
            }}
          />
        )
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  card: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    fontWeight: '700',
  },
  subtitle: {
    ...Typography.body,
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  label: {
    ...Typography.small,
  },
  value: {
    ...Typography.body,
    fontWeight: '500',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  highlightRow: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderBottomWidth: 0,
  },
  amountValue: {
    ...Typography.body,
    fontWeight: '600',
  },
  hint: {
    ...Typography.small,
    marginTop: 2,
  },
  termsList: {
    gap: Spacing.sm,
  },
  termItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  termText: {
    ...Typography.small,
    flex: 1,
  },
  legalClausesList: {
    gap: Spacing.md,
  },
  legalClause: {
    gap: Spacing.xs,
  },
  clauseNumber: {
    ...Typography.small,
    fontWeight: '700',
  },
  clauseText: {
    ...Typography.small,
    lineHeight: 20,
  },
  partySection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  partyTitle: {
    ...Typography.subheading,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  partyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  partyLabel: {
    ...Typography.small,
  },
  partyValue: {
    ...Typography.small,
    fontWeight: '500',
  },
  contractHeader: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  contractTitle: {
    ...Typography.h2,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  signDateText: {
    ...Typography.small,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  contractDivider: {
    borderBottomWidth: 1,
    marginVertical: Spacing.lg,
  },
  contractSectionTitle: {
    ...Typography.body,
    fontWeight: '700',
    marginBottom: Spacing.md,
    fontSize: 15,
  },
  allAgreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  checkboxLarge: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allAgreeText: {
    ...Typography.body,
    fontWeight: '700',
    flex: 1,
  },
  agreementsList: {
    gap: Spacing.md,
  },
  agreementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  agreementText: {
    ...Typography.small,
    flex: 1,
    lineHeight: 20,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agreeText: {
    ...Typography.small,
    flex: 1,
  },
  buttonContainer: {
    gap: Spacing.md,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  cancelText: {
    ...Typography.body,
  },
  checkboxContainer: {
    padding: Spacing.xs,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  warningText: {
    ...Typography.small,
    fontWeight: '600',
  },
  warningHint: {
    ...Typography.caption,
    marginTop: 2,
  },
  stepIndicator: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  stepTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepCountText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  stepCurrentLabel: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 55,
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeStep: {
    backgroundColor: '#3B82F6',
  },
  completedStep: {
    backgroundColor: '#059669',
  },
  stepLine: {
    width: 50,
    height: 2,
    backgroundColor: '#E0E0E0',
  },
  completedLine: {
    backgroundColor: '#059669',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  stepLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  stepLabelSmall: {
    fontSize: 10,
    textAlign: 'center',
    flex: 1,
  },
  paymentSummary: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  paymentLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  paymentAmount: {
    fontSize: 28,
    fontWeight: '700',
  },
  paymentInfo: {
    gap: Spacing.sm,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  accountInfoBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  accountInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  accountLabel: {
    ...Typography.small,
    minWidth: 70,
  },
  accountValue: {
    ...Typography.body,
    fontWeight: '500',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  completeCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  completeIcon: {
    marginBottom: Spacing.lg,
  },
  completeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeTitle: {
    ...Typography.h2,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  completeSubtitle: {
    ...Typography.body,
    textAlign: 'center',
  },
  nextSteps: {
    gap: Spacing.md,
  },
  nextStepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  nextStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextStepContent: {
    flex: 1,
  },
  nextStepTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  nextStepDesc: {
    ...Typography.small,
  },
  retryPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  signatureContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  signatureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  signatureInfoText: {
    fontSize: 12,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  phoneInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  errorText: {
    color: BrandColors.error,
    fontSize: 12,
    marginTop: Spacing.sm,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: '#D1FAE5',
    borderRadius: BorderRadius.sm,
  },
  verifiedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  dateText: {
    ...Typography.body,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  datePickerTitle: {
    ...Typography.h4,
  },
  datePickerDoneButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  datePickerDoneText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
