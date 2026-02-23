import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert, Platform, Linking, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getToken } from '@/utils/secure-token-storage';
import * as ExpoLinking from 'expo-linking';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { SignaturePad } from '@/components/SignaturePad';
import { useTheme } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuth } from '@/contexts/AuthContext';
import { Spacing, BorderRadius, BrandColors, Colors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';
import {
  HELPER_CONTRACT_TERMS,
  HELPER_CONTRACT_CHECKBOX_KEYS,
  createHelperContractState,
  createHelperContractReadState,
  isAllRequiredAgreed,
  getHelperContractTerms,
  type ContractCheckboxState,
  type ContractReadState,
  type ContractSettings,
} from '@/constants/contracts';

type ContractSigningScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function ContractSigningScreen({ navigation }: ContractSigningScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useSafeTabBarHeight();
  const { theme, isDark } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const { refreshUser } = useAuth();

  // 동적 설정값 기반 계약서 생성
  const [contractSettings, setContractSettings] = useState<Partial<ContractSettings>>({});
  const helperTerms = getHelperContractTerms(contractSettings);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${getApiUrl()}/api/settings/contract-values`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setContractSettings(data);
        }
      } catch {}
    };
    fetchSettings();
  }, []);

  // 계약 개요 읽음 여부
  const [hasReadContract, setHasReadContract] = useState(false);

  // contracts.ts 기반 동의 상태
  const [agreements, setAgreements] = useState<ContractCheckboxState>(() => createHelperContractState());
  const [readState, setReadState] = useState<ContractReadState>(() => createHelperContractReadState());
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [termModalVisible, setTermModalVisible] = useState(false);
  const [termModalContent, setTermModalContent] = useState<{ title: string; content: string } | null>(null);

  // 본인인증 / 서명
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [signatureComplete, setSignatureComplete] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const termItemRefs = useRef<Record<string, number>>({});
  const [verificationId, setVerificationId] = useState<string | null>(null);

  // 필수 전체 동의 여부
  const allRequiredAgreed = isAllRequiredAgreed(agreements, HELPER_CONTRACT_CHECKBOX_KEYS.required);

  // 전체 동의 토글
  const toggleAll = () => {
    const newVal = !allRequiredAgreed;
    const updated = { ...agreements };
    if (newVal) {
      const readUpdated = { ...readState };
      [...HELPER_CONTRACT_CHECKBOX_KEYS.required, ...HELPER_CONTRACT_CHECKBOX_KEYS.optional]
        .forEach(k => { readUpdated[k] = true; });
      setReadState(readUpdated);
    }
    [...HELPER_CONTRACT_CHECKBOX_KEYS.required, ...HELPER_CONTRACT_CHECKBOX_KEYS.optional]
      .forEach(k => { updated[k] = newVal; });
    setAgreements(updated);
  };

  // 본인인증 딥링크 콜백 처리
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;
      if (!url) return;

      try {
        const parsed = ExpoLinking.parse(url);
        const { queryParams, path } = parsed;

        if (path?.includes('verify') && queryParams?.status === 'success' && queryParams?.identityVerificationId) {
          setIsVerifying(true);
          const vid = queryParams.identityVerificationId as string;

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

      // 테스트 모드
      if (data.testMode) {
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

      // PortOne SDK 연동
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

  const canSubmit = () => {
    return hasReadContract && allRequiredAgreed && phoneVerified && signatureComplete;
  };

  const executeSubmit = async () => {
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
            signatureData: signatureData,
            agreedTerms: agreements,
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

  const handleSubmit = () => {
    if (!canSubmit()) return;

    if (Platform.OS === 'web') {
      if (confirm('계약서를 제출하시겠습니까? 제출 후에는 수정이 불가합니다.')) {
        executeSubmit();
      }
    } else {
      Alert.alert(
        '계약 체결 확인',
        '계약서를 제출하시겠습니까?\n제출 후에는 수정이 불가합니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '제출하기', onPress: () => executeSubmit() },
        ]
      );
    }
  };

  // 개별 항목 렌더링
  const renderTermItem = (key: string, term: { title: string; content: string; required?: boolean }, brandColor: string) => {
    const isRead = readState[key];
    const isAgreed = agreements[key];
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
            borderColor: isAgreed ? brandColor : (isDark ? '#4A5568' : '#E0E0E0'),
            backgroundColor: isAgreed ? (isDark ? '#1a2e1a' : '#F0FFF4') : 'transparent',
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
            color={brandColor}
          />
          <ThemedText style={[styles.termTitle, { color: theme.text, flex: 1 }]}>
            {term.title}
          </ThemedText>
          {isRead && !isAgreed && (
            <View style={[styles.readBadgeSmall, { backgroundColor: isDark ? '#2d3748' : '#FEF3C7' }]}>
              <ThemedText style={{ fontSize: 10, color: '#D97706' }}>열람완료</ThemedText>
            </View>
          )}
          {isAgreed && (
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
          onPress={() => setAgreements(prev => ({ ...prev, [key]: !prev[key] }))}
        >
          <View style={[
            styles.checkbox,
            {
              backgroundColor: isAgreed ? brandColor : 'transparent',
              borderColor: isAgreed ? brandColor : (isRead ? (isDark ? Colors.dark.backgroundSecondary : '#E0E0E0') : '#ccc'),
            },
            !isRead && { opacity: 0.4 },
          ]}>
            {isAgreed ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
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

  return (
    <>
    <ScrollView
      ref={scrollViewRef}
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: showDesktopLayout ? Spacing.xl : tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        ...(showDesktopLayout && {
          maxWidth: containerMaxWidth,
          alignSelf: 'center' as const,
          width: '100%' as any,
        }),
      }}
      showsVerticalScrollIndicator={true}
    >
      <View style={styles.headerSection}>
        <ThemedText style={[styles.mainTitle, { color: theme.text }]}>
          {helperTerms.contractOverview.title}
        </ThemedText>
        <ThemedText style={[styles.mainSubtitle, { color: theme.tabIconDefault }]}>
          본 계약은 가입 시 1회 체결되며, 모든 오더에 공통 적용됩니다
        </ThemedText>
      </View>

      {/* 1. 계약서 개요 */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>1. 계약서 개요</ThemedText>
        <Pressable
          style={styles.contractCard}
          onPress={() => {
            setTermModalContent({
              title: helperTerms.contractOverview.title,
              content: helperTerms.contractOverview.content,
            });
            setTermModalVisible(true);
            setHasReadContract(true);
          }}
        >
          <View style={styles.contractPreview}>
            <ThemedText style={[styles.contractText, { color: theme.text }]} numberOfLines={4}>
              {helperTerms.contractOverview.content}
            </ThemedText>
            <View style={styles.contractFade} />
          </View>
          <View style={styles.contractOpenRow}>
            {hasReadContract ? (
              <View style={[styles.readBadge, { backgroundColor: BrandColors.successLight }]}>
                <Icon name="checkmark-outline" size={14} color={BrandColors.success} />
                <ThemedText style={{ color: BrandColors.success, fontSize: 12, marginLeft: 4 }}>읽음 완료</ThemedText>
              </View>
            ) : (
              <View style={[styles.readBadge, { backgroundColor: BrandColors.warningLight }]}>
                <Icon name="alert-circle-outline" size={14} color={BrandColors.warning} />
                <ThemedText style={{ color: BrandColors.warning, fontSize: 12, marginLeft: 4 }}>터치하여 전체 내용 보기</ThemedText>
              </View>
            )}
            <Icon name="open-outline" size={18} color={BrandColors.helper} />
          </View>
        </Pressable>
      </View>

      {/* 2. 약관 동의 (필수) */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>2. 약관 동의</ThemedText>

        {/* 전체 동의 */}
        <Pressable
          style={styles.checkboxRow}
          onPress={toggleAll}
        >
          <View style={[
            styles.checkbox,
            {
              backgroundColor: allRequiredAgreed ? BrandColors.helper : 'transparent',
              borderColor: allRequiredAgreed ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : '#E0E0E0'),
            }
          ]}>
            {allRequiredAgreed ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
          </View>
          <ThemedText style={[styles.checkboxLabel, { color: theme.text, fontWeight: '600' }]}>
            필수 항목 전체 동의
          </ThemedText>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]} />

        {/* 필수 항목 (15개) */}
        {HELPER_CONTRACT_CHECKBOX_KEYS.required.map((key) => {
          const term = helperTerms[key];
          return renderTermItem(key, term, BrandColors.helper);
        })}

        {/* 선택 항목 */}
        <View style={[styles.divider, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0', marginTop: Spacing.md }]} />

        <ThemedText style={[styles.optionalTitle, { color: theme.tabIconDefault }]}>
          선택 항목
        </ThemedText>

        {HELPER_CONTRACT_CHECKBOX_KEYS.optional.map((key) => {
          const term = helperTerms[key];
          return renderTermItem(key, term, BrandColors.helper);
        })}
      </View>

      {/* 3. 본인인증 */}
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

      {/* 4. 전자서명 */}
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
          {!allRequiredAgreed || !phoneVerified ? (
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
            style={[styles.termModalConfirmBtn, { backgroundColor: BrandColors.helper }]}
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
  headerSection: {
    marginBottom: Spacing.xl,
  },
  mainTitle: {
    fontSize: 22,
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
  contractPreview: {
    maxHeight: 100,
    overflow: 'hidden',
    position: 'relative',
  },
  contractFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  contractOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
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
  readBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
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
  // 본인인증 / 서명
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
