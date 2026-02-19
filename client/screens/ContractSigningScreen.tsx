import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getToken } from '@/utils/secure-token-storage';
import * as ExpoLinking from 'expo-linking';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { SignaturePad } from '@/components/SignaturePad';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Spacing, BorderRadius, BrandColors, Colors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

type ContractSigningScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const CONTRACT_CONTENT = `운송주선 플랫폼 근무(업무수행) 기본계약 및 동의서

본 계약은 헬프미(이하 "회사/플랫폼")가 운영하는 운송주선 서비스에 기사(헬퍼)가 가입하여 업무를 수행함에 있어 기본 조건(업무, 마감자료, 정산, 사고/차감, 직거래 금지 등)에 동의하기 위한 "1회 체결" 전자계약서입니다.
본 계약은 체결일 이후 기사에게 배정/수행되는 모든 오더에 공통 적용됩니다.


제1조 (당사자)

[플랫폼(회사)]
상호: 헬프미
사업자등록번호: (자동 기입)

[기사(헬퍼)]
성명: (자동 기입)
휴대폰: (자동 기입)
차량정보: (자동 기입)


제2조 (계약의 성격)

플랫폼은 요청자(화주)의 운송 의뢰를 접수하여 기사를 배정하는 "운송주선 사업자"입니다.
기사는 플랫폼이 주선한 오더를 수행하는 업무수행자이며, 플랫폼과 고용관계가 아닙니다.


제3조 (업무 수행)

기사는 매칭된 오더에 대해 배송 수행, 반품 처리(해당 시), 업무 요청사항 준수, 안전 운행을 성실히 이행합니다.


제4조 (지원/매칭 및 연락처 제공)

기사 지원 및 매칭 규칙은 플랫폼 정책에 따릅니다.
매칭 완료 시 업무 수행 목적의 요청자 연락처가 제공될 수 있습니다.


제5조 (마감자료 제출)

기사 마감자료 제출은 필수이며, 허위 제출 시 제재 대상입니다.
마감자료는 다음을 포함합니다.
- 최종 수량(배송/반품/기타)
- 기타 비용 및 사유(해당 시)
- 증빙 이미지(배송사 이력 캡처 등)


제6조 (정산)

기사 정산은 플랫폼의 정책에 따라 산정·지급됩니다.
(예시) 기사 정산금 = 최종확정금액 – 플랫폼 수수료 – 차감액(사고/패널티 등)
정산 주기/지급 방식은 플랫폼 정산정책에 따릅니다.


제7조 (사고/차감)

분실/파손/오배송 등 사고 발생 시 플랫폼은 증빙 기준으로 차감·정산 보류·제재를 진행할 수 있습니다.


제8조 (직거래 금지 및 개인정보)

기사는 플랫폼 외 직거래를 유도/수행할 수 없습니다.
기사는 개인정보(연락처 포함)를 업무 목적 외 사용하거나 제3자에게 제공할 수 없습니다.


제9조 (계약기간/해지)

본 계약은 가입/동의 시점부터 효력이 발생하며, 기사가 탈퇴하더라도 미정산/분쟁 건이 있을 경우 처리 완료 후 종료될 수 있습니다.


제10조 (준거법/관할)

본 계약은 대한민국 법령을 따르며, 분쟁 시 플랫폼 소재지 관할 법원을 전속 관할로 합니다.
`;

export default function ContractSigningScreen({ navigation }: ContractSigningScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { refreshUser } = useAuth();

  const [hasReadContract, setHasReadContract] = useState(false);
  const [agreeContract, setAgreeContract] = useState(false);
  const [agreeClosing, setAgreeClosing] = useState(false);
  const [agreeAccident, setAgreeAccident] = useState(false);
  const [agreeNoDirect, setAgreeNoDirect] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [agreePush, setAgreePush] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [signatureComplete, setSignatureComplete] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);

  // 본인인증 딥링크 콜백 처리
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;
      if (!url) return;

      try {
        const parsed = ExpoLinking.parse(url);
        const { queryParams, path } = parsed;

        // hellpme://verify/return?identityVerificationId=xxx&status=success
        if (path?.includes('verify') && queryParams?.status === 'success' && queryParams?.identityVerificationId) {
          setIsVerifying(true);
          const vid = queryParams.identityVerificationId as string;

          // 서버에서 본인인증 검증
          const response = await fetch(
            new URL('/api/auth/verify-identity', getApiUrl()).toString(),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identityVerificationId: vid }),
            }
          );

          if (response.ok) {
            setPhoneVerified(true);
            setVerificationId(vid);
            if (Platform.OS === 'web') {
              alert('본인인증이 완료되었습니다.');
            } else {
              Alert.alert('완료', '본인인증이 완료되었습니다.');
            }
          } else {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || '본인인증 검증 실패');
          }
        } else if (path?.includes('verify') && queryParams?.status === 'cancelled') {
          if (Platform.OS === 'web') {
            alert('본인인증이 취소되었습니다.');
          } else {
            Alert.alert('알림', '본인인증이 취소되었습니다.');
          }
        }
      } catch (error: any) {
        console.error('본인인증 콜백 오류:', error);
        if (Platform.OS === 'web') {
          alert('본인인증에 실패했습니다. 다시 시도해주세요.');
        } else {
          Alert.alert('오류', error.message || '본인인증에 실패했습니다. 다시 시도해주세요.');
        }
      } finally {
        setIsVerifying(false);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  const handleScrollEnd = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    if (isCloseToBottom) {
      setHasReadContract(true);
    }
  };

  const handlePhoneVerification = async () => {
    setIsVerifying(true);
    try {
      // 1. 서버에서 본인인증 ID 생성
      const response = await fetch(
        new URL('/api/auth/create-identity-verification', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        throw new Error('본인인증 준비에 실패했습니다');
      }

      const data = await response.json();

      // 테스트 모드: API 시크릿 미설정 시 바로 성공 처리
      if (data.testMode) {
        // 테스트 모드에서 서버 검증 호출
        const verifyResponse = await fetch(
          new URL('/api/auth/verify-identity', getApiUrl()).toString(),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identityVerificationId: data.identityVerificationId }),
          }
        );

        if (verifyResponse.ok) {
          setPhoneVerified(true);
          setVerificationId(data.identityVerificationId);
          if (Platform.OS === 'web') {
            alert('본인인증이 완료되었습니다. (테스트 모드)');
          } else {
            Alert.alert('완료', '본인인증이 완료되었습니다. (테스트 모드)');
          }
        } else {
          const err = await verifyResponse.json().catch(() => ({}));
          throw new Error(err.message || '본인인증 검증 실패');
        }
        return;
      }

      // 2. 본인인증 웹 페이지 열기 (PortOne SDK 연동)
      const returnUrl = ExpoLinking.createURL('verify/return');
      const baseUrl = getApiUrl();
      const verificationUrl = `${baseUrl}/identity-verification?identityVerificationId=${encodeURIComponent(data.identityVerificationId)}&returnUrl=${encodeURIComponent(returnUrl)}`;

      if (Platform.OS === 'web') {
        window.open(verificationUrl, '_blank');
      } else {
        await Linking.openURL(verificationUrl);
      }
    } catch (error: any) {
      console.error('본인인증 오류:', error);
      if (Platform.OS === 'web') {
        alert(error.message || '본인인증에 실패했습니다. 다시 시도해주세요.');
      } else {
        Alert.alert('오류', error.message || '본인인증에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // handleSignature removed as it is replaced by SignaturePad state management


  const allRequiredAgreed = agreeContract && agreeClosing && agreeAccident && agreeNoDirect && agreePrivacy;

  const canSubmit = () => {
    return hasReadContract && allRequiredAgreed && phoneVerified && signatureComplete;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;

    setIsSubmitting(true);
    try {
      const token = await getToken();

      const response = await fetch(
        new URL('/api/helpers/onboarding/submit', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            contractSigned: true,
            phoneVerified: true,
            identityVerificationId: verificationId,
            signedAt: new Date().toISOString(),
            signatureData: signatureData, // Add signature data
            agreedTerms: {
              contract: agreeContract,
              closing: agreeClosing,
              accident: agreeAccident,
              noDirect: agreeNoDirect,
              privacy: agreePrivacy,
              marketing: agreeMarketing,
              push: agreePush,
            },
          }),
        }
      );

      if (response.ok) {
        if (refreshUser) {
          await refreshUser();
        }

        if (Platform.OS === 'web') {
          alert('계약 체결이 완료되었습니다. 관리자 승인을 기다려주세요.');
          navigation.reset({
            index: 0,
            routes: [{ name: 'Main' }],
          });
        } else {
          Alert.alert(
            '계약 완료',
            '계약 체결이 완료되었습니다.\n관리자 승인 후 오더 신청이 가능합니다.',
            [{
              text: '확인', onPress: () => navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              })
            }]
          );
        }
      } else {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || '제출 실패');
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      if (Platform.OS === 'web') {
        alert('제출 실패: ' + (error.message || '다시 시도해주세요.'));
      } else {
        Alert.alert('제출 실패', error.message || '다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const allAgreed = allRequiredAgreed;

  return (
    <ScrollView
      ref={scrollViewRef}
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: Spacing.lg,
      }}
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.headerSection}>
        <ThemedText style={[styles.mainTitle, { color: theme.text }]}>운송주선 플랫폼 기본계약</ThemedText>
        <ThemedText style={[styles.mainSubtitle, { color: theme.tabIconDefault }]}>
          본 계약은 가입 시 1회 체결되며, 모든 오더에 공통 적용됩니다
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>1. 계약서 내용</ThemedText>
        <Card style={styles.contractCard}>
          <ScrollView
            style={styles.contractScroll}
            onScroll={handleScrollEnd}
            scrollEventThrottle={400}
            nestedScrollEnabled={true}
          >
            <ThemedText style={[styles.contractText, { color: theme.text }]}>
              {CONTRACT_CONTENT}
            </ThemedText>
          </ScrollView>
          {hasReadContract ? (
            <View style={[styles.readBadge, { backgroundColor: BrandColors.successLight }]}>
              <Icon name="checkmark-outline" size={14} color={BrandColors.success} />
              <ThemedText style={{ color: BrandColors.success, fontSize: 12, marginLeft: 4 }}>읽음 완료</ThemedText>
            </View>
          ) : (
            <View style={[styles.readBadge, { backgroundColor: BrandColors.warningLight }]}>
              <Icon name="alert-circle-outline" size={14} color={BrandColors.warning} />
              <ThemedText style={{ color: BrandColors.warning, fontSize: 12, marginLeft: 4 }}>끝까지 스크롤해주세요</ThemedText>
            </View>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>2. 약관 동의</ThemedText>

        <Pressable
          style={styles.checkboxRow}
          onPress={() => {
            const newValue = !allAgreed;
            setAgreeContract(newValue);
            setAgreeClosing(newValue);
            setAgreeAccident(newValue);
            setAgreeNoDirect(newValue);
            setAgreePrivacy(newValue);
          }}
        >
          <View style={[
            styles.checkbox,
            {
              backgroundColor: allAgreed ? BrandColors.helper : 'transparent',
              borderColor: allAgreed ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : '#E0E0E0'),
            }
          ]}>
            {allAgreed ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
          </View>
          <ThemedText style={[styles.checkboxLabel, { color: theme.text, fontWeight: '600' }]}>
            필수 항목 전체 동의
          </ThemedText>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]} />

        <Pressable style={styles.checkboxRow} onPress={() => setAgreeContract(!agreeContract)}>
          <View style={[
            styles.checkbox,
            {
              backgroundColor: agreeContract ? BrandColors.helper : 'transparent',
              borderColor: agreeContract ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : '#E0E0E0'),
            }
          ]}>
            {agreeContract ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
          </View>
          <View style={styles.checkboxContent}>
            <ThemedText style={[styles.checkboxLabel, { color: theme.text }]}>
              (필수) 본인은 본 계약서 전문을 확인하였고, 핵심사항에 동의합니다
            </ThemedText>
            <ThemedText style={[styles.checkboxHint, { color: theme.tabIconDefault }]}>
              플랫폼은 운송주선 사업자이며, 기사는 독립 업무수행자입니다
            </ThemedText>
          </View>
        </Pressable>

        <Pressable style={styles.checkboxRow} onPress={() => setAgreeClosing(!agreeClosing)}>
          <View style={[
            styles.checkbox,
            {
              backgroundColor: agreeClosing ? BrandColors.helper : 'transparent',
              borderColor: agreeClosing ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : '#E0E0E0'),
            }
          ]}>
            {agreeClosing ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
          </View>
          <View style={styles.checkboxContent}>
            <ThemedText style={[styles.checkboxLabel, { color: theme.text }]}>
              (필수) 마감자료 제출이 잔금 산정 및 정산의 기준임에 동의합니다
            </ThemedText>
            <ThemedText style={[styles.checkboxHint, { color: theme.tabIconDefault }]}>
              배송/반품/기타 수량 입력, 증빙 이미지 업로드 필수
            </ThemedText>
          </View>
        </Pressable>

        <Pressable style={styles.checkboxRow} onPress={() => setAgreeAccident(!agreeAccident)}>
          <View style={[
            styles.checkbox,
            {
              backgroundColor: agreeAccident ? BrandColors.helper : 'transparent',
              borderColor: agreeAccident ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : '#E0E0E0'),
            }
          ]}>
            {agreeAccident ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
          </View>
          <View style={styles.checkboxContent}>
            <ThemedText style={[styles.checkboxLabel, { color: theme.text }]}>
              (필수) 사고 발생 시 정산 차감/보류가 발생할 수 있음에 동의합니다
            </ThemedText>
            <ThemedText style={[styles.checkboxHint, { color: theme.tabIconDefault }]}>
              분실/파손/오배송 등 사고 시 플랫폼 정책에 따름
            </ThemedText>
          </View>
        </Pressable>

        <Pressable style={styles.checkboxRow} onPress={() => setAgreeNoDirect(!agreeNoDirect)}>
          <View style={[
            styles.checkbox,
            {
              backgroundColor: agreeNoDirect ? BrandColors.helper : 'transparent',
              borderColor: agreeNoDirect ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : '#E0E0E0'),
            }
          ]}>
            {agreeNoDirect ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
          </View>
          <View style={styles.checkboxContent}>
            <ThemedText style={[styles.checkboxLabel, { color: theme.text }]}>
              (필수) 직거래 금지 및 위반 시 제재에 동의합니다
            </ThemedText>
            <ThemedText style={[styles.checkboxHint, { color: theme.tabIconDefault }]}>
              플랫폼 외 직거래 유도/수행 시 계정정지, 정산보류, 손해배상 등
            </ThemedText>
          </View>
        </Pressable>

        <Pressable style={styles.checkboxRow} onPress={() => setAgreePrivacy(!agreePrivacy)}>
          <View style={[
            styles.checkbox,
            {
              backgroundColor: agreePrivacy ? BrandColors.helper : 'transparent',
              borderColor: agreePrivacy ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : '#E0E0E0'),
            }
          ]}>
            {agreePrivacy ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
          </View>
          <View style={styles.checkboxContent}>
            <ThemedText style={[styles.checkboxLabel, { color: theme.text }]}>
              (필수) 개인정보를 업무 목적 외 사용하지 않음에 동의합니다
            </ThemedText>
            <ThemedText style={[styles.checkboxHint, { color: theme.tabIconDefault }]}>
              요청자 연락처/개인정보 보호 의무, 위반 시 법적 책임
            </ThemedText>
          </View>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0', marginTop: Spacing.md }]} />

        <ThemedText style={[styles.optionalTitle, { color: theme.tabIconDefault }]}>
          선택 항목
        </ThemedText>

        <Pressable style={styles.checkboxRow} onPress={() => setAgreeMarketing(!agreeMarketing)}>
          <View style={[
            styles.checkbox,
            {
              backgroundColor: agreeMarketing ? BrandColors.helper : 'transparent',
              borderColor: agreeMarketing ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : '#E0E0E0'),
            }
          ]}>
            {agreeMarketing ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
          </View>
          <ThemedText style={[styles.checkboxLabel, { color: theme.text }]}>
            (선택) 마케팅/혜택 안내 수신 동의
          </ThemedText>
        </Pressable>

        <Pressable style={styles.checkboxRow} onPress={() => setAgreePush(!agreePush)}>
          <View style={[
            styles.checkbox,
            {
              backgroundColor: agreePush ? BrandColors.helper : 'transparent',
              borderColor: agreePush ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : '#E0E0E0'),
            }
          ]}>
            {agreePush ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
          </View>
          <ThemedText style={[styles.checkboxLabel, { color: theme.text }]}>
            (선택) 푸시 알림 수신 동의
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>3. 본인인증</ThemedText>

        <Card style={styles.verificationCard}>
          <Pressable
            style={[
              styles.verificationButton,
              {
                backgroundColor: phoneVerified ? BrandColors.successLight : theme.backgroundDefault,
                borderColor: phoneVerified ? BrandColors.success : BrandColors.helper,
              }
            ]}
            onPress={handlePhoneVerification}
            disabled={phoneVerified || isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator size="small" color={BrandColors.helper} />
            ) : (
              <Icon
                name={phoneVerified ? "checkmark-circle-outline" : "cellphone"}
                size={24}
                color={phoneVerified ? BrandColors.success : BrandColors.helper}
              />
            )}
            <View style={styles.verificationInfo}>
              <ThemedText style={[styles.verificationTitle, { color: phoneVerified ? BrandColors.success : theme.text }]}>
                휴대폰 본인인증
              </ThemedText>
              <ThemedText style={[styles.verificationDesc, { color: theme.tabIconDefault }]}>
                {phoneVerified ? '인증 완료' : '본인 명의 휴대폰으로 인증'}
              </ThemedText>
            </View>
          </Pressable>
        </Card>
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>4. 전자서명</ThemedText>

        <Card style={styles.verificationCard}>
          <SignaturePad
            onSignatureChange={(hasSignature, data) => {
              setSignatureComplete(hasSignature);
              setSignatureData(data);
            }}
            primaryColor={BrandColors.helper}
            fullScreenMode={true}
          />
          {!signatureComplete && (
            <View style={styles.verificationInfo}>
              <ThemedText style={[styles.verificationDesc, { color: theme.tabIconDefault, marginTop: Spacing.sm }]}>
                위 버튼을 눌러 서명을 진행해주세요
              </ThemedText>
            </View>
          )}
          {!allAgreed || !phoneVerified ? (
            <ThemedText style={[styles.disabledNote, { color: theme.tabIconDefault }]}>
              약관 동의 및 본인인증 완료 후 서명 가능합니다
            </ThemedText>
          ) : null}
        </Card>
      </View>

      {/* 제출 버튼 */}
      <Pressable
        style={[
          styles.submitButton,
          {
            backgroundColor: canSubmit() ? BrandColors.helper : '#9CA3AF',
            opacity: isSubmitting ? 0.7 : 1,
          }
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting || !canSubmit()}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Icon name="document-text-outline" size={20} color="#FFFFFF" />
            <ThemedText style={styles.submitButtonText}>계약 체결 완료</ThemedText>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerSection: {
    marginBottom: Spacing.xl,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  mainSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  contractCard: {
    padding: Spacing.md,
    position: 'relative',
  },
  contractScroll: {
    maxHeight: 300,
  },
  contractText: {
    fontSize: 13,
    lineHeight: 20,
  },
  readBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  checkboxLabel: {
    fontSize: 14,
    flex: 1,
  },
  checkboxContent: {
    flex: 1,
  },
  checkboxHint: {
    fontSize: 12,
    marginTop: 2,
  },
  optionalTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  verificationCard: {
    padding: Spacing.md,
  },
  verificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  verificationInfo: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  verificationDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  disabledNote: {
    fontSize: 12,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
