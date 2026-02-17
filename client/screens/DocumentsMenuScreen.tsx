import React, { useEffect } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { Spacing, BorderRadius, BrandColors } from '@/constants/theme';

type DocumentsMenuScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface DocumentStatus {
  documentType: 'businessCert' | 'driverLicense' | 'cargoLicense' | 'vehicleCert' | 'transportContract';
  status: 'pending' | 'reviewing' | 'approved' | 'rejected' | 'not_submitted';
  uploadedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

const DOCUMENT_CONFIG = [
  {
    type: 'businessCert' as const,
    title: '사업자등록증',
    description: '개인/법인 사업자등록증',
    icon: 'document-text-outline',
    required: true,
    screen: 'BusinessCertSubmit',
  },
  {
    type: 'driverLicense' as const,
    title: '운전면허증',
    description: '1종 보통 또는 2종 보통 면허증',
    icon: 'card-outline',
    required: true,
    screen: 'DriverLicenseSubmit',
  },
  {
    type: 'cargoLicense' as const,
    title: '화물운송종사자격증',
    description: '화물자동차 운송사업 종사자격증',
    icon: 'shield-checkmark-outline',
    required: true,
    screen: 'CargoLicenseSubmit',
  },
  {
    type: 'vehicleCert' as const,
    title: '차량등록증',
    description: '배송 차량 등록증',
    icon: 'car-outline',
    required: true,
    screen: 'VehicleCertSubmit',
  },
  {
    type: 'transportContract' as const,
    title: '화물위탁계약서',
    description: '화물자동차 운송사업 위수탁 계약서',
    icon: 'document-outline',
    required: true,
    screen: 'TransportContractSubmit',
  },
];

const STATUS_CONFIG = {
  not_submitted: {
    label: '미제출',
    color: '#9CA3AF',
    bgColor: '#F3F4F6',
    icon: 'alert-circle-outline',
  },
  pending: {
    label: '검토대기',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    icon: 'time-outline',
  },
  reviewing: {
    label: '검토중',
    color: '#3B82F6',
    bgColor: '#DBEAFE',
    icon: 'eye-outline',
  },
  approved: {
    label: '승인완료',
    color: '#10B981',
    bgColor: '#D1FAE5',
    icon: 'checkmark-circle-outline',
  },
  rejected: {
    label: '반려됨',
    color: '#EF4444',
    bgColor: '#FEE2E2',
    icon: 'close-circle-outline',
  },
};

export default function DocumentsMenuScreen({ navigation }: DocumentsMenuScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user, refreshUser } = useAuth();

  // 서류 상태 조회 (서버에서 onboardingStatus 자동 보정 트리거)
  const { data: documentsStatus = [], isLoading } = useQuery<DocumentStatus[]>({
    queryKey: ['/api/helpers/documents/status'],
  });

  // 서류 API 호출 후 서버에서 onboardingStatus가 갱신되었을 수 있으므로 사용자 정보 새로고침
  useEffect(() => {
    if (documentsStatus.length > 0 && user?.onboardingStatus !== 'approved') {
      const requiredTypes = ['businessCert', 'driverLicense', 'cargoLicense', 'vehicleCert', 'transportContract'];
      const allApproved = requiredTypes.every(type =>
        documentsStatus.some((d: any) => d.documentType === type && d.status === 'approved')
      );
      if (allApproved) {
        refreshUser();
      }
    }
  }, [documentsStatus]);

  const getDocumentStatus = (type: string): DocumentStatus['status'] => {
    const doc = documentsStatus.find(d => d.documentType === type);
    return doc?.status || 'not_submitted';
  };

  const getDocumentData = (type: string) => {
    return documentsStatus.find(d => d.documentType === type);
  };

  // 완료된 서류 수 계산
  const approvedCount = documentsStatus.filter(d => d.status === 'approved').length;
  const requiredCount = DOCUMENT_CONFIG.filter(d => d.required).length;
  const totalCount = DOCUMENT_CONFIG.length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl + 40,
        paddingHorizontal: Spacing.lg,
      }}
    >
      {/* 진행 상황 카드 */}
      <Card style={styles.progressCard}>
        <ThemedText style={[styles.progressTitle, { color: theme.text }]}>
          서류 제출 현황
        </ThemedText>
        
        <View style={styles.progressRow}>
          <View style={styles.progressItem}>
            <ThemedText style={[styles.progressValue, { color: BrandColors.helper }]}>
              {approvedCount}
            </ThemedText>
            <ThemedText style={[styles.progressLabel, { color: theme.tabIconDefault }]}>
              승인완료
            </ThemedText>
          </View>
          
          <View style={styles.progressDivider} />
          
          <View style={styles.progressItem}>
            <ThemedText style={[styles.progressValue, { color: theme.text }]}>
              {requiredCount}
            </ThemedText>
            <ThemedText style={[styles.progressLabel, { color: theme.tabIconDefault }]}>
              필수서류
            </ThemedText>
          </View>
          
          <View style={styles.progressDivider} />
          
          <View style={styles.progressItem}>
            <ThemedText style={[styles.progressValue, { color: theme.text }]}>
              {totalCount}
            </ThemedText>
            <ThemedText style={[styles.progressLabel, { color: theme.tabIconDefault }]}>
              전체
            </ThemedText>
          </View>
        </View>

        {/* 진행률 바 */}
        <View style={[styles.progressBarContainer, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
          <View 
            style={[
              styles.progressBarFill, 
              { 
                width: `${(approvedCount / requiredCount) * 100}%`,
                backgroundColor: BrandColors.helper,
              }
            ]} 
          />
        </View>
        <ThemedText style={[styles.progressHint, { color: approvedCount >= requiredCount ? BrandColors.success : theme.tabIconDefault }]}>
          {approvedCount >= requiredCount
            ? '모든 필수 서류가 승인되었습니다'
            : '필수 서류를 모두 제출해주세요'}
        </ThemedText>
      </Card>

      {/* 서류 목록 */}
      <View style={styles.documentsSection}>
        <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>
          제출 서류
        </ThemedText>

        {DOCUMENT_CONFIG.map((doc, index) => {
          const status = getDocumentStatus(doc.type);
          const statusInfo = STATUS_CONFIG[status];
          const docData = getDocumentData(doc.type);

          return (
            <Pressable
              key={doc.type}
              style={({ pressed }) => [
                styles.documentCard,
                { 
                  backgroundColor: theme.backgroundDefault,
                  opacity: pressed ? 0.7 : 1,
                  marginBottom: index === DOCUMENT_CONFIG.length - 1 ? 0 : Spacing.md,
                },
              ]}
              onPress={() => navigation.navigate(doc.screen)}
            >
              <View style={styles.documentLeft}>
                <View style={[styles.documentIcon, { backgroundColor: BrandColors.helperLight }]}>
                  <Icon name={doc.icon as any} size={24} color={BrandColors.helper} />
                </View>
                
                <View style={styles.documentInfo}>
                  <View style={styles.titleRow}>
                    <ThemedText style={[styles.documentTitle, { color: theme.text }]}>
                      {doc.title}
                    </ThemedText>
                    {doc.required && (
                      <View style={[styles.requiredBadge, { backgroundColor: '#FEE2E2' }]}>
                        <ThemedText style={[styles.requiredText, { color: '#EF4444' }]}>
                          필수
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  
                  <ThemedText style={[styles.documentDescription, { color: theme.tabIconDefault }]}>
                    {doc.description}
                  </ThemedText>

                  {/* 상태 배지 */}
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                    <Icon name={statusInfo.icon as any} size={14} color={statusInfo.color} />
                    <ThemedText style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </ThemedText>
                  </View>

                  {/* 반려 사유 */}
                  {status === 'rejected' && docData?.rejectionReason && (
                    <View style={[styles.rejectionBox, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
                      <ThemedText style={[styles.rejectionLabel, { color: '#991B1B' }]}>
                        반려 사유:
                      </ThemedText>
                      <ThemedText style={[styles.rejectionReason, { color: '#991B1B' }]}>
                        {docData.rejectionReason}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>

              <Icon name="chevron-forward-outline" size={20} color={theme.tabIconDefault} />
            </Pressable>
          );
        })}
      </View>

      {/* 안내 사항 */}
      <Card style={[styles.infoCard, { backgroundColor: BrandColors.helperLight }]}>
        <View style={styles.infoHeader}>
          <Icon name="information-circle-outline" size={20} color={BrandColors.helper} />
          <ThemedText style={[styles.infoTitle, { color: BrandColors.helper }]}>
            서류 제출 안내
          </ThemedText>
        </View>
        
        <ThemedText style={[styles.infoText, { color: theme.tabIconDefault }]}>
          • 필수 서류를 모두 제출해야 헬퍼로 활동할 수 있습니다{'\n'}
          • 서류 검토는 영업일 기준 1-2일 소요됩니다{'\n'}
          • 반려된 서류는 다시 제출할 수 있습니다{'\n'}
          • 서류는 최신 정보로 업데이트해주세요
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
  documentsSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  documentLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: Spacing.md,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  documentTitle: {
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
  documentDescription: {
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
  rejectionBox: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  rejectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  rejectionReason: {
    fontSize: 12,
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
