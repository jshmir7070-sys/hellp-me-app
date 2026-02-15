import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from "@/components/Icon";

import { ThemedText } from '@/components/ThemedText';
import { AddressInput } from '@/components/AddressInput';
import { useTheme } from '@/hooks/useTheme';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

const logoImage = require('../assets/images/hellpme-logo.png');

const HELPER_TERMS = {
  terms: {
    title: '서비스 성격 및 중개 구조 동의',
    content: `본인은 헬프미(Hellp Me) 플랫폼이 운송 업무를 직접 수행하거나 운송 계약의 당사자가 아닌, 의뢰자와 운송 기사 간의 거래를 중개하는 플랫폼임을 명확히 이해하고 이에 동의합니다.

회사는 운송 기사에 대한 고용, 지휘·감독, 근로관계에 해당하지 않으며 본인은 독립적인 사업자 또는 개인 자격으로 플랫폼을 이용함에 동의합니다.`
  },
  liability: {
    title: '운송 책임 및 손해 배상 책임 동의',
    content: `본인은 운송 과정에서 발생하는 다음 사항에 대한 책임이 운송을 수행한 기사 본인에게 귀속됨을 이해하고 동의합니다.

• 화물의 분실, 파손, 훼손
• 배송 지연 또는 오배송
• 운송 중 발생한 사고

회사는 위 사항에 대해 직접적인 책임을 부담하지 않으며, 플랫폼은 분쟁 해결을 위한 중재 및 증빙 관리 기능만을 제공합니다.`
  },
  privacy: {
    title: '개인정보 수집 및 이용 동의',
    content: `▪ 수집 항목
• 필수정보: 이름, 휴대전화번호, 로그인 정보
• 운송 관련 정보: 차량 정보, 자격 정보, 위치 정보
• 정산 정보: 정산 내역, 지급 계좌 정보
• 증빙 정보: 업무 증빙 사진, 운송 로그

▪ 이용 목적
• 기사 식별 및 서비스 제공
• 오더 매칭 및 업무 관리
• 결제·정산 처리
• 분쟁 대응 및 고객 지원

▪ 보유 기간
회원 탈퇴 시까지
(단, 관련 법령에 따라 일정 기간 보관될 수 있음)`
  },
  location: {
    title: '위치정보 수집·이용 동의',
    content: `회사는 원활한 매칭 및 배송 관리, 분쟁 방지를 위해 서비스 이용 중 위치정보를 수집·이용할 수 있습니다.

본인은 위치정보 제공에 동의하지 않을 경우 서비스 이용이 제한될 수 있음을 이해합니다.`
  },
  payment: {
    title: '결제·정산 정책 동의',
    content: `본인은 헬프미 플랫폼의 정산 구조 및 지급 조건에 동의합니다.

• 정산 금액은 플랫폼 정책에 따라 산정됩니다.
• 플랫폼 수수료, 산재보험료(본인부담분 50%), 세금(3.3% 사업소득 원천징수), 분쟁 차감액 등이 차감될 수 있습니다.
• 정산 일정: 마감 후 익월 정산 (앱 내 고지된 정책 준수)
• 화물 파손/분실 시 배상액이 정산에서 차감될 수 있습니다.`
  },
  electronic: {
    title: '전자계약 및 고지 수단 동의',
    content: `본인은 앱 내에서 이루어지는 전자적 동의, 전자문서, 전자서명이 서면 계약과 동일한 법적 효력을 가짐에 동의합니다.

또한 서비스 관련 고지 및 안내를 앱 알림, 문자(SMS), 이메일 등 전자적 수단으로 수신하는 것에 동의합니다.`
  },
  industrialAccidentInsurance: {
    title: '산업재해보상보험 안내 확인 및 보험료 원천공제 동의',
    content: `▪ 산재보험 당연적용 안내 (산업재해보상보험법 제91조의15~21)

본인은 화물차주로서 「산업재해보상보험법」상 노무제공자에 해당하여, 산업재해보상보험에 당연 적용됨을 확인합니다.

• 2023년 7월 1일부터 모든 화물차주는 전속성 요건 없이 산재보험 당연적용 대상입니다.
• 본인의 의사만으로 산재보험 적용을 제외(탈퇴)할 수 없습니다.
• 부상/질병/임신/출산/육아 등으로 노무를 제공하지 못하는 경우 휴업신고가 가능합니다.

▪ 보험료 부담 구조 (보험료징수법 제48조의6)

• 산재보험료는 플랫폼(사업주)과 노무제공자(화물차주)가 각각 50%씩 부담합니다.
• 산재보험료율: 약 1.7~1.8% (직종별 요율 + 출퇴근재해요율)
• 보험료 = 월 보수액 × 산재보험료율

▪ 보험료 원천공제 동의

본인은 헬프미 플랫폼이 정산 시 본인 부담분(50%)의 산재보험료를 보수에서 원천공제하여 사업주 부담분과 합산 납부하는 것에 동의합니다.

• 원천공제 시 공제계산서가 발급됩니다.
• 매년 3월 31일까지 전년도 보험료가 정산됩니다.`
  },
  cargoInsurance: {
    title: '적재물배상책임보험 안내 확인',
    content: `▪ 적재물배상책임보험 (화물자동차 운수사업법 제35조)

최대 적재량 5톤 이상 또는 총중량 10톤 이상 화물자동차 소유 운송사업자는 적재물배상책임보험에 의무 가입해야 합니다.

• 사고 1건당 2천만원 이상 보장하는 보험 또는 공제 가입 필수
• 미가입 시 화물자동차 1대당 50만원 이하 과태료 (동법 제70조)
• 5톤 미만 차량도 자발적 가입 가능 (권장)

▪ 가입처
• 전국화물자동차운송사업자공제조합 또는 손해보험사

본인은 해당 보험 가입 의무를 인지하였으며, 적재물 배상 책임은 본인에게 귀속됨을 확인합니다.`
  },
  independentContractor: {
    title: '독립사업자(비고용) 관계 확인',
    content: `본인은 헬프미(Hellp Me) 플랫폼과의 관계에 대해 다음 사항을 확인합니다.

▪ 고용관계 부존재 확인
• 본인과 플랫폼 간에는 근로기준법상 고용관계가 성립하지 않습니다.
• 본인은 독립적인 개인사업자 자격으로 플랫폼을 이용합니다.
• 4대 보험(국민연금, 건강보험, 고용보험, 장기요양보험)은 적용되지 않습니다.

▪ 세금 관련 안내
• 본인의 소득은 사업소득(3.3% 원천징수)으로 처리됩니다.
• 종합소득세 신고·납부 의무는 본인에게 있습니다.

▪ 산재보험 특례
• 산업재해보상보험법상 노무제공자 특례에 따라 산재보험은 적용됩니다 (별도 동의 항목 참조).`
  },
  marketing: {
    title: '마케팅 정보 수신 동의',
    content: `헬프미 서비스의 이벤트, 프로모션, 할인 정보 등 마케팅 관련 정보를 앱 알림, 문자(SMS), 이메일 등으로 수신하는 것에 동의합니다.

본 동의는 선택 사항이며, 동의하지 않아도 서비스 이용에 제한이 없습니다.`
  }
};

const REQUESTER_TERMS = {
  terms: {
    title: '서비스 이용약관 동의',
    content: `헬프미(Hellp Me) 서비스 이용약관에 동의합니다.

본 서비스는 의뢰자와 운송 기사 간의 거래를 중개하는 플랫폼입니다. 회사는 거래의 당사자가 아니며, 운송 서비스의 품질이나 결과에 대해 직접적인 책임을 지지 않습니다.

서비스 이용 시 관련 법령 및 본 약관을 준수해야 하며, 위반 시 서비스 이용이 제한될 수 있습니다.`
  },
  liability: {
    title: '책임 제한 및 면책 동의',
    content: `헬프미는 의뢰자와 헬퍼(기사) 간 거래를 중개하는 플랫폼으로서, 다음 사항에 대해 직접적인 책임을 부담하지 않습니다.

• 운송 과정에서 발생하는 화물의 분실, 파손, 훼손
• 배송 지연 또는 오배송으로 인한 손해
• 헬퍼의 과실로 인한 사고 또는 손해

분쟁 발생 시 플랫폼은 중재 및 증빙 관리 기능을 제공합니다.`
  },
  privacy: {
    title: '개인정보 수집·이용 동의',
    content: `▪ 수집 항목
• 필수정보: 이름, 휴대전화번호, 이메일, 로그인 정보
• 사업자 정보: 사업자등록번호, 상호명, 사업장 주소
• 결제 정보: 결제 수단, 결제 내역

▪ 이용 목적
• 회원 식별 및 서비스 제공
• 주문 처리 및 배송 관리
• 결제 처리 및 정산
• 분쟁 대응 및 고객 지원

▪ 보유 기간
회원 탈퇴 시까지
(단, 관련 법령에 따라 일정 기간 보관될 수 있음)`
  },
  location: {
    title: '위치정보 수집·이용 동의',
    content: `회사는 원활한 서비스 제공 및 배송 관리를 위해 서비스 이용 중 위치정보를 수집·이용할 수 있습니다.

• 픽업/배송 주소 확인
• 실시간 배송 현황 조회
• 서비스 개선을 위한 통계 분석

본인은 위치정보 제공에 동의하지 않을 경우 일부 서비스 이용이 제한될 수 있음을 이해합니다.`
  },
  payment: {
    title: '결제·정산 및 취소/환불 정책 동의',
    content: `본인은 헬프미 플랫폼의 결제, 정산 및 취소/환불 정책에 동의합니다.

▪ 결제 구조
• 선결제(계약금 20%) 방식이 적용되며, 잔금(80%)은 서비스 완료 후 정산됩니다.
• 서비스 이용료(플랫폼 수수료)가 별도 적용됩니다.

▪ 취소/환불 정책 (전자상거래법 제17조 준수)
• 오더 매칭 전: 전액 환불 (계약금 100% 반환)
• 오더 매칭 후 ~ 작업 시작 전: 계약금의 90% 환불 (위약금 10%)
• 작업 시작 후: 환불 불가 (단, 헬퍼 귀책사유 시 전액 환불)
• 환불은 결제 수단과 동일한 방법으로 3~7영업일 내 처리됩니다.

▪ 화물 가액 신고
• 요청자는 오더 등록 시 화물의 대략적 가액을 신고해야 합니다.
• 미신고 시 화물 파손/분실에 대한 배상 한도가 제한될 수 있습니다.`
  },
  electronic: {
    title: '전자계약 및 고지 수단 동의',
    content: `본인은 앱 내에서 이루어지는 전자적 동의, 전자문서, 전자서명이 서면 계약과 동일한 법적 효력을 가짐에 동의합니다.

또한 서비스 관련 고지 및 안내를 앱 알림, 문자(SMS), 이메일 등 전자적 수단으로 수신하는 것에 동의합니다.`
  },
  marketing: {
    title: '마케팅 정보 수신 동의',
    content: `헬프미 서비스의 이벤트, 프로모션, 할인 정보 등 마케팅 관련 정보를 앱 알림, 문자(SMS), 이메일 등으로 수신하는 것에 동의합니다.

본 동의는 선택 사항이며, 동의하지 않아도 서비스 이용에 제한이 없습니다.`
  }
};

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function SignupScreen({ navigation }: SignupScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { signup } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  
  const [emailChecked, setEmailChecked] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [agreements, setAgreements] = useState({
    all: false,
    terms: false,
    privacy: false,
    location: false,
    payment: false,
    liability: false,
    electronic: false,
    marketing: false,
    // 헬퍼 전용 필수 동의
    industrialAccidentInsurance: false,
    cargoInsurance: false,
    independentContractor: false,
  });

  const [termModalVisible, setTermModalVisible] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<{ title: string; content: string } | null>(null);

  function openTermModal(termKey: string) {
    const terms = selectedRole === 'helper' ? HELPER_TERMS : REQUESTER_TERMS;
    const term = (terms as Record<string, { title: string; content: string }>)[termKey];
    if (term) {
      setSelectedTerm(term);
      setTermModalVisible(true);
    }
  }

  const passwordValidation = {
    length: password.length >= 8,
    letter: /[a-zA-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const isPasswordValid = Object.values(passwordValidation).every(Boolean);
  const passwordsMatch = password === passwordConfirm && passwordConfirm.length > 0;
  const isCommonAgreed = agreements.terms && agreements.privacy && agreements.location && agreements.payment && agreements.liability && agreements.electronic;
  const isHelperExtraAgreed = selectedRole === 'helper' ? (agreements.industrialAccidentInsurance && agreements.cargoInsurance && agreements.independentContractor) : true;
  const isRequiredAgreed = isCommonAgreed && isHelperExtraAgreed;

  function handleRoleSelect(role: UserRole) {
    setSelectedRole(role);
    setStep(2);
    setError(null);
  }

  function handleAllAgreement(checked: boolean) {
    setAgreements({
      all: checked,
      terms: checked,
      privacy: checked,
      location: checked,
      payment: checked,
      liability: checked,
      electronic: checked,
      marketing: checked,
      industrialAccidentInsurance: checked,
      cargoInsurance: checked,
      independentContractor: checked,
    });
  }

  function handleSingleAgreement(key: keyof typeof agreements, checked: boolean) {
    const newAgreements = { ...agreements, [key]: checked };
    const commonAgreed = newAgreements.terms && newAgreements.privacy && newAgreements.location && newAgreements.payment && newAgreements.liability && newAgreements.electronic;
    const helperExtra = selectedRole === 'helper' ? (newAgreements.industrialAccidentInsurance && newAgreements.cargoInsurance && newAgreements.independentContractor) : true;
    newAgreements.all = commonAgreed && helperExtra && newAgreements.marketing;
    setAgreements(newAgreements);
  }

  async function checkEmailDuplicate() {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('올바른 이메일 형식을 입력해주세요');
      return;
    }
    setEmailChecking(true);
    setError(null);
    try {
      const res = await fetch(new URL('/api/auth/check-email', getApiUrl()).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setEmailChecked(data.available);
      if (data.available) {
        setSuccessMessage('사용 가능한 이메일입니다');
      } else {
        setError('이미 사용중인 이메일입니다');
      }
    } catch {
      setError('서버 연결에 실패했습니다');
    } finally {
      setEmailChecking(false);
    }
  }

  async function handleSendVerificationCode() {
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      setError('올바른 전화번호를 입력해주세요');
      return;
    }

    setIsSendingCode(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(new URL('/api/auth/send-signup-code', getApiUrl()).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowVerificationInput(true);
        let msg = '인증번호가 발송되었습니다. 3분 내에 입력해주세요.';
        if (data.devCode) {
          msg = `인증번호가 발송되었습니다. (개발모드: ${data.devCode})`;
        }
        setSuccessMessage(msg);
      } else {
        setError(data.message || '인증번호 발송에 실패했습니다');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다');
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleVerifyCode() {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('6자리 인증번호를 입력해주세요');
      return;
    }

    setIsVerifyingCode(true);
    setError(null);

    try {
      const response = await fetch(new URL('/api/auth/verify-signup-code', getApiUrl()).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumber: phoneNumber.trim(),
          code: verificationCode.trim()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsPhoneVerified(true);
        setSuccessMessage('휴대폰 인증이 완료되었습니다');
      } else {
        setError(data.message || '인증번호가 올바르지 않습니다');
      }
    } catch (err) {
      setError('서버 연결에 실패했습니다');
    } finally {
      setIsVerifyingCode(false);
    }
  }

  async function handleSignup() {
    if (!emailChecked) {
      setError('이메일 중복 확인을 해주세요');
      return;
    }
    if (!isPasswordValid) {
      setError('비밀번호 조건을 충족해주세요');
      return;
    }
    if (!passwordsMatch) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    if (!name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    if (!phoneNumber.trim() || phoneNumber.length < 10) {
      setError('전화번호를 입력해주세요');
      return;
    }
    if (!isRequiredAgreed) {
      setError('필수 약관에 동의해주세요');
      return;
    }

    setIsLoading(true);
    setError(null);

    const fullAddress = addressDetail.trim() 
      ? `${address} ${addressDetail.trim()}` 
      : address;
    
    const result = await signup({
      name: name.trim(),
      email: email.trim(),
      password,
      phoneNumber: phoneNumber.trim(),
      role: selectedRole,
      address: fullAddress || undefined,
      agreements: {
        terms: agreements.terms,
        privacy: agreements.privacy,
        location: agreements.location,
        payment: agreements.payment,
        liability: agreements.liability,
        electronic: agreements.electronic,
        marketing: agreements.marketing,
        ...(selectedRole === 'helper' ? {
          industrialAccidentInsurance: agreements.industrialAccidentInsurance,
          cargoInsurance: agreements.cargoInsurance,
          independentContractor: agreements.independentContractor,
        } : {}),
      },
    });

    setIsLoading(false);

    if (!result.success) {
      setError(result.error || '회원가입에 실패했습니다');
    }
  }

  function goBack() {
    if (step === 2) {
      setStep(1);
      setError(null);
      setSuccessMessage(null);
    } else {
      navigation.goBack();
    }
  }

  const accentColor = selectedRole === 'helper' ? BrandColors.helper : BrandColors.requester;

  if (step === 1) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl }]}
        >
          <View style={styles.contentWrapper}>
          <Pressable style={styles.backButton} onPress={goBack}>
            <Icon name="arrow-back-outline" size={24} color={theme.text} />
          </Pressable>

          <View style={styles.logoContainer}>
            <Image source={logoImage} style={styles.logo} resizeMode="contain" />
          </View>

          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            어떤 서비스가 필요하신가요?
          </ThemedText>
          <ThemedText style={[styles.stepSubtitle, { color: Colors.light.tabIconDefault }]}>
            본인에게 맞는 유형을 선택해주세요
          </ThemedText>

          <View style={styles.roleCards}>
            <Pressable
              testID="button-role-helper"
              style={({ pressed }) => [
                styles.roleCard,
                { 
                  backgroundColor: theme.backgroundDefault,
                  borderColor: BrandColors.helper,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => handleRoleSelect('helper')}
            >
              <View style={[styles.roleIconContainer, { backgroundColor: BrandColors.helperLight }]}>
                <Icon name="car-outline" size={32} color={BrandColors.helper} />
              </View>
              <ThemedText style={[styles.roleTitle, { color: theme.text }]}>헬퍼</ThemedText>
              <ThemedText style={[styles.roleDescription, { color: Colors.light.tabIconDefault }]}>
                배달 업무를 수행하고{'\n'}수익을 올리고 싶어요
              </ThemedText>
            </Pressable>

            <Pressable
              testID="button-role-requester"
              style={({ pressed }) => [
                styles.roleCard,
                { 
                  backgroundColor: theme.backgroundDefault,
                  borderColor: BrandColors.requester,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => handleRoleSelect('requester')}
            >
              <View style={[styles.roleIconContainer, { backgroundColor: BrandColors.requesterLight }]}>
                <Icon name="briefcase-outline" size={32} color={BrandColors.requester} />
              </View>
              <ThemedText style={[styles.roleTitle, { color: theme.text }]}>요청자</ThemedText>
              <ThemedText style={[styles.roleDescription, { color: Colors.light.tabIconDefault }]}>
                배송 서비스가 필요한{'\n'}사업체입니다
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.loginContainer}>
            <ThemedText style={[styles.loginText, { color: Colors.light.tabIconDefault }]}>
              이미 계정이 있으신가요?
            </ThemedText>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <ThemedText style={styles.loginLink}>로그인</ThemedText>
            </Pressable>
          </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrapper}>
        <Pressable style={styles.backButton} onPress={goBack}>
          <Icon name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>

        <View style={styles.logoContainerSmall}>
          <Image source={logoImage} style={styles.logoSmall} resizeMode="contain" />
        </View>

        <View style={[styles.roleBadge, { backgroundColor: selectedRole === 'helper' ? BrandColors.helperLight : BrandColors.requesterLight }]}>
          <ThemedText style={[styles.roleBadgeText, { color: accentColor }]}>
            {selectedRole === 'helper' ? '헬퍼' : '요청자'} 가입
          </ThemedText>
        </View>

        <ThemedText style={[styles.formTitle, { color: theme.text }]}>회원가입</ThemedText>

        {error ? (
          <View style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successContainer}>
            <ThemedText style={styles.successText}>{successMessage}</ThemedText>
          </View>
        ) : null}

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>이메일 *</ThemedText>
            <View style={styles.inputRow}>
              <View style={styles.inputWithIcon}>
                <TextInput
                  testID="input-email"
                  style={[
                    styles.inputFlex,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                    },
                  ]}
                  placeholder="example@email.com"
                  placeholderTextColor={Colors.light.tabIconDefault}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={(text) => { setEmail(text); setEmailChecked(null); setError(null); setSuccessMessage(null); }}
                  editable={!isLoading}
                />
                {emailChecked !== null ? (
                  <View style={styles.inputIconRight}>
                    <Icon name={emailChecked ? "checkmark-outline" : "close-outline"} size={20} color={emailChecked ? BrandColors.success : BrandColors.error} />
                  </View>
                ) : null}
              </View>
              <Pressable
                testID="button-check-email"
                style={[styles.checkButton, { backgroundColor: accentColor, opacity: emailChecking ? 0.7 : 1 }]}
                onPress={checkEmailDuplicate}
                disabled={emailChecking || !email}
              >
                {emailChecking ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.checkButtonText}>중복확인</ThemedText>
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>비밀번호 *</ThemedText>
            <View style={styles.inputWithIcon}>
              <TextInput
                testID="input-password"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                placeholder="영문/숫자/특수문자 포함 8자리 이상"
                placeholderTextColor={Colors.light.tabIconDefault}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
              />
              <Pressable style={styles.inputIconRight} onPress={() => setShowPassword(!showPassword)}>
                <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.light.tabIconDefault} />
              </Pressable>
            </View>
            {password.length > 0 ? (
              <View style={styles.validationContainer}>
                <View style={styles.validationRow}>
                  <ValidationBadge valid={passwordValidation.length} label="8자 이상" />
                  <ValidationBadge valid={passwordValidation.letter} label="영문" />
                  <ValidationBadge valid={passwordValidation.number} label="숫자" />
                  <ValidationBadge valid={passwordValidation.special} label="특수문자" />
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>비밀번호 확인 *</ThemedText>
            <View style={styles.inputWithIcon}>
              <TextInput
                testID="input-password-confirm"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                placeholder="비밀번호를 다시 입력해주세요"
                placeholderTextColor={Colors.light.tabIconDefault}
                secureTextEntry={!showPasswordConfirm}
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                editable={!isLoading}
              />
              <Pressable style={styles.inputIconRight} onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}>
                <Icon name={showPasswordConfirm ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.light.tabIconDefault} />
              </Pressable>
            </View>
            {passwordConfirm.length > 0 ? (
              <ThemedText style={[styles.validationText, { color: passwordsMatch ? BrandColors.success : BrandColors.error }]}>
                {passwordsMatch ? '비밀번호가 일치합니다' : '비밀번호가 일치하지 않습니다'}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>이름 *</ThemedText>
            <TextInput
              testID="input-name"
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              placeholder="이름을 입력하세요"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={name}
              onChangeText={setName}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>주소</ThemedText>
            <AddressInput
              value={address}
              onChangeAddress={setAddress}
              placeholder="주소를 검색하세요"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>상세주소</ThemedText>
            <TextInput
              testID="input-address-detail"
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              placeholder="상세주소 (동/호수 등)"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={addressDetail}
              onChangeText={setAddressDetail}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.labelRow}>
              <ThemedText style={[styles.label, { color: theme.text }]}>휴대폰 번호 *</ThemedText>
              {isPhoneVerified ? (
                <View style={styles.verifiedBadge}>
                  <Icon name="checkmark-circle-outline" size={14} color={BrandColors.success} />
                  <ThemedText style={styles.verifiedText}>인증완료</ThemedText>
                </View>
              ) : null}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                testID="input-phone"
                style={[
                  styles.inputFlex,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                placeholder="010-0000-0000"
                placeholderTextColor={Colors.light.tabIconDefault}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                editable={!isLoading && !isPhoneVerified}
              />
              <Pressable
                testID="button-send-code"
                style={[styles.checkButton, { backgroundColor: accentColor, opacity: isSendingCode || isPhoneVerified ? 0.7 : 1 }]}
                onPress={handleSendVerificationCode}
                disabled={isSendingCode || isPhoneVerified}
              >
                {isSendingCode ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.checkButtonText}>
                    {isPhoneVerified ? '완료' : '인증요청'}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>

          {showVerificationInput && !isPhoneVerified ? (
            <View style={styles.inputContainer}>
              <ThemedText style={[styles.label, { color: theme.text }]}>인증번호</ThemedText>
              <View style={styles.inputRow}>
                <TextInput
                  testID="input-verification-code"
                  style={[
                    styles.inputFlex,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                    },
                  ]}
                  placeholder="6자리 인증번호"
                  placeholderTextColor={Colors.light.tabIconDefault}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  editable={!isLoading && !isPhoneVerified}
                />
                <Pressable
                  testID="button-verify-code"
                  style={[styles.checkButton, { backgroundColor: accentColor, opacity: isVerifyingCode ? 0.7 : 1 }]}
                  onPress={handleVerifyCode}
                  disabled={isVerifyingCode || isPhoneVerified}
                >
                  {isVerifyingCode ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <ThemedText style={styles.checkButtonText}>확인</ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.agreementsContainer}>
            <ThemedText style={[styles.agreementsTitle, { color: theme.text }]}>
              {selectedRole === 'requester' ? '의뢰자 필수 동의 사항' : '헬퍼(기사) 필수 동의 사항'}
            </ThemedText>
            
            <Pressable style={styles.agreementRow} onPress={() => handleAllAgreement(!agreements.all)}>
              <CheckBox checked={agreements.all} accentColor={accentColor} />
              <ThemedText style={[styles.agreementText, { color: theme.text, fontWeight: '600' }]}>
                전체 동의
              </ThemedText>
            </Pressable>

            <View style={[styles.agreementDivider, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]} />

            <View style={styles.agreementRow}>
              <Pressable style={styles.agreementCheckArea} onPress={() => handleSingleAgreement('terms', !agreements.terms)}>
                <CheckBox checked={agreements.terms} accentColor={accentColor} />
                <ThemedText style={[styles.agreementText, { color: theme.text }]}>
                  {selectedRole === 'requester' 
                    ? '[필수] 서비스 이용약관 동의' 
                    : '[필수] 서비스 성격 및 중개 구조 동의'}
                </ThemedText>
              </Pressable>
              <Pressable style={styles.termDetailButton} onPress={() => openTermModal('terms')}>
                <ThemedText style={[styles.termDetailText, { color: accentColor }]}>보기</ThemedText>
              </Pressable>
            </View>

            <View style={styles.agreementRow}>
              <Pressable style={styles.agreementCheckArea} onPress={() => handleSingleAgreement('liability', !agreements.liability)}>
                <CheckBox checked={agreements.liability} accentColor={accentColor} />
                <ThemedText style={[styles.agreementText, { color: theme.text }]}>
                  {selectedRole === 'requester' 
                    ? '[필수] 책임 제한 및 면책 동의' 
                    : '[필수] 운송 책임 및 손해 배상 책임 동의'}
                </ThemedText>
              </Pressable>
              <Pressable style={styles.termDetailButton} onPress={() => openTermModal('liability')}>
                <ThemedText style={[styles.termDetailText, { color: accentColor }]}>보기</ThemedText>
              </Pressable>
            </View>

            <View style={styles.agreementRow}>
              <Pressable style={styles.agreementCheckArea} onPress={() => handleSingleAgreement('privacy', !agreements.privacy)}>
                <CheckBox checked={agreements.privacy} accentColor={accentColor} />
                <ThemedText style={[styles.agreementText, { color: theme.text }]}>
                  [필수] 개인정보 수집·이용 동의
                </ThemedText>
              </Pressable>
              <Pressable 
                style={styles.termDetailButton} 
                onPress={() => openTermModal('privacy')}
              >
                <ThemedText style={[styles.termDetailText, { color: accentColor }]}>보기</ThemedText>
              </Pressable>
            </View>

            <View style={styles.agreementRow}>
              <Pressable style={styles.agreementCheckArea} onPress={() => handleSingleAgreement('location', !agreements.location)}>
                <CheckBox checked={agreements.location} accentColor={accentColor} />
                <ThemedText style={[styles.agreementText, { color: theme.text }]}>
                  [필수] 위치정보 수집·이용 동의
                </ThemedText>
              </Pressable>
              <Pressable style={styles.termDetailButton} onPress={() => openTermModal('location')}>
                <ThemedText style={[styles.termDetailText, { color: accentColor }]}>보기</ThemedText>
              </Pressable>
            </View>

            <View style={styles.agreementRow}>
              <Pressable style={styles.agreementCheckArea} onPress={() => handleSingleAgreement('payment', !agreements.payment)}>
                <CheckBox checked={agreements.payment} accentColor={accentColor} />
                <ThemedText style={[styles.agreementText, { color: theme.text }]}>
                  [필수] 결제·정산 정책 동의
                </ThemedText>
              </Pressable>
              <Pressable style={styles.termDetailButton} onPress={() => openTermModal('payment')}>
                <ThemedText style={[styles.termDetailText, { color: accentColor }]}>보기</ThemedText>
              </Pressable>
            </View>

            <View style={styles.agreementRow}>
              <Pressable style={styles.agreementCheckArea} onPress={() => handleSingleAgreement('electronic', !agreements.electronic)}>
                <CheckBox checked={agreements.electronic} accentColor={accentColor} />
                <ThemedText style={[styles.agreementText, { color: theme.text }]}>
                  [필수] 전자계약 및 고지 수단 동의
                </ThemedText>
              </Pressable>
              <Pressable style={styles.termDetailButton} onPress={() => openTermModal('electronic')}>
                <ThemedText style={[styles.termDetailText, { color: accentColor }]}>보기</ThemedText>
              </Pressable>
            </View>

            {/* 헬퍼 전용 필수 동의 항목 */}
            {selectedRole === 'helper' && (
              <>
                <View style={[styles.agreementRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border }]}>
                  <Pressable style={styles.agreementCheckArea} onPress={() => handleSingleAgreement('industrialAccidentInsurance', !agreements.industrialAccidentInsurance)}>
                    <CheckBox checked={agreements.industrialAccidentInsurance} accentColor={accentColor} />
                    <ThemedText style={[styles.agreementText, { color: theme.text }]}>
                      [필수] 산재보험 안내 확인 및 보험료 원천공제 동의
                    </ThemedText>
                  </Pressable>
                  <Pressable style={styles.termDetailButton} onPress={() => openTermModal('industrialAccidentInsurance')}>
                    <ThemedText style={[styles.termDetailText, { color: accentColor }]}>보기</ThemedText>
                  </Pressable>
                </View>

                <View style={styles.agreementRow}>
                  <Pressable style={styles.agreementCheckArea} onPress={() => handleSingleAgreement('cargoInsurance', !agreements.cargoInsurance)}>
                    <CheckBox checked={agreements.cargoInsurance} accentColor={accentColor} />
                    <ThemedText style={[styles.agreementText, { color: theme.text }]}>
                      [필수] 적재물배상책임보험 안내 확인
                    </ThemedText>
                  </Pressable>
                  <Pressable style={styles.termDetailButton} onPress={() => openTermModal('cargoInsurance')}>
                    <ThemedText style={[styles.termDetailText, { color: accentColor }]}>보기</ThemedText>
                  </Pressable>
                </View>

                <View style={styles.agreementRow}>
                  <Pressable style={styles.agreementCheckArea} onPress={() => handleSingleAgreement('independentContractor', !agreements.independentContractor)}>
                    <CheckBox checked={agreements.independentContractor} accentColor={accentColor} />
                    <ThemedText style={[styles.agreementText, { color: theme.text }]}>
                      [필수] 독립사업자(비고용) 관계 확인
                    </ThemedText>
                  </Pressable>
                  <Pressable style={styles.termDetailButton} onPress={() => openTermModal('independentContractor')}>
                    <ThemedText style={[styles.termDetailText, { color: accentColor }]}>보기</ThemedText>
                  </Pressable>
                </View>
              </>
            )}

            <View style={styles.agreementRow}>
              <Pressable style={styles.agreementCheckArea} onPress={() => handleSingleAgreement('marketing', !agreements.marketing)}>
                <CheckBox checked={agreements.marketing} accentColor={accentColor} />
                <ThemedText style={[styles.agreementText, { color: theme.text }]}>
                  [선택] 마케팅 정보 수신 동의
                </ThemedText>
              </Pressable>
              <Pressable style={styles.termDetailButton} onPress={() => openTermModal('marketing')}>
                <ThemedText style={[styles.termDetailText, { color: accentColor }]}>보기</ThemedText>
              </Pressable>
            </View>
          </View>

          <Pressable
            testID="button-signup"
            style={({ pressed }) => [
              styles.signupButton,
              { 
                backgroundColor: accentColor,
                opacity: pressed ? 0.7 : 1,
              },
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.signupButtonText}>가입하기</ThemedText>
            )}
          </Pressable>
        </View>
        </View>
      </ScrollView>

      <Modal
        visible={termModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTermModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                {selectedTerm?.title}
              </ThemedText>
              <Pressable onPress={() => setTermModalVisible(false)} hitSlop={8}>
                <Icon name="close-outline" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              <ThemedText style={[styles.modalText, { color: theme.text }]}>
                {selectedTerm?.content}
              </ThemedText>
            </ScrollView>
            <Pressable
              style={[styles.modalCloseButton, { backgroundColor: accentColor }]}
              onPress={() => setTermModalVisible(false)}
            >
              <ThemedText style={styles.modalCloseButtonText}>확인</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function CheckBox({ checked, accentColor }: { checked: boolean; accentColor: string }) {
  return (
    <View style={[styles.checkbox, checked && { backgroundColor: accentColor, borderColor: accentColor }]}>
      {checked ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
    </View>
  );
}

function ValidationBadge({ valid, label }: { valid: boolean; label: string }) {
  return (
    <View style={styles.validationBadge}>
      {valid ? <Icon name="checkmark-outline" size={12} color={BrandColors.success} /> : null}
      <ThemedText style={[styles.validationBadgeText, { color: valid ? BrandColors.success : Colors.light.tabIconDefault }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 480,
  },
  backButton: {
    marginBottom: Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  logo: {
    width: 300,
    height: 100,
  },
  logoContainerSmall: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoSmall: {
    width: 200,
    height: 70,
  },
  stepTitle: {
    ...Typography.h2,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stepSubtitle: {
    ...Typography.body,
    marginBottom: Spacing['2xl'],
    textAlign: 'center',
  },
  formTitle: {
    ...Typography.h3,
    marginBottom: Spacing.lg,
  },
  roleCards: {
    gap: Spacing.lg,
  },
  roleCard: {
    padding: Spacing['2xl'],
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
  },
  roleIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  roleTitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  roleDescription: {
    ...Typography.body,
    textAlign: 'center',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing['2xl'],
    gap: Spacing.xs,
  },
  loginText: {
    ...Typography.body,
  },
  loginLink: {
    ...Typography.body,
    color: BrandColors.primary,
    fontWeight: '600',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  roleBadgeText: {
    ...Typography.small,
    fontWeight: '600',
  },
  formContainer: {
    marginTop: Spacing.sm,
  },
  errorContainer: {
    backgroundColor: BrandColors.errorLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: BrandColors.error,
    ...Typography.small,
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: BrandColors.successLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.md,
  },
  successText: {
    color: BrandColors.success,
    ...Typography.small,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    ...Typography.body,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  inputFlex: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    ...Typography.body,
  },
  inputWithIcon: {
    position: 'relative',
  },
  inputIconRight: {
    position: 'absolute',
    right: Spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  checkButton: {
    paddingHorizontal: Spacing.lg,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  checkButtonText: {
    color: '#FFFFFF',
    ...Typography.small,
    fontWeight: '600',
  },
  validationContainer: {
    marginTop: Spacing.xs,
  },
  validationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  validationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  validationBadgeText: {
    ...Typography.small,
    fontSize: 12,
  },
  validationText: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  verifiedText: {
    ...Typography.small,
    color: BrandColors.success,
  },
  agreementsContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  agreementsTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  agreementText: {
    ...Typography.body,
    flex: 1,
  },
  agreementDivider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  signupButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
  agreementCheckArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.sm,
  },
  termDetailButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  termDetailText: {
    ...Typography.small,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: '70%',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    ...Typography.h3,
    flex: 1,
  },
  modalBody: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    flexGrow: 1,
    maxHeight: '100%',
  },
  modalText: {
    ...Typography.body,
    lineHeight: 24,
  },
  modalCloseButton: {
    marginHorizontal: Spacing.xl,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
});
