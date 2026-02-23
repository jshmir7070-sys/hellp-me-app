import React, { useState, useRef } from 'react';
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
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
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
import { useResponsive } from '@/hooks/useResponsive';
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import type { RootStackParamList } from '@/navigation/RootStackNavigator';
import {
  REQUESTER_ORDER_CONTRACT_TERMS,
  REQUESTER_ORDER_CHECKBOX_KEYS,
  createRequesterOrderContractState,
  createRequesterOrderContractReadState,
  isAllRequiredAgreed,
  getRequesterContractTerms,
  type ContractCheckboxState,
  type ContractReadState,
  type ContractSettings,
} from '@/constants/contracts';

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
  const { showDesktopLayout, containerMaxWidth, contentWidth } = useResponsive();
  const { width: screenWidth } = useWindowDimensions();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeTabBarHeight();
  const [step, setStep] = useState<PaymentStep>('contract');

  // 동적 설정값 기반 계약서 생성
  const { data: contractSettings } = useQuery<Partial<ContractSettings>>({
    queryKey: ['/api/settings/contract-values'],
  });
  const requesterTerms = getRequesterContractTerms(contractSettings || {});

  // contracts.ts 기반 동의 상태
  const [agreements, setAgreements] = useState<ContractCheckboxState>(() => createRequesterOrderContractState());
  const [readState, setReadState] = useState<ContractReadState>(() => createRequesterOrderContractReadState());
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [termModalVisible, setTermModalVisible] = useState(false);
  const [termModalContent, setTermModalContent] = useState<{ title: string; content: string } | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const termItemRefs = useRef<Record<string, number>>({});

  const allAgreed = isAllRequiredAgreed(agreements, REQUESTER_ORDER_CHECKBOX_KEYS.required);

  const toggleAgreement = (key: string) => {
    setAgreements(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllAgreements = () => {
    const newVal = !allAgreed;
    const updated = { ...agreements };
    if (newVal) {
      const readUpdated = { ...readState };
      [...REQUESTER_ORDER_CHECKBOX_KEYS.required, ...REQUESTER_ORDER_CHECKBOX_KEYS.optional]
        .forEach(k => { readUpdated[k] = true; });
      setReadState(readUpdated);
    }
    [...REQUESTER_ORDER_CHECKBOX_KEYS.required, ...REQUESTER_ORDER_CHECKBOX_KEYS.optional]
      .forEach(k => { updated[k] = newVal; });
    setAgreements(updated);
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

  const depositRate = breakdown?.depositRate || 10;
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
        agreedTerms: agreements,
        depositAmount: amounts.deposit,
        balancePaymentDate: format(balancePaymentDate, 'yyyy-MM-dd'),
        requestTaxInvoice: agreements.autoTaxInvoice || false,
        signatureData: signatureData || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/requester/orders'] });
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
  const executeRegister = () => {
    setIsProcessingPayment(true);
    confirmMutation.mutate();
  };

  const handleRegister = () => {
    if (Platform.OS === 'web') {
      if (confirm('계약을 확인하고 오더를 등록하시겠습니까?')) {
        executeRegister();
      }
    } else {
      Alert.alert(
        '계약 확인',
        '계약 내용을 확인하고 오더를 등록하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '등록하기', onPress: () => executeRegister() },
        ]
      );
    }
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

  // 개별 계약 항목 렌더링
  const renderTermItem = (key: string, term: { title: string; content: string; required?: boolean }) => {
    const isRead = readState[key];
    const isAgreedItem = agreements[key];
    const isExpanded = expandedItem === key;

    return (
      <View
        key={key}
        onLayout={(e) => {
          termItemRefs.current[key] = e.nativeEvent.layout.y;
        }}
        style={[
          styles.termItemContainer,
          {
            borderColor: isAgreedItem ? BrandColors.requester : (isDark ? '#4A5568' : '#E0E0E0'),
            backgroundColor: isAgreedItem ? (isDark ? '#1a2e1a' : '#F0FFF4') : 'transparent',
          }
        ]}
      >
        {/* 제목 행 — 탭하면 전체화면 모달로 내용 표시 */}
        <Pressable
          style={styles.termHeader}
          onPress={() => {
            setTermModalContent({ title: term.title, content: term.content });
            setTermModalVisible(true);
            if (!isRead) {
              setReadState(prev => ({ ...prev, [key]: true }));
            }
          }}
        >
          <Icon
            name="document-text-outline"
            size={18}
            color={BrandColors.requester}
          />
          <ThemedText style={[styles.termTitle, { color: theme.text, flex: 1 }]}>
            {term.title}
          </ThemedText>
          {isRead && !isAgreedItem && (
            <View style={[styles.readBadgeSmall, { backgroundColor: isDark ? '#2d3748' : '#FEF3C7' }]}>
              <ThemedText style={{ fontSize: 10, color: '#D97706' }}>열람완료</ThemedText>
            </View>
          )}
          {isAgreedItem && (
            <Icon name="checkmark-circle" size={20} color={BrandColors.success} />
          )}
          <Icon name="chevron-forward" size={16} color={isDark ? '#888' : '#999'} />
        </Pressable>

        {/* 동의 체크박스 */}
        <Pressable
          style={[
            styles.termAgreeRow,
            { borderTopColor: isDark ? '#4A5568' : '#E0E0E0' },
            !isRead && styles.disabledRow,
          ]}
          disabled={!isRead}
          onPress={() => toggleAgreement(key)}
        >
          <View style={[
            styles.checkboxSmall,
            {
              backgroundColor: isAgreedItem ? BrandColors.requester : 'transparent',
              borderColor: isAgreedItem ? BrandColors.requester : (isRead ? Colors.light.tabIconDefault : '#ccc'),
            },
            !isRead && { opacity: 0.4 },
          ]}>
            {isAgreedItem ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
          </View>
          <ThemedText style={[
            styles.termAgreeText,
            { color: isRead ? theme.text : (isDark ? '#666' : '#aaa') },
          ]}>
            {isRead ? '동의합니다' : '내용을 열람해주세요'}
          </ThemedText>
        </Pressable>
      </View>
    );
  };

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

  // ─── Step 8: 계약서 ───
  const renderContractStep = () => (
    <>
      <Card style={[styles.card, { padding: Spacing.xl }]}>
        {/* 계약서 제목 + 생성일시 */}
        <View style={styles.contractHeader}>
          <ThemedText style={[styles.contractTitle, { color: theme.text }]}>
            {requesterTerms.contractOverview.title}
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

        <View style={[styles.contractDivider, { borderColor: isDark ? '#4A5568' : '#E0E0E0' }]} />

        {/* ── 계약 개요 ── */}
        <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
          계약 개요
        </ThemedText>
        <Pressable
          style={[styles.overviewBox, { backgroundColor: isDark ? '#1a1a2e' : '#F8F9FA' }]}
          onPress={() => {
            setTermModalContent({
              title: requesterTerms.contractOverview.title,
              content: requesterTerms.contractOverview.content,
            });
            setTermModalVisible(true);
          }}
        >
          <View style={{ maxHeight: 100, overflow: 'hidden' }}>
            <ThemedText style={[styles.overviewText, { color: theme.text }]} numberOfLines={5}>
              {requesterTerms.contractOverview.content}
            </ThemedText>
          </View>
          <View style={styles.overviewOpenRow}>
            <ThemedText style={{ fontSize: 12, color: BrandColors.requester }}>전체 내용 보기</ThemedText>
            <Icon name="open-outline" size={16} color={BrandColors.requester} />
          </View>
        </Pressable>

        <View style={[styles.contractDivider, { borderColor: isDark ? '#4A5568' : '#E0E0E0' }]} />

        {/* ── 필수 동의사항 (contracts.ts 기반) ── */}
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

        {/* 필수 항목 (10개) */}
        {REQUESTER_ORDER_CHECKBOX_KEYS.required.map((key) => {
          const term = requesterTerms[key];
          return renderTermItem(key, term);
        })}

        {/* 선택 항목 */}
        <View style={[styles.contractDivider, { borderColor: isDark ? '#4A5568' : '#E0E0E0' }]} />
        <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>선택 동의사항</ThemedText>

        {REQUESTER_ORDER_CHECKBOX_KEYS.optional.map((key) => {
          const term = requesterTerms[key];
          return renderTermItem(key, term);
        })}

        {/* 세금계산서 경고 (사업자정보 미등록) */}
        {agreements.autoTaxInvoice && !requesterProfile?.businessNumber && (
          <View style={[styles.warningBox, { backgroundColor: isDark ? '#7C2D12' : '#FEF3C7' }]}>
            <Icon name="warning-outline" size={20} color="#D97706" />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText style={[styles.warningText, { color: '#92400E' }]}>사업자정보가 등록되지 않았습니다</ThemedText>
              <ThemedText style={[styles.warningHint, { color: '#B45309' }]}>세금계산서 발행을 위해 나의정보에서 사업자정보를 등록해주세요</ThemedText>
            </View>
          </View>
        )}
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
            width={Math.min(contentWidth - 80, 320)}
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
                minWidth: 120,
                minHeight: 52,
                paddingHorizontal: Spacing.md,
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
                    minWidth: 120,
                    minHeight: 52,
                    paddingHorizontal: Spacing.md,
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
    <>
    <ThemedView style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: showDesktopLayout ? Spacing['2xl'] : tabBarHeight + Spacing['2xl'],
            ...(showDesktopLayout && {
              maxWidth: containerMaxWidth,
              alignSelf: 'center' as const,
              width: '100%' as any,
            }),
          },
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

    {/* 약관 본문 전체화면 모달 */}
    <Modal
      visible={termModalVisible}
      animationType="slide"
      onRequestClose={() => setTermModalVisible(false)}
    >
      <View style={[styles.termModalContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.termModalHeader, { backgroundColor: theme.backgroundSecondary, borderBottomColor: isDark ? '#4A5568' : '#E0E0E0' }]}>
          <ThemedText style={[styles.termModalTitle, { color: theme.text }]} numberOfLines={2}>
            {termModalContent?.title}
          </ThemedText>
          <Pressable
            style={styles.termModalClose}
            onPress={() => setTermModalVisible(false)}
          >
            <Icon name="close" size={24} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.termModalBody}
          showsVerticalScrollIndicator={true}
        >
          <ThemedText style={[styles.termModalText, { color: theme.text }]}>
            {termModalContent?.content}
          </ThemedText>
        </ScrollView>
        <View style={[styles.termModalFooter, { backgroundColor: theme.backgroundSecondary, borderTopColor: isDark ? '#4A5568' : '#E0E0E0' }]}>
          <Pressable
            style={[styles.termModalConfirmBtn, { backgroundColor: BrandColors.requester }]}
            onPress={() => setTermModalVisible(false)}
          >
            <ThemedText style={styles.termModalConfirmText}>확인</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
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
  // 계약 항목 카드
  termItemContainer: {
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  termHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  termTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  termContentContainer: {
    borderTopWidth: 1,
  },
  termContent: {
    maxHeight: 400,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  termContentText: {
    fontSize: 12,
    lineHeight: 18,
  },
  termAgreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
  },
  termAgreeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  disabledRow: {
    opacity: 0.5,
  },
  readBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  overviewBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  overviewText: {
    fontSize: 12,
    lineHeight: 18,
  },
  overviewOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: Spacing.sm,
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSmall: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
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
    gap: Spacing.md,
  },
  phoneInput: {
    flex: 1,
    height: 52,
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
  termModalContainer: {
    flex: 1,
  },
  termModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  termModalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    marginRight: Spacing.md,
  },
  termModalClose: {
    padding: Spacing.xs,
  },
  termModalBody: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl * 2,
  },
  termModalText: {
    fontSize: 14,
    lineHeight: 22,
  },
  termModalFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  termModalConfirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  termModalConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
