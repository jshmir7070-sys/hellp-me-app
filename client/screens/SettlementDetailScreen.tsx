import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, Image, ActivityIndicator, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { useQuery } from "@tanstack/react-query";
import { RouteProp } from "@react-navigation/native";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { useAuthImage } from "@/hooks/useAuthImage";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { getToken } from "@/utils/secure-token-storage";

type SettlementDetailScreenProps = {
  route: RouteProp<{ SettlementDetail: { date: string; orderId?: number } }, 'SettlementDetail'>;
};

interface ExtraCostItem {
  code?: string;
  name?: string;
  amount: number;
  memo?: string;
}

interface WorkDetail {
  orderId: number;
  orderTitle: string;
  companyName: string;
  deliveryArea: string;
  workDate: string;
  pricePerUnit: number;
  dailyRate: number;
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
  commissionRate?: number;
  commissionAmount?: number;
  deductionAmount: number;
  deductionReason: string;
  netAmount: number;
  deliveredCount: number;
  returnedCount: number;
  etcCount?: number;
  etcPricePerUnit?: number;
  etcAmount?: number;
  extraCosts?: ExtraCostItem[];
  extraCostsTotal?: number;
  deliveryReturnAmount?: number;
  closingText: string;
  dynamicFields: Record<string, string | number>;
  deliveryHistoryImages: string[];
  etcImages: string[];
  status: string;
  submittedAt: string;
}

export default function SettlementDetailScreen({ route }: SettlementDetailScreenProps) {
  const { date, orderId } = route.params;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();

  const queryString = orderId 
    ? `/api/helper/work-detail?orderId=${orderId}` 
    : `/api/helper/work-detail?date=${date}`;

  const { data: workDetail, isLoading } = useQuery<WorkDetail>({
    queryKey: [queryString],
  });

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { getImageUrl } = useAuthImage();

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
      </View>
    );
  }

  if (!workDetail) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <Icon name="document-text-outline" size={48} color={theme.tabIconDefault} />
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
          근무 정보를 찾을 수 없습니다
        </ThemedText>
      </View>
    );
  }

  const dynamicFieldEntries = workDetail.dynamicFields 
    ? Object.entries(workDetail.dynamicFields) 
    : [];

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: showDesktopLayout ? Spacing.xl + 60 : tabBarHeight + Spacing.xl + 60,
        paddingHorizontal: Spacing.lg,
        ...(showDesktopLayout && {
          maxWidth: containerMaxWidth,
          alignSelf: 'center' as const,
          width: '100%' as any,
        }),
      }}
    >
      <Card style={styles.headerCard}>
        <ThemedText style={[styles.dateText, { color: theme.tabIconDefault }]}>
          {formatDate(workDetail.workDate || date)}
        </ThemedText>
        <ThemedText style={[styles.titleText, { color: theme.text }]}>
          {workDetail.orderTitle || workDetail.companyName || '오더'}
        </ThemedText>
        {workDetail.deliveryArea ? (
          <ThemedText style={[styles.areaText, { color: theme.tabIconDefault }]}>
            {workDetail.deliveryArea}
          </ThemedText>
        ) : null}
      </Card>

      <Card style={styles.statsCard}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          배송 현황
        </ThemedText>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: theme.backgroundSecondary }]}>
            <Icon name="cube-outline" size={24} color={BrandColors.helper} />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>
              {workDetail.deliveredCount ?? 0}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>
              배송 완료
            </ThemedText>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.backgroundSecondary }]}>
            <Icon name="rotate-left" size={24} color={BrandColors.warning} />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>
              {workDetail.returnedCount ?? 0}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>
              반품
            </ThemedText>
          </View>
          <View style={[styles.statBox, { backgroundColor: theme.backgroundSecondary }]}>
            <Icon name="ellipsis-horizontal-outline" size={24} color={BrandColors.success} />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>
              {workDetail.etcCount ?? 0}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.tabIconDefault }]}>
              기타
            </ThemedText>
          </View>
        </View>
      </Card>

      <Card style={styles.amountCard}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          금액 산출 내역
        </ThemedText>

        {/* 배송+반품 금액 */}
        <View style={styles.amountRow}>
          <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
            배송+반품 ({workDetail.deliveredCount + (workDetail.returnedCount ?? 0)}건 × {formatCurrency(workDetail.pricePerUnit)})
          </ThemedText>
          <ThemedText style={[styles.amountValue, { color: theme.text }]}>
            {formatCurrency(workDetail.deliveryReturnAmount ?? ((workDetail.deliveredCount + (workDetail.returnedCount ?? 0)) * workDetail.pricePerUnit))}
          </ThemedText>
        </View>

        {/* 기타 금액 */}
        {(workDetail.etcCount ?? 0) > 0 ? (
          <View style={styles.amountRow}>
            <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
              기타 ({workDetail.etcCount}건 × {formatCurrency(workDetail.etcPricePerUnit)})
            </ThemedText>
            <ThemedText style={[styles.amountValue, { color: theme.text }]}>
              {formatCurrency(workDetail.etcAmount ?? ((workDetail.etcCount ?? 0) * (workDetail.etcPricePerUnit ?? 0)))}
            </ThemedText>
          </View>
        ) : null}

        {/* 추가비용 항목들 (VAT별도 공급가) */}
        {workDetail.extraCosts && workDetail.extraCosts.length > 0 ? (
          <>
            {workDetail.extraCosts.map((cost, idx) => (
              <View key={idx} style={styles.amountRow}>
                <ThemedText style={[styles.amountLabel, { color: '#F59E0B' }]}>
                  추가: {cost.code || cost.name || `항목${idx + 1}`} <ThemedText style={{ fontSize: 10, color: '#92400E' }}>(VAT별도)</ThemedText>
                </ThemedText>
                <ThemedText style={[styles.amountValue, { color: '#F59E0B' }]}>
                  {formatCurrency(cost.amount)}
                </ThemedText>
              </View>
            ))}
          </>
        ) : null}

        <View style={[styles.divider, { backgroundColor: theme.backgroundSecondary }]} />

        {/* 공급가액 / 부가세 / 합계 */}
        <View style={styles.amountRow}>
          <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
            공급가액
          </ThemedText>
          <ThemedText style={[styles.amountValue, { color: theme.text }]}>
            {formatCurrency(workDetail.supplyAmount)}
          </ThemedText>
        </View>
        <View style={styles.amountRow}>
          <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
            부가세 (10%)
          </ThemedText>
          <ThemedText style={[styles.amountValue, { color: theme.text }]}>
            {formatCurrency(workDetail.vatAmount)}
          </ThemedText>
        </View>
        <View style={styles.amountRow}>
          <ThemedText style={[styles.amountLabel, { color: theme.text, fontWeight: '600' }]}>
            합계
          </ThemedText>
          <ThemedText style={[styles.amountValue, { color: theme.text, fontWeight: '600' }]}>
            {formatCurrency(workDetail.totalAmount)}
          </ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.backgroundSecondary }]} />

        {/* 수수료 */}
        {(workDetail.commissionAmount ?? 0) > 0 ? (
          <View style={styles.amountRow}>
            <ThemedText style={[styles.amountLabel, { color: '#F59E0B' }]}>
              수수료 ({workDetail.commissionRate || 0}%)
            </ThemedText>
            <ThemedText style={[styles.amountValue, { color: '#F59E0B' }]}>
              -{formatCurrency(workDetail.commissionAmount || 0)}
            </ThemedText>
          </View>
        ) : null}

        {/* 차감액 */}
        {workDetail.deductionAmount > 0 ? (
          <View style={styles.amountRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.amountLabel, { color: BrandColors.error }]}>
                차감액
              </ThemedText>
              {workDetail.deductionReason ? (
                <ThemedText style={[styles.deductionReason, { color: theme.tabIconDefault }]}>
                  ({workDetail.deductionReason})
                </ThemedText>
              ) : null}
            </View>
            <ThemedText style={[styles.amountValue, { color: BrandColors.error }]}>
              -{formatCurrency(workDetail.deductionAmount)}
            </ThemedText>
          </View>
        ) : null}

        <View style={[styles.divider, { backgroundColor: theme.backgroundSecondary }]} />
        <View style={styles.amountRow}>
          <ThemedText style={[styles.amountLabel, { color: BrandColors.helper, fontWeight: '700' }]}>
            지급액
          </ThemedText>
          <ThemedText style={[styles.amountValue, { color: BrandColors.helper, fontWeight: '700', fontSize: 18 }]}>
            {formatCurrency(workDetail.netAmount)}
          </ThemedText>
        </View>
      </Card>

      {dynamicFieldEntries.length > 0 ? (
        <Card style={styles.dynamicFieldsCard}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            추가 입력 항목
          </ThemedText>
          {dynamicFieldEntries.map(([key, value]) => (
            <View key={key} style={styles.dynamicFieldRow}>
              <ThemedText style={[styles.dynamicFieldLabel, { color: theme.tabIconDefault }]}>
                {key}
              </ThemedText>
              <ThemedText style={[styles.dynamicFieldValue, { color: theme.text }]}>
                {String(value)}
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      {workDetail.closingText ? (
        <Card style={styles.memoCard}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            특이사항
          </ThemedText>
          <ThemedText style={[styles.memoText, { color: theme.text }]}>
            {workDetail.closingText}
          </ThemedText>
        </Card>
      ) : null}

      {workDetail.deliveryHistoryImages && workDetail.deliveryHistoryImages.length > 0 ? (
        <Card style={styles.imagesCard}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            집배송 이력 증빙 ({workDetail.deliveryHistoryImages.length}장)
          </ThemedText>
          <View style={styles.imagesGrid}>
            {workDetail.deliveryHistoryImages.map((img, idx) => {
              const imageUrl = getImageUrl(img);
              return (
                <Pressable key={idx} onPress={() => setSelectedImage(imageUrl)}>
                  <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="cover" />
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      {workDetail.etcImages && workDetail.etcImages.length > 0 ? (
        <Card style={styles.imagesCard}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            기타 첨부 ({workDetail.etcImages.length}장)
          </ThemedText>
          <View style={styles.imagesGrid}>
            {workDetail.etcImages.map((img, idx) => {
              const imageUrl = getImageUrl(img);
              return (
                <Pressable key={idx} onPress={() => setSelectedImage(imageUrl)}>
                  <Image source={{ uri: imageUrl }} style={styles.thumbnail} resizeMode="cover" />
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      {workDetail.submittedAt ? (
        <ThemedText style={[styles.submittedAt, { color: theme.tabIconDefault }]}>
          마감 제출일시: {new Date(workDetail.submittedAt).toLocaleString('ko-KR')}
        </ThemedText>
      ) : null}
    </ScrollView>

    <Modal
      visible={!!selectedImage}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedImage(null)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setSelectedImage(null)}
      >
        <View style={styles.modalContent}>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
          <Pressable
            style={styles.closeButton}
            onPress={() => setSelectedImage(null)}
          >
            <Icon name="close-outline" size={24} color="#fff" />
          </Pressable>
        </View>
      </Pressable>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  headerCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  dateText: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  titleText: {
    ...Typography.h4,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  areaText: {
    ...Typography.small,
  },
  statsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  statValue: {
    ...Typography.h3,
    fontWeight: '700',
  },
  statLabel: {
    ...Typography.small,
  },
  amountCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  amountLabel: {
    ...Typography.body,
  },
  amountValue: {
    ...Typography.body,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  deductionReason: {
    ...Typography.small,
    marginTop: 2,
  },
  dynamicFieldsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  dynamicFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dynamicFieldLabel: {
    ...Typography.body,
    flex: 1,
  },
  dynamicFieldValue: {
    ...Typography.body,
    fontWeight: '500',
    textAlign: 'right',
  },
  memoCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  memoText: {
    ...Typography.body,
    lineHeight: 22,
  },
  imagesCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  submittedAt: {
    ...Typography.small,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '90%',
    height: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
