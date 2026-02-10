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
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SignaturePad } from '@/components/SignaturePad';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';
import { apiRequest, getApiUrl } from '@/lib/query-client';
import type { ContractsStackParamList } from '@/navigation/types';

type PaymentStep = 'contract' | 'signature' | 'verification' | 'payment' | 'complete';

type Props = NativeStackScreenProps<ContractsStackParamList, 'CreateContract'>;

export default function CreateContractScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const { width: screenWidth } = useWindowDimensions();
  const [agreed, setAgreed] = useState(false);

  // Phase 2: 개별 동의 항목
  const [agreeTransportBroker, setAgreeTransportBroker] = useState(false);
  const [agreePaymentStructure, setAgreePaymentStructure] = useState(false);
  const [agreeBalanceRecalc, setAgreeBalanceRecalc] = useState(false);
  const [agreeRefundPolicy, setAgreeRefundPolicy] = useState(false);
  const [agreeContactShare, setAgreeContactShare] = useState(false);
  const [agreeDirectDealProhibit, setAgreeDirectDealProhibit] = useState(false);
  const [agreeLatePayment, setAgreeLatePayment] = useState(false); // 연체이자
  const [agreeDebtCollection, setAgreeDebtCollection] = useState(false); // 채권추심
  const [agreeJointGuarantee, setAgreeJointGuarantee] = useState(false); // 연대보증

  const [step, setStep] = useState<PaymentStep>('contract');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [hasSignature, setHasSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  
  const [balancePaymentDate, setBalancePaymentDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [requestTaxInvoice, setRequestTaxInvoice] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['/api/orders', orderId],
    queryFn: async () => {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL(`/api/orders/${orderId}`, baseUrl).href);
      if (!res.ok) throw new Error('Order not found');
      return res.json();
    },
  });

  const { data: requesterProfile } = useQuery({
    queryKey: ['/api/requesters/business'],
  });

  const { data: breakdown } = useQuery({
    queryKey: ['/api/orders', orderId, 'contract-breakdown'],
    queryFn: async () => {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getApiUrl();
      const res = await fetch(new URL(`/api/orders/${orderId}/contract-breakdown`, baseUrl).href, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!orderId,
  });

  const amounts = breakdown ? {
    total: breakdown.supplyAmount,
    totalWithVat: breakdown.totalAmount,
    deposit: breakdown.depositAmount,
    balance: breakdown.balanceAmount,
    vat: breakdown.vatAmount
  } : { total: 0, totalWithVat: 0, deposit: 0, balance: 0, vat: 0 };

  // Phase 2: 모든 필수 항목 동의 확인
  const allTermsAgreed = agreeTransportBroker &&
                         agreePaymentStructure &&
                         agreeBalanceRecalc &&
                         agreeRefundPolicy &&
                         agreeContactShare &&
                         agreeDirectDealProhibit &&
                         agreeLatePayment &&
                         agreeDebtCollection &&
                         (requesterProfile?.businessType === 'corporation' ? agreeJointGuarantee : true);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/orders/${orderId}/confirm-contract`, {
        agreed: allTermsAgreed,
        // Phase 2: 개별 동의 항목 전송
        agreeTransportBroker,
        agreePaymentStructure,
        agreeBalanceRecalc,
        agreeRefundPolicy,
        agreeContactShare,
        agreeDirectDealProhibit,
        agreeLatePayment,
        agreeDebtCollection,
        agreeJointGuarantee: requesterProfile?.businessType === 'corporation' ? agreeJointGuarantee : null,
        agreedAt: new Date().toISOString(),
        depositAmount: amounts.deposit,
        balancePaymentDate: format(balancePaymentDate, 'yyyy-MM-dd'),
        requestTaxInvoice,
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

  const handleProceedToSignature = () => {
    setStep('signature');
  };

  const handleSignatureChange = (hasSig: boolean, data: string | null) => {
    setHasSignature(hasSig);
    setSignatureData(data);
  };

  const handleProceedToVerification = () => {
    setStep('verification');
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
      const token = await AsyncStorage.getItem('auth_token');
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
      const token = await AsyncStorage.getItem('auth_token');
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

  const handleProceedToPayment = () => {
    setStep('payment');
  };

  const handlePayment = async () => {
    setIsProcessingPayment(true);
    confirmMutation.mutate();
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

  const stepOrder: PaymentStep[] = ['contract', 'signature', 'verification', 'payment', 'complete'];
  const currentStepIndex = stepOrder.indexOf(step);
  
  const isStepCompleted = (s: PaymentStep) => stepOrder.indexOf(s) < currentStepIndex;
  const isStepActive = (s: PaymentStep) => s === step;

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={styles.stepRow}>
        <View style={[styles.stepCircle, isStepActive('contract') && styles.activeStep, isStepCompleted('contract') && styles.completedStep]}>
          {isStepCompleted('contract') ? <Icon name="checkmark-outline" size={12} color="#fff" /> : <ThemedText style={styles.stepNumber}>1</ThemedText>}
        </View>
        <View style={[styles.stepLine, isStepCompleted('contract') && styles.completedLine]} />
        <View style={[styles.stepCircle, isStepActive('signature') && styles.activeStep, isStepCompleted('signature') && styles.completedStep]}>
          {isStepCompleted('signature') ? <Icon name="checkmark-outline" size={12} color="#fff" /> : <ThemedText style={styles.stepNumber}>2</ThemedText>}
        </View>
        <View style={[styles.stepLine, isStepCompleted('signature') && styles.completedLine]} />
        <View style={[styles.stepCircle, isStepActive('verification') && styles.activeStep, isStepCompleted('verification') && styles.completedStep]}>
          {isStepCompleted('verification') ? <Icon name="checkmark-outline" size={12} color="#fff" /> : <ThemedText style={styles.stepNumber}>3</ThemedText>}
        </View>
        <View style={[styles.stepLine, isStepCompleted('verification') && styles.completedLine]} />
        <View style={[styles.stepCircle, isStepActive('payment') && styles.activeStep, isStepCompleted('payment') && styles.completedStep]}>
          {isStepCompleted('payment') ? <Icon name="checkmark-outline" size={12} color="#fff" /> : <ThemedText style={styles.stepNumber}>4</ThemedText>}
        </View>
        <View style={[styles.stepLine, isStepCompleted('payment') && styles.completedLine]} />
        <View style={[styles.stepCircle, isStepActive('complete') && styles.completedStep]}>
          <ThemedText style={styles.stepNumber}>5</ThemedText>
        </View>
      </View>
      <View style={styles.stepLabels}>
        <ThemedText style={[styles.stepLabelSmall, { color: theme.text }]}>계약확인</ThemedText>
        <ThemedText style={[styles.stepLabelSmall, { color: theme.text }]}>서명</ThemedText>
        <ThemedText style={[styles.stepLabelSmall, { color: theme.text }]}>본인인증</ThemedText>
        <ThemedText style={[styles.stepLabelSmall, { color: theme.text }]}>결제</ThemedText>
        <ThemedText style={[styles.stepLabelSmall, { color: theme.text }]}>완료</ThemedText>
      </View>
    </View>
  );

  const renderContractStep = () => (
    <>
      <Card variant="glass" padding="lg" style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          오더 정보
        </ThemedText>
        
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>
            회사명
          </ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>
            {order.companyName}
          </ThemedText>
        </View>
        
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>
            배송지역
          </ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>
            {order.deliveryArea || '-'}
          </ThemedText>
        </View>
        
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>
            일정
          </ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>
            {order.scheduledDate || '-'}
            {order.scheduledDateEnd && order.scheduledDateEnd !== order.scheduledDate ? ` ~ ${order.scheduledDateEnd}` : ''}
          </ThemedText>
        </View>
        
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>
            차종
          </ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>
            {order.vehicleType}
          </ThemedText>
        </View>
        
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>
            단가
          </ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>
            {formatCurrency(order.pricePerUnit)}
          </ThemedText>
        </View>
        
        <View style={styles.infoRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>
            평균수량
          </ThemedText>
          <ThemedText style={[styles.value, { color: theme.text }]}>
            {order.averageQuantity}
          </ThemedText>
        </View>
      </Card>

      <Card variant="glass" padding="lg" style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          결제 정보
        </ThemedText>
        
        <View style={styles.amountRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>
            공급가액
          </ThemedText>
          <ThemedText style={[styles.amountValue, { color: theme.text }]}>
            {formatCurrency(amounts.total)}
          </ThemedText>
        </View>
        
        <View style={styles.amountRow}>
          <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>
            부가세 (10%)
          </ThemedText>
          <ThemedText style={[styles.amountValue, { color: theme.text }]}>
            {formatCurrency(amounts.vat)}
          </ThemedText>
        </View>
        
        <View style={[styles.amountRow, { borderTopWidth: 1, borderTopColor: Colors.light.backgroundTertiary, paddingTop: Spacing.md }]}>
          <ThemedText style={[styles.label, { color: theme.text, fontWeight: '600' }]}>
            총 금액 (VAT 포함)
          </ThemedText>
          <ThemedText style={[styles.amountValue, { color: theme.text, fontWeight: '600' }]}>
            {formatCurrency(amounts.totalWithVat)}
          </ThemedText>
        </View>
        
        <View style={[styles.amountRow, styles.highlightRow, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : BrandColors.helperLight }]}>
          <View>
            <ThemedText style={[styles.label, { color: BrandColors.requester }]}>
              계약금 (20%)
            </ThemedText>
            <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>
              지금 결제
            </ThemedText>
          </View>
          <ThemedText style={[styles.amountValue, { color: BrandColors.requester, fontWeight: '700' }]}>
            {formatCurrency(amounts.deposit)}
          </ThemedText>
        </View>
        
        <View style={styles.amountRow}>
          <View>
            <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>
              잔금 (80%)
            </ThemedText>
            <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>
              배송 완료 후 정산
            </ThemedText>
          </View>
          <ThemedText style={[styles.amountValue, { color: theme.text }]}>
            {formatCurrency(amounts.balance)}
          </ThemedText>
        </View>
        
        <View style={[styles.amountRow, { borderTopWidth: 1, borderTopColor: Colors.light.backgroundTertiary, paddingTop: Spacing.md }]}>
          <View>
            <ThemedText style={[styles.label, { color: theme.text, fontWeight: '600' }]}>
              잔금입금일 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>
              잔금 입금 예정일 (필수)
            </ThemedText>
          </View>
          <Pressable 
            style={[styles.datePickerButton, { borderColor: isDark ? 'Colors.light.textSecondary' : Colors.light.backgroundTertiary }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Icon name="calendar-outline" size={18} color={BrandColors.requester} />
            <ThemedText style={[styles.dateText, { color: theme.text }]}>
              {format(balancePaymentDate, 'yyyy년 M월 d일', { locale: ko })}
            </ThemedText>
          </Pressable>
        </View>

        <View style={[styles.amountRow, { borderTopWidth: 1, borderTopColor: Colors.light.backgroundTertiary, paddingTop: Spacing.md }]}>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.label, { color: theme.text, fontWeight: '600' }]}>
              세금계산서 발행 요청
            </ThemedText>
            <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>
              정산 완료 후 세금계산서를 받으시겠습니까?
            </ThemedText>
          </View>
          <Pressable 
            style={[styles.checkboxContainer, { borderColor: requestTaxInvoice ? BrandColors.requester : (isDark ? 'Colors.light.textSecondary' : Colors.light.backgroundTertiary) }]}
            onPress={() => setRequestTaxInvoice(!requestTaxInvoice)}
          >
            {requestTaxInvoice ? (
              <Icon name="checkbox" size={24} color={BrandColors.requester} />
            ) : (
              <Icon name="square-outline" size={24} color={isDark ? 'Colors.light.textSecondary' : 'Colors.light.textTertiary'} />
            )}
          </Pressable>
        </View>

        {requestTaxInvoice && !requesterProfile?.businessNumber && (
          <View style={[styles.warningBox, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : BrandColors.warningLight }]}>
            <Icon name="warning-outline" size={20} color="BrandColors.warning" />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText style={[styles.warningText, { color: BrandColors.warning }]}>
                사업자정보가 등록되지 않았습니다
              </ThemedText>
              <ThemedText style={[styles.warningHint, { color: 'BrandColors.warning' }]}>
                세금계산서 발행을 위해 나의정보에서 사업자정보를 등록해주세요
              </ThemedText>
            </View>
          </View>
        )}
      </Card>

      <Card variant="glass" padding="lg" style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          당사자 정보
        </ThemedText>
        
        <View style={[styles.partySection, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : BrandColors.helperLight, marginBottom: Spacing.md }]}>
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

        <View style={[styles.partySection, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : BrandColors.successLight }]}>
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
      </Card>

      <Card variant="glass" padding="lg" style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          필수 동의사항 (모두 체크 필수)
        </ThemedText>

        <View style={styles.termsList}>
          {/* 1. 운송주선 사업자 이해 */}
          <Pressable style={styles.termItem} onPress={() => setAgreeTransportBroker(!agreeTransportBroker)}>
            <View style={[
              styles.checkbox,
              { borderColor: agreeTransportBroker ? BrandColors.requester : Colors.light.tabIconDefault },
              agreeTransportBroker && { backgroundColor: BrandColors.requester }
            ]}>
              {agreeTransportBroker ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
            </View>
            <ThemedText style={[styles.termText, { color: theme.text }]}>
              플랫폼이 "운송주선 사업자"이며, 직접 운송이 아닌 기사(헬퍼)가 수행함을 이해하고 동의합니다.
            </ThemedText>
          </Pressable>

          {/* 2. 결제 구조 동의 */}
          <Pressable style={styles.termItem} onPress={() => setAgreePaymentStructure(!agreePaymentStructure)}>
            <View style={[
              styles.checkbox,
              { borderColor: agreePaymentStructure ? BrandColors.requester : Colors.light.tabIconDefault },
              agreePaymentStructure && { backgroundColor: BrandColors.requester }
            ]}>
              {agreePaymentStructure ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
            </View>
            <ThemedText style={[styles.termText, { color: theme.text }]}>
              본 오더의 결제 구조가 "계약금 20% + 잔금 80%"임에 동의합니다.
            </ThemedText>
          </Pressable>

          {/* 3. 잔금 재산정 동의 */}
          <Pressable style={styles.termItem} onPress={() => setAgreeBalanceRecalc(!agreeBalanceRecalc)}>
            <View style={[
              styles.checkbox,
              { borderColor: agreeBalanceRecalc ? BrandColors.requester : Colors.light.tabIconDefault },
              agreeBalanceRecalc && { backgroundColor: BrandColors.requester }
            ]}>
              {agreeBalanceRecalc ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
            </View>
            <ThemedText style={[styles.termText, { color: theme.text }]}>
              잔금이 "마감자료(증빙) 기준"으로 재산정될 수 있음에 동의합니다.
            </ThemedText>
          </Pressable>

          {/* 4. 환불 정책 동의 */}
          <Pressable style={styles.termItem} onPress={() => setAgreeRefundPolicy(!agreeRefundPolicy)}>
            <View style={[
              styles.checkbox,
              { borderColor: agreeRefundPolicy ? BrandColors.requester : Colors.light.tabIconDefault },
              agreeRefundPolicy && { backgroundColor: BrandColors.requester }
            ]}>
              {agreeRefundPolicy ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
            </View>
            <ThemedText style={[styles.termText, { color: theme.text }]}>
              환불 정책에 동의합니다. (매칭 전: 100% 환불 / 매칭 후: 환불 불가)
            </ThemedText>
          </Pressable>

          {/* 5. 연락처 제공 동의 */}
          <Pressable style={styles.termItem} onPress={() => setAgreeContactShare(!agreeContactShare)}>
            <View style={[
              styles.checkbox,
              { borderColor: agreeContactShare ? BrandColors.requester : Colors.light.tabIconDefault },
              agreeContactShare && { backgroundColor: BrandColors.requester }
            ]}>
              {agreeContactShare ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
            </View>
            <ThemedText style={[styles.termText, { color: theme.text }]}>
              매칭 완료 시 기사에게 업무 수행 목적의 연락처가 제공될 수 있음에 동의합니다.
            </ThemedText>
          </Pressable>

          {/* 6. 직거래 금지 동의 */}
          <Pressable style={styles.termItem} onPress={() => setAgreeDirectDealProhibit(!agreeDirectDealProhibit)}>
            <View style={[
              styles.checkbox,
              { borderColor: agreeDirectDealProhibit ? BrandColors.requester : Colors.light.tabIconDefault },
              agreeDirectDealProhibit && { backgroundColor: BrandColors.requester }
            ]}>
              {agreeDirectDealProhibit ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
            </View>
            <ThemedText style={[styles.termText, { color: theme.text }]}>
              플랫폼 외 직거래 금지 및 위반 시 이용제한/손해배상에 동의합니다.
            </ThemedText>
          </Pressable>

          {/* 7. 연체이자 조항 동의 (NEW - Phase 2) */}
          <Pressable style={styles.termItem} onPress={() => setAgreeLatePayment(!agreeLatePayment)}>
            <View style={[
              styles.checkbox,
              { borderColor: agreeLatePayment ? BrandColors.requester : Colors.light.tabIconDefault },
              agreeLatePayment && { backgroundColor: BrandColors.requester }
            ]}>
              {agreeLatePayment ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
            </View>
            <ThemedText style={[styles.termText, { color: theme.text }]}>
              잔금 미납 시 연체이자(연 15%, 일할 계산) 발생에 동의합니다.
            </ThemedText>
          </Pressable>

          {/* 8. 채권추심 조항 동의 (NEW - Phase 2) */}
          <Pressable style={styles.termItem} onPress={() => setAgreeDebtCollection(!agreeDebtCollection)}>
            <View style={[
              styles.checkbox,
              { borderColor: agreeDebtCollection ? BrandColors.requester : Colors.light.tabIconDefault },
              agreeDebtCollection && { backgroundColor: BrandColors.requester }
            ]}>
              {agreeDebtCollection ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
            </View>
            <ThemedText style={[styles.termText, { color: theme.text }]}>
              연체 시 독촉→서비스제한→신용등록→추심위탁→법적조치 진행에 동의합니다.
            </ThemedText>
          </Pressable>

          {/* 9. 연대보증 조항 동의 (NEW - Phase 2, 법인만 해당) */}
          {requesterProfile?.businessType === 'corporation' && (
            <Pressable style={styles.termItem} onPress={() => setAgreeJointGuarantee(!agreeJointGuarantee)}>
              <View style={[
                styles.checkbox,
                { borderColor: agreeJointGuarantee ? BrandColors.requester : Colors.light.tabIconDefault },
                agreeJointGuarantee && { backgroundColor: BrandColors.requester }
              ]}>
                {agreeJointGuarantee ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
              </View>
              <ThemedText style={[styles.termText, { color: theme.text }]}>
                법인 대표자로서 연대보증 책임에 동의합니다.
              </ThemedText>
            </Pressable>
          )}
        </View>
      </Card>

      <Card variant="glass" padding="lg" style={[styles.card, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundRoot }]}>
        <ThemedText style={[styles.signDateText, { color: theme.tabIconDefault }]}>
          서명일: {format(new Date(), 'yyyy년 M월 d일', { locale: ko })}
        </ThemedText>
      </Card>

      <Pressable
        style={styles.agreeRow}
        onPress={() => setAgreed(!agreed)}
      >
        <View style={[
          styles.checkbox,
          { borderColor: agreed ? BrandColors.requester : Colors.light.tabIconDefault },
          agreed && { backgroundColor: BrandColors.requester }
        ]}>
          {agreed ? <Icon name="checkmark-outline" size={14} color="#fff" /> : null}
        </View>
        <ThemedText style={[styles.agreeText, { color: theme.text }]}>
          위 내용을 확인하였으며, 오더 등록 및 운송주선 의뢰 계약에 동의합니다.
        </ThemedText>
      </Pressable>

      <View style={styles.buttonContainer}>
        <Button
          onPress={handleProceedToSignature}
          disabled={!allTermsAgreed || !agreed}
          style={{ backgroundColor: (allTermsAgreed && agreed) ? BrandColors.requester : Colors.light.tabIconDefault }}
        >
          다음: 전자서명
        </Button>
        
        <Pressable 
          style={({ pressed }) => [styles.cancelButton, { opacity: pressed ? 0.5 : 1 }]}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Contracts');
            }
          }}
        >
          <ThemedText style={[styles.cancelText, { color: Colors.light.tabIconDefault }]}>
            취소하고 돌아가기
          </ThemedText>
        </Pressable>
      </View>
    </>
  );

  const renderSignatureStep = () => (
    <>
      <Card variant="glass" padding="lg" style={styles.card}>
        <View style={styles.headerRow}>
          <Icon name="create-outline" size={24} color={BrandColors.requester} />
          <ThemedText style={[styles.title, { color: theme.text }]}>
            전자서명
          </ThemedText>
        </View>
        
        <ThemedText style={[styles.subtitle, { color: Colors.light.tabIconDefault }]}>
          계약 동의를 위해 아래에 서명해 주세요.
        </ThemedText>
      </Card>

      <Card variant="glass" padding="lg" style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          서명란
        </ThemedText>
        
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
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          onPress={handleProceedToVerification}
          disabled={!hasSignature}
          style={{ backgroundColor: hasSignature ? BrandColors.requester : Colors.light.tabIconDefault }}
        >
          다음: 본인인증
        </Button>
        
        <Pressable 
          style={styles.cancelButton}
          onPress={() => setStep('contract')}
        >
          <ThemedText style={[styles.cancelText, { color: Colors.light.tabIconDefault }]}>
            이전 단계로
          </ThemedText>
        </Pressable>
      </View>
    </>
  );

  const renderVerificationStep = () => (
    <>
      <Card variant="glass" padding="lg" style={styles.card}>
        <View style={styles.headerRow}>
          <Icon name="cellphone" size={24} color={BrandColors.requester} />
          <ThemedText style={[styles.title, { color: theme.text }]}>
            휴대폰 본인인증
          </ThemedText>
        </View>
        
        <ThemedText style={[styles.subtitle, { color: Colors.light.tabIconDefault }]}>
          계약 체결을 위해 본인 확인이 필요합니다.
        </ThemedText>
      </Card>

      <Card variant="glass" padding="lg" style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          휴대폰 번호
        </ThemedText>
        
        <View style={styles.phoneInputRow}>
          <TextInput
            style={[
              styles.phoneInput,
              { 
                backgroundColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundSecondary,
                color: theme.text,
                borderColor: isDark ? '#444' : Colors.light.backgroundTertiary,
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
            <ThemedText style={[styles.sectionTitle, { color: theme.text, marginTop: Spacing.lg }]}>
              인증번호
            </ThemedText>
            
            <View style={styles.phoneInputRow}>
              <TextInput
                style={[
                  styles.phoneInput,
                  { 
                    backgroundColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundSecondary,
                    color: theme.text,
                    borderColor: isVerified ? BrandColors.requester : (isDark ? '#444' : Colors.light.backgroundTertiary),
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
            <ThemedText style={[styles.verifiedText, { color: BrandColors.success }]}>
              본인인증이 완료되었습니다
            </ThemedText>
          </View>
        ) : null}
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          onPress={handleProceedToPayment}
          disabled={!isVerified}
          style={{ backgroundColor: isVerified ? BrandColors.requester : Colors.light.tabIconDefault }}
        >
          다음: 계약금 결제
        </Button>
        
        <Pressable 
          style={styles.cancelButton}
          onPress={() => setStep('signature')}
        >
          <ThemedText style={[styles.cancelText, { color: Colors.light.tabIconDefault }]}>
            이전 단계로
          </ThemedText>
        </Pressable>
      </View>
    </>
  );

  const renderPaymentStep = () => (
    <>
      <Card variant="glass" padding="lg" style={styles.card}>
        <View style={styles.headerRow}>
          <Icon name="card-outline" size={24} color={BrandColors.requester} />
          <ThemedText style={[styles.title, { color: theme.text }]}>
            계약금 결제
          </ThemedText>
        </View>
        
        <ThemedText style={[styles.subtitle, { color: Colors.light.tabIconDefault }]}>
          아래 금액을 결제해주세요.
        </ThemedText>
      </Card>

      <Card variant="glass" padding="lg" style={styles.card}>
        <View style={[styles.paymentSummary, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : BrandColors.helperLight }]}>
          <ThemedText style={[styles.paymentLabel, { color: Colors.light.tabIconDefault }]}>
            결제 금액
          </ThemedText>
          <ThemedText style={[styles.paymentAmount, { color: BrandColors.requester }]}>
            {formatCurrency(amounts.deposit)}
          </ThemedText>
        </View>
        
        <View style={styles.paymentInfo}>
          <View style={styles.paymentInfoRow}>
            <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>
              회사명
            </ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>
              {order.companyName}
            </ThemedText>
          </View>
          <View style={styles.paymentInfoRow}>
            <ThemedText style={[styles.label, { color: Colors.light.tabIconDefault }]}>
              일정
            </ThemedText>
            <ThemedText style={[styles.value, { color: theme.text }]}>
              {order.scheduledDate}
            </ThemedText>
          </View>
        </View>
      </Card>

      <Card variant="glass" padding="lg" style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          결제 안내
        </ThemedText>
        <View style={styles.termsList}>
          <View style={styles.termItem}>
            <Icon name="information-circle-outline" size={16} color={BrandColors.requester} />
            <ThemedText style={[styles.termText, { color: theme.text }]}>
              결제 완료 후 관리자가 입금을 확인합니다.
            </ThemedText>
          </View>
          <View style={styles.termItem}>
            <Icon name="information-circle-outline" size={16} color={BrandColors.requester} />
            <ThemedText style={[styles.termText, { color: theme.text }]}>
              입금 확인 후 오더가 헬퍼에게 공개됩니다.
            </ThemedText>
          </View>
        </View>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          onPress={handlePayment}
          disabled={isProcessingPayment || confirmMutation.isPending}
          style={{ backgroundColor: BrandColors.requester }}
        >
          {isProcessingPayment || confirmMutation.isPending ? '처리 중...' : `${formatCurrency(amounts.deposit)} 결제하기`}
        </Button>
        
        <Pressable 
          style={styles.cancelButton}
          onPress={() => setStep('contract')}
        >
          <ThemedText style={[styles.cancelText, { color: Colors.light.tabIconDefault }]}>
            이전 단계로
          </ThemedText>
        </Pressable>
      </View>
    </>
  );

  const renderCompleteStep = () => (
    <>
      <Card variant="glass" padding="lg" style={StyleSheet.flatten([styles.card, styles.completeCard])}>
        <View style={styles.completeIcon}>
          <View style={[styles.completeCircle, { backgroundColor: BrandColors.requester }]}>
            <Icon name="checkmark-outline" size={40} color="#fff" />
          </View>
        </View>
        
        <ThemedText style={[styles.completeTitle, { color: theme.text }]}>
          계약금 결제 완료
        </ThemedText>
        
        <ThemedText style={[styles.completeSubtitle, { color: Colors.light.tabIconDefault }]}>
          관리자가 입금을 확인하면 오더가 등록됩니다.
        </ThemedText>
      </Card>

      <Card variant="glass" padding="lg" style={styles.card}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          다음 단계
        </ThemedText>
        
        <View style={styles.nextSteps}>
          <View style={styles.nextStepItem}>
            <View style={[styles.nextStepNumber, { backgroundColor: BrandColors.warningLight }]}>
              <ThemedText style={{ color: 'BrandColors.warning', fontWeight: '700' }}>1</ThemedText>
            </View>
            <View style={styles.nextStepContent}>
              <ThemedText style={[styles.nextStepTitle, { color: theme.text }]}>
                승인 대기
              </ThemedText>
              <ThemedText style={[styles.nextStepDesc, { color: Colors.light.tabIconDefault }]}>
                관리자가 계약금 입금을 확인합니다.
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.nextStepItem}>
            <View style={[styles.nextStepNumber, { backgroundColor: BrandColors.helperLight }]}>
              <ThemedText style={{ color: 'BrandColors.primaryLight', fontWeight: '700' }}>2</ThemedText>
            </View>
            <View style={styles.nextStepContent}>
              <ThemedText style={[styles.nextStepTitle, { color: theme.text }]}>
                오더 등록
              </ThemedText>
              <ThemedText style={[styles.nextStepDesc, { color: Colors.light.tabIconDefault }]}>
                승인 후 헬퍼 앱에 오더가 공개됩니다.
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.nextStepItem}>
            <View style={[styles.nextStepNumber, { backgroundColor: BrandColors.successLight }]}>
              <ThemedText style={{ color: 'BrandColors.success', fontWeight: '700' }}>3</ThemedText>
            </View>
            <View style={styles.nextStepContent}>
              <ThemedText style={[styles.nextStepTitle, { color: theme.text }]}>
                헬퍼 매칭
              </ThemedText>
              <ThemedText style={[styles.nextStepDesc, { color: Colors.light.tabIconDefault }]}>
                헬퍼가 신청하면 매칭이 진행됩니다.
              </ThemedText>
            </View>
          </View>
        </View>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          onPress={() => {
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              })
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
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.lg + 94 }]}
        showsVerticalScrollIndicator={false}
      >
        {renderStepIndicator()}
        
        {step === 'contract' && renderContractStep()}
        {step === 'signature' && renderSignatureStep()}
        {step === 'verification' && renderVerificationStep()}
        {step === 'payment' && renderPaymentStep()}
        {step === 'complete' && renderCompleteStep()}
      </ScrollView>

      {Platform.OS === 'web' && showDatePicker ? (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable 
            style={styles.datePickerOverlay}
            onPress={() => setShowDatePicker(false)}
          >
            <View 
              style={[styles.datePickerContainer, { backgroundColor: theme.backgroundRoot }]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.datePickerHeader}>
                <ThemedText style={[styles.datePickerTitle, { color: theme.text }]}>
                  잔금입금일 선택
                </ThemedText>
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
                  border: `1px solid ${isDark ? 'Colors.light.textSecondary' : Colors.light.backgroundTertiary}`,
                  backgroundColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.buttonText,
                  color: isDark ? Colors.light.buttonText : Colors.light.text,
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
            <Pressable 
              style={styles.datePickerOverlay}
              onPress={() => setShowDatePicker(false)}
            >
              <View style={[styles.datePickerContainer, { backgroundColor: theme.backgroundRoot }]}>
                <View style={styles.datePickerHeader}>
                  <ThemedText style={[styles.datePickerTitle, { color: theme.text }]}>
                    잔금입금일 선택
                  </ThemedText>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  card: {
    marginBottom: Spacing.md,
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
    borderBottomColor: Colors.light.backgroundTertiary,
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
    borderBottomColor: Colors.light.backgroundTertiary,
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
  signDateText: {
    ...Typography.small,
    textAlign: 'center',
    fontStyle: 'italic',
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
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeStep: {
    backgroundColor: BrandColors.primaryLight,
  },
  completedStep: {
    backgroundColor: 'BrandColors.success',
  },
  stepLine: {
    width: 50,
    height: 2,
    backgroundColor: Colors.light.backgroundTertiary,
  },
  completedLine: {
    backgroundColor: 'BrandColors.success',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingHorizontal: 0,
  },
  stepLabel: {
    ...Typography.small,
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
  stepLabelSmall: {
    fontSize: 10,
    textAlign: 'center',
    flex: 1,
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
    backgroundColor: BrandColors.successLight,
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
    color: Colors.light.buttonText,
    fontWeight: '600',
    fontSize: 16,
  },
});
