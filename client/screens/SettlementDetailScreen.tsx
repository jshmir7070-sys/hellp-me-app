import React from "react";
import { View, ScrollView, StyleSheet, Image, ActivityIndicator, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { useQuery } from "@tanstack/react-query";
import { RouteProp } from "@react-navigation/native";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

type SettlementDetailScreenProps = {
  route: RouteProp<{ SettlementDetail: { date: string; orderId?: number } }, 'SettlementDetail'>;
};

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
  const { theme } = useTheme();

  const queryString = orderId 
    ? `/api/helper/work-detail?orderId=${orderId}` 
    : `/api/helper/work-detail?date=${date}`;

  const { data: workDetail, isLoading } = useQuery<WorkDetail>({
    queryKey: [queryString],
  });

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
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl + 60,
        paddingHorizontal: Spacing.lg,
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
          정산 내역
        </ThemedText>
        {workDetail.pricePerUnit > 0 ? (
          <View style={styles.amountRow}>
            <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
              배송 단가 (VAT별도)
            </ThemedText>
            <ThemedText style={[styles.amountValue, { color: theme.text }]}>
              {formatCurrency(workDetail.pricePerUnit)}/건
            </ThemedText>
          </View>
        ) : null}
        {(workDetail.etcPricePerUnit ?? 0) > 0 ? (
          <View style={styles.amountRow}>
            <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
              기타 단가 (VAT별도)
            </ThemedText>
            <ThemedText style={[styles.amountValue, { color: theme.text }]}>
              {formatCurrency(workDetail.etcPricePerUnit)}/건
            </ThemedText>
          </View>
        ) : null}
        {(workDetail.etcAmount ?? 0) > 0 ? (
          <View style={styles.amountRow}>
            <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
              기타 금액 ({workDetail.etcCount}건 × {formatCurrency(workDetail.etcPricePerUnit)})
            </ThemedText>
            <ThemedText style={[styles.amountValue, { color: theme.text }]}>
              {formatCurrency(workDetail.etcAmount)}
            </ThemedText>
          </View>
        ) : null}
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
        <View style={[styles.divider, { backgroundColor: theme.backgroundSecondary }]} />
        <View style={styles.amountRow}>
          <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
            합계
          </ThemedText>
          <ThemedText style={[styles.amountValue, { color: theme.text, fontWeight: '600' }]}>
            {formatCurrency(workDetail.totalAmount)}
          </ThemedText>
        </View>
        
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
              const imageUrl = img.startsWith('http') ? img : `${getApiUrl()}${img}`;
              return (
                <Pressable key={idx} onPress={() => Linking.openURL(imageUrl)}>
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
              const imageUrl = img.startsWith('http') ? img : `${getApiUrl()}${img}`;
              return (
                <Pressable key={idx} onPress={() => Linking.openURL(imageUrl)}>
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
});
