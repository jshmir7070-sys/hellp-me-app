import React from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, BrandColors } from '@/constants/theme';

type PartnerRegistrationScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface RequesterBusiness {
  businessNumber?: string;
  businessName?: string;
  bankName?: string;
  accountNumber?: string;
}

const MENU_ITEMS = [
  {
    key: 'business',
    title: '사업자정보 등록',
    description: '세금계산서 발행을 위한 사업자 정보',
    icon: 'business-outline',
    screen: 'BusinessRegistration',
    required: true,
  },
  {
    key: 'payment',
    title: '결제 수단',
    description: '결제 카드 및 계좌 관리',
    icon: 'card-outline',
    screen: 'PaymentSettings',
    required: true,
  },
  {
    key: 'refund',
    title: '환불 계좌',
    description: '환불 수령을 위한 계좌 정보',
    icon: 'refresh-outline',
    screen: 'RefundAccount',
    required: true,
  },
];

export default function PartnerRegistrationScreen({ navigation }: PartnerRegistrationScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();

  const { data: businessData } = useQuery<RequesterBusiness>({
    queryKey: ['/api/requesters/business'],
  });

  const getItemStatus = (key: string): { label: string; color: string; bgColor: string } => {
    switch (key) {
      case 'business':
        return businessData?.businessNumber
          ? { label: '등록완료', color: '#10B981', bgColor: '#D1FAE5' }
          : { label: '미등록', color: '#9CA3AF', bgColor: '#F3F4F6' };
      case 'payment':
        return { label: '관리', color: '#3B82F6', bgColor: '#DBEAFE' };
      case 'refund':
        return businessData?.bankName
          ? { label: '등록완료', color: '#10B981', bgColor: '#D1FAE5' }
          : { label: '미등록', color: '#9CA3AF', bgColor: '#F3F4F6' };
      default:
        return { label: '미등록', color: '#9CA3AF', bgColor: '#F3F4F6' };
    }
  };

  const registeredCount = [
    businessData?.businessNumber ? 1 : 0,
    1, // 결제수단은 항상 접근 가능
    businessData?.bankName ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.md,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      {/* 진행 상황 카드 */}
      <Card style={styles.progressCard}>
        <ThemedText style={[styles.progressTitle, { color: theme.text }]}>
          협력업체 등록 현황
        </ThemedText>

        <View style={styles.progressRow}>
          <View style={styles.progressItem}>
            <ThemedText style={[styles.progressValue, { color: BrandColors.requester }]}>
              {registeredCount}
            </ThemedText>
            <ThemedText style={[styles.progressLabel, { color: theme.tabIconDefault }]}>
              등록완료
            </ThemedText>
          </View>

          <View style={styles.progressDivider} />

          <View style={styles.progressItem}>
            <ThemedText style={[styles.progressValue, { color: theme.text }]}>
              {MENU_ITEMS.length}
            </ThemedText>
            <ThemedText style={[styles.progressLabel, { color: theme.tabIconDefault }]}>
              전체항목
            </ThemedText>
          </View>
        </View>

        {/* 진행률 바 */}
        <View style={[styles.progressBarContainer, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${(registeredCount / MENU_ITEMS.length) * 100}%`,
                backgroundColor: BrandColors.requester,
              }
            ]}
          />
        </View>
        <ThemedText style={[styles.progressHint, { color: theme.tabIconDefault }]}>
          모든 항목을 등록해주세요
        </ThemedText>
      </Card>

      {/* 메뉴 목록 */}
      <View style={styles.menuSection}>
        <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>
          등록 항목
        </ThemedText>

        {MENU_ITEMS.map((item, index) => {
          const status = getItemStatus(item.key);

          return (
            <Pressable
              key={item.key}
              style={({ pressed }) => [
                styles.menuCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  opacity: pressed ? 0.7 : 1,
                  marginBottom: index === MENU_ITEMS.length - 1 ? 0 : Spacing.md,
                },
              ]}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIcon, { backgroundColor: BrandColors.requesterLight || '#EDE9FE' }]}>
                  <Icon name={item.icon as any} size={24} color={BrandColors.requester} />
                </View>

                <View style={styles.menuInfo}>
                  <View style={styles.titleRow}>
                    <ThemedText style={[styles.menuTitle, { color: theme.text }]}>
                      {item.title}
                    </ThemedText>
                    {item.required && (
                      <View style={[styles.requiredBadge, { backgroundColor: '#FEE2E2' }]}>
                        <ThemedText style={[styles.requiredText, { color: '#EF4444' }]}>
                          필수
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  <ThemedText style={[styles.menuDescription, { color: theme.tabIconDefault }]}>
                    {item.key === 'business' && businessData?.businessNumber
                      ? `사업자번호: ${businessData.businessNumber}`
                      : item.key === 'refund' && businessData?.bankName
                        ? `${businessData.bankName} ${businessData.accountNumber?.slice(-4) || ''}`
                        : item.description}
                  </ThemedText>

                  {/* 상태 배지 */}
                  <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                    <Icon
                      name={status.label === '등록완료' ? 'checkmark-circle-outline' : status.label === '관리' ? 'settings-outline' : 'alert-circle-outline'}
                      size={14}
                      color={status.color}
                    />
                    <ThemedText style={[styles.statusText, { color: status.color }]}>
                      {status.label}
                    </ThemedText>
                  </View>
                </View>
              </View>

              <Icon name="chevron-forward-outline" size={20} color={theme.tabIconDefault} />
            </Pressable>
          );
        })}
      </View>

      {/* 안내 사항 */}
      <Card style={[styles.infoCard, { backgroundColor: BrandColors.requesterLight || '#EDE9FE' }]}>
        <View style={styles.infoHeader}>
          <Icon name="information-circle-outline" size={20} color={BrandColors.requester} />
          <ThemedText style={[styles.infoTitle, { color: BrandColors.requester }]}>
            협력업체 등록 안내
          </ThemedText>
        </View>

        <ThemedText style={[styles.infoText, { color: theme.tabIconDefault }]}>
          • 사업자정보를 등록해야 세금계산서를 발행할 수 있습니다{'\n'}
          • 결제 수단을 등록해야 오더 결제가 가능합니다{'\n'}
          • 환불 계좌를 등록해야 환불금을 수령할 수 있습니다{'\n'}
          • 모든 정보는 안전하게 암호화되어 관리됩니다
        </ThemedText>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.lg,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
  progressItem: {
    alignItems: 'center',
  },
  progressValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  progressLabel: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  progressDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  progressHint: {
    fontSize: 12,
    textAlign: 'center',
  },
  menuSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: Spacing.md,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  requiredBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '600',
  },
  menuDescription: {
    fontSize: 13,
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    padding: Spacing.lg,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
