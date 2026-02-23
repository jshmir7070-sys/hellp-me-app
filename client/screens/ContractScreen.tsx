import React, { useState, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator, TextInput, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeTabBarHeight } from "@/hooks/useSafeTabBarHeight";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useTheme } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuth } from '@/contexts/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { SignaturePad } from '@/components/SignaturePad';
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from '@/constants/theme';
import { apiRequest } from '@/lib/query-client';
import { formatOrderNumber } from '@/lib/format-order-number';

type ContractScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route?: {
    params?: {
      contractId?: string;
      orderId?: string;
    };
  };
};

interface Contract {
  id: number;
  orderId: number;
  helperId: number;
  requesterId: number;
  status: string;
  dailyRate: number;
  depositAmount: number;
  balanceAmount: number;
  startDate: string;
  endDate: string;
  workHours: string;
  terms: string;
  helperSignedAt?: string;
  requesterSignedAt?: string;
  helperSignature?: string;
  requesterSignature?: string;
  orderTitle?: string;
  helperName?: string;
  requesterName?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
}

export default function ContractScreen({ navigation, route }: ContractScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useSafeTabBarHeight();
  const { theme, isDark } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const contractId = route?.params?.contractId || '';
  const orderId = route?.params?.orderId || '';
  const userRole = user?.role === 'requester' ? 'requester' : 'helper';

  const [signature, setSignature] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);

  const { data: contract, isLoading, error } = useQuery<Contract>({
    queryKey: [`/api/contracts/${contractId}`],
    enabled: !!contractId,
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/contracts/${contractId}/sign`, {
        signature,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] });

      if (Platform.OS !== 'web') {
        Alert.alert('서명 완료', '계약서 서명이 완료되었습니다.', [
          { text: '확인', onPress: () => navigation.goBack() }
        ]);
      } else {
        navigation.goBack();
      }
    },
    onError: (err: Error) => {
      const message = err.message || '서명에 실패했습니다.';
      if (Platform.OS !== 'web') {
        Alert.alert('오류', message);
      } else {
        alert(message);
      }
    },
  });

  const formatCurrency = (amount?: number) => {
    if (!amount) return '0원';
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  // 약관 텍스트를 조항별로 파싱하여 구조화된 렌더링
  const renderFormattedTerms = (termsText: string) => {
    // 줄단위로 분리
    const lines = termsText.split('\n');
    const elements: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        // 빈 줄 → 간격
        elements.push(<View key={`sp-${idx}`} style={{ height: Spacing.sm }} />);
        return;
      }

      // 제N조 (제목) — 볼드 + 강조색
      if (/^제\d+조/.test(trimmed)) {
        elements.push(
          <View key={`h-${idx}`} style={[fmtStyles.articleHeader, { borderLeftColor: brandColor }]}>
            <ThemedText style={[fmtStyles.articleTitle, { color: theme.text }]}>
              {trimmed}
            </ThemedText>
          </View>
        );
        return;
      }

      // ▪ 불릿 항목
      if (trimmed.startsWith('▪') || trimmed.startsWith('•') || trimmed.startsWith('■')) {
        elements.push(
          <View key={`b-${idx}`} style={fmtStyles.bulletRow}>
            <ThemedText style={[fmtStyles.bulletMark, { color: brandColor }]}>
              {trimmed.charAt(0)}
            </ThemedText>
            <ThemedText style={[fmtStyles.bulletText, { color: theme.text }]}>
              {trimmed.slice(1).trim()}
            </ThemedText>
          </View>
        );
        return;
      }

      // 숫자. 또는 숫자) 리스트 항목
      if (/^\d+[.)]\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+[.)]\s?)(.*)/);
        if (match) {
          elements.push(
            <View key={`n-${idx}`} style={fmtStyles.numberedRow}>
              <ThemedText style={[fmtStyles.numberMark, { color: theme.tabIconDefault }]}>
                {match[1].trim()}
              </ThemedText>
              <ThemedText style={[fmtStyles.numberedText, { color: theme.text }]}>
                {match[2]}
              </ThemedText>
            </View>
          );
          return;
        }
      }

      // - 대시 리스트
      if (trimmed.startsWith('- ') || trimmed.startsWith('– ')) {
        elements.push(
          <View key={`d-${idx}`} style={fmtStyles.dashRow}>
            <ThemedText style={[fmtStyles.dashMark, { color: theme.tabIconDefault }]}>–</ThemedText>
            <ThemedText style={[fmtStyles.dashText, { color: theme.text }]}>
              {trimmed.slice(2).trim()}
            </ThemedText>
          </View>
        );
        return;
      }

      // ※ 참고사항
      if (trimmed.startsWith('※')) {
        elements.push(
          <View key={`note-${idx}`} style={[fmtStyles.noteBox, { backgroundColor: isDark ? '#2d3748' : '#FEF3C7' }]}>
            <ThemedText style={[fmtStyles.noteText, { color: isDark ? '#FCD34D' : '#92400E' }]}>
              {trimmed}
            </ThemedText>
          </View>
        );
        return;
      }

      // 일반 텍스트
      elements.push(
        <ThemedText key={`t-${idx}`} style={[fmtStyles.normalText, { color: theme.text }]}>
          {trimmed}
        </ThemedText>
      );
    });

    return elements;
  };

  const handleSign = useCallback(() => {
    if (!isAgreed) {
      if (Platform.OS !== 'web') {
        Alert.alert('알림', '계약 조건에 동의해주세요.');
      }
      return;
    }
    if (!signature.trim()) {
      if (Platform.OS !== 'web') {
        Alert.alert('알림', '서명을 입력해주세요.');
      }
      return;
    }
    signMutation.mutate();
  }, [isAgreed, signature, signMutation]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          계약서를 불러오는 중...
        </ThemedText>
      </View>
    );
  }

  if (error || !contract) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Icon name="alert-circle-outline" size={48} color={BrandColors.error} />
        <ThemedText style={[styles.loadingText, { color: theme.text }]}>
          계약서를 찾을 수 없습니다
        </ThemedText>
        <Pressable
          style={[styles.backButton, { backgroundColor: BrandColors.helper }]}
          onPress={() => navigation.goBack()}
        >
          <ThemedText style={styles.backButtonText}>돌아가기</ThemedText>
        </Pressable>
      </View>
    );
  }

  const isSigned = userRole === 'helper' ? !!contract.helperSignedAt : !!contract.requesterSignedAt;
  const brandColor = userRole === 'helper' ? BrandColors.helper : BrandColors.requester;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
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
      >
        <Card style={styles.contractHeader}>
          <View style={[styles.iconContainer, { backgroundColor: userRole === 'helper' ? BrandColors.helperLight : BrandColors.requesterLight }]}>
            <Icon name="document-text-outline" size={32} color={brandColor} />
          </View>
          <ThemedText style={[styles.contractTitle, { color: theme.text }]}>
            헬프미 서비스 계약서
          </ThemedText>
          <ThemedText style={[styles.contractNumber, { color: theme.tabIconDefault }]}>
            계약번호: #{contract.id}
          </ThemedText>
        </Card>

        <Card style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>주문 정보</ThemedText>

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>주문명</ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {contract.orderTitle || formatOrderNumber(contract.orderNumber, contract.orderId)}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>픽업지</ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {contract.pickupAddress || '미정'}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>배송지</ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {contract.deliveryAddress || '미정'}
            </ThemedText>
          </View>
        </Card>

        <Card style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>계약 조건</ThemedText>

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>근무기간</ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {formatDate(contract.startDate)} ~ {formatDate(contract.endDate)}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>근무시간</ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {contract.workHours || '협의'}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>일당</ThemedText>
            <ThemedText style={[styles.infoValue, { color: brandColor }]}>
              {formatCurrency(contract.dailyRate)}
            </ThemedText>
          </View>
        </Card>

        <Card style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>결제 정보</ThemedText>

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>계약금</ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {formatCurrency(contract.depositAmount)}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>잔금</ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {formatCurrency(contract.balanceAmount)}
            </ThemedText>
          </View>
        </Card>

        <Card style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>계약자 정보</ThemedText>

          <View style={styles.partyRow}>
            <View style={styles.partyInfo}>
              <ThemedText style={[styles.partyLabel, { color: theme.tabIconDefault }]}>요청자</ThemedText>
              <ThemedText style={[styles.partyName, { color: theme.text }]}>
                {contract.requesterName || '비공개'}
              </ThemedText>
              {contract.requesterSignedAt ? (
                <>
                  <View style={[styles.signedBadge, { backgroundColor: BrandColors.successLight }]}>
                    <Icon name="checkmark-outline" size={12} color={BrandColors.success} />
                    <ThemedText style={[styles.signedText, { color: BrandColors.success }]}>서명완료</ThemedText>
                  </View>
                  {contract.requesterSignature ? (
                    <Image
                      source={{ uri: contract.requesterSignature }}
                      style={styles.signatureImage}
                      resizeMode="contain"
                    />
                  ) : null}
                </>
              ) : (
                <View style={[styles.signedBadge, { backgroundColor: Colors.light.backgroundSecondary }]}>
                  <ThemedText style={[styles.signedText, { color: theme.tabIconDefault }]}>서명대기</ThemedText>
                </View>
              )}
            </View>

            <View style={styles.partyInfo}>
              <ThemedText style={[styles.partyLabel, { color: theme.tabIconDefault }]}>헬퍼</ThemedText>
              <ThemedText style={[styles.partyName, { color: theme.text }]}>
                {contract.helperName || '비공개'}
              </ThemedText>
              {contract.helperSignedAt ? (
                <>
                  <View style={[styles.signedBadge, { backgroundColor: BrandColors.successLight }]}>
                    <Icon name="checkmark-outline" size={12} color={BrandColors.success} />
                    <ThemedText style={[styles.signedText, { color: BrandColors.success }]}>서명완료</ThemedText>
                  </View>
                  {contract.helperSignature ? (
                    <Image
                      source={{ uri: contract.helperSignature }}
                      style={styles.signatureImage}
                      resizeMode="contain"
                    />
                  ) : null}
                </>
              ) : (
                <View style={[styles.signedBadge, { backgroundColor: Colors.light.backgroundSecondary }]}>
                  <ThemedText style={[styles.signedText, { color: theme.tabIconDefault }]}>서명대기</ThemedText>
                </View>
              )}
            </View>
          </View>
        </Card>

        {contract.terms ? (
          <Card style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>약관</ThemedText>
            <View style={fmtStyles.termsContainer}>
              {renderFormattedTerms(contract.terms)}
            </View>
          </Card>
        ) : null}

        {!isSigned ? (
          <Card style={styles.signSection}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>계약 서명</ThemedText>

            <Pressable
              style={styles.agreeRow}
              onPress={() => setIsAgreed(!isAgreed)}
            >
              <View style={[
                styles.checkbox,
                { borderColor: isAgreed ? brandColor : theme.tabIconDefault }
              ]}>
                {isAgreed ? <Icon name="checkmark-outline" size={16} color={brandColor} /> : null}
              </View>
              <ThemedText style={[styles.agreeText, { color: theme.text }]}>
                위 계약 내용을 모두 확인하였으며, 계약 조건에 동의합니다.
              </ThemedText>
            </Pressable>

            <View style={styles.signatureInput}>
              <ThemedText style={[styles.signatureLabel, { color: theme.tabIconDefault }]}>서명</ThemedText>
              <SignaturePad
                onSignatureChange={(hasSignature, data) => setSignature(data || '')}
                primaryColor={brandColor}
                width={300}
                height={150}
                fullScreenMode={false}
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {!isSigned ? (
        <View style={[styles.footer, { paddingBottom: tabBarHeight + Spacing.md, backgroundColor: theme.backgroundRoot }]}>
          <Pressable
            style={({ pressed }) => [
              styles.signButton,
              { backgroundColor: brandColor, opacity: pressed || !isAgreed || !signature ? 0.7 : 1 },
            ]}
            onPress={handleSign}
            disabled={signMutation.isPending || !isAgreed || !signature}
          >
            {signMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Icon name="create-outline" size={20} color="#FFFFFF" />
                <ThemedText style={styles.signButtonText}>계약서 서명하기</ThemedText>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
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
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.lg,
  },
  backButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  backButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
  contractHeader: {
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  contractTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  contractNumber: {
    ...Typography.small,
  },
  section: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    ...Typography.small,
    flex: 1,
  },
  infoValue: {
    ...Typography.body,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  partyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  partyInfo: {
    flex: 1,
    alignItems: 'center',
  },
  partyLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  partyName: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  signedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  signedText: {
    ...Typography.small,
    fontWeight: '500',
  },
  signatureImage: {
    width: 160,
    height: 80,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.sm,
    backgroundColor: '#FFFFFF',
  },
  terms: {
    ...Typography.small,
    lineHeight: 20,
  },
  signSection: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agreeText: {
    ...Typography.body,
    flex: 1,
  },
  signatureInput: {
    gap: Spacing.sm,
  },
  signatureLabel: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  signButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
});

// 약관 텍스트 포맷팅 스타일
const fmtStyles = StyleSheet.create({
  termsContainer: {
    gap: 2,
  },
  articleHeader: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  articleTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: Spacing.sm,
    marginVertical: 2,
  },
  bulletMark: {
    fontSize: 14,
    fontWeight: '700',
    width: 18,
    lineHeight: 20,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  numberedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: Spacing.md,
    marginVertical: 2,
  },
  numberMark: {
    fontSize: 13,
    fontWeight: '600',
    width: 24,
    lineHeight: 20,
  },
  numberedText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  dashRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: Spacing.lg,
    marginVertical: 1,
  },
  dashMark: {
    fontSize: 13,
    width: 16,
    lineHeight: 20,
  },
  dashText: {
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  noteBox: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginVertical: Spacing.xs,
    marginLeft: Spacing.md,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
  },
  normalText: {
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: 1,
  },
});
