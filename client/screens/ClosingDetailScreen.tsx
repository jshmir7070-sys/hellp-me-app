import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Modal,
  Dimensions,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Icon } from "@/components/Icon";

import { useTheme } from "@/hooks/useTheme";
import { useAuthImage } from "@/hooks/useAuthImage";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Spacing, Typography, BorderRadius, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getToken } from "@/utils/secure-token-storage";
import { ClosingStackParamList } from "@/navigation/ClosingStackNavigator";
import { useResponsive } from "@/hooks/useResponsive";

type ClosingDetailScreenProps = NativeStackScreenProps<ClosingStackParamList, 'ClosingDetail'>;

interface ExtraCostItem {
  code?: string;
  name?: string;
  amount: number;
  memo?: string;
}

interface ClosingSummary {
  etcCount?: number;
  etcPricePerUnit?: number;
  etcAmount?: number;
  helperClosingText: string | null;
  closingStatus: string | null;
  submittedAt: string | null;
  deliveredCount: number;
  returnedCount: number;
  deliveryHistoryImages: string[];
  etcImages: string[];
  pricePerUnit: number;
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  balanceStatus: string;
  finalAmount: number;
  // 금액 산출 breakdown
  deliveryReturnAmount?: number;
  extraCosts?: ExtraCostItem[];
  extraCostsTotal?: number;
}

const { width: screenWidth } = Dimensions.get('window');

export default function ClosingDetailScreen({ route, navigation }: ClosingDetailScreenProps) {
  const { orderId } = route.params;
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const { getImageUrl } = useAuthImage();

  const { data: summary, isLoading } = useQuery<ClosingSummary>({
    queryKey: ['/api/orders', orderId, 'closing-summary'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/orders/${orderId}/closing-summary`);
      if (!res.ok) throw new Error('Failed to fetch closing summary');
      return res.json();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/orders/${orderId}/closing/confirm`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders', orderId, 'closing-summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/requester/orders'] });
      if (Platform.OS === 'web') {
        alert('마감을 확인했습니다. 잔금 결제를 진행해주세요.');
      } else {
        Alert.alert('확인 완료', '마감을 확인했습니다. 잔금 결제를 진행해주세요.');
      }
      navigation.goBack();
    },
    onError: (err: any) => {
      if (Platform.OS === 'web') {
        alert(err.message || '확인에 실패했습니다.');
      } else {
        Alert.alert('오류', err.message || '확인에 실패했습니다.');
      }
    },
  });

  const handleConfirm = () => {
    if (Platform.OS === 'web') {
      if (confirm('마감자료를 확인하시겠습니까?')) {
        confirmMutation.mutate();
      }
    } else {
      Alert.alert(
        '마감 확인',
        '헬퍼의 마감자료를 확인하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '확인', onPress: () => confirmMutation.mutate() },
        ]
      );
    }
  };


  // getImageUrl은 useAuthImage 훅에서 제공

  const renderImageGrid = (images: string[], title: string, required: boolean = false) => {
    if (images.length === 0 && !required) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            {title}
          </ThemedText>
          {required && (
            <View style={[styles.requiredBadge, { backgroundColor: BrandColors.helper + '20' }]}>
              <ThemedText style={[styles.requiredText, { color: BrandColors.helper }]}>
                필수
              </ThemedText>
            </View>
          )}
        </View>
        
        {images.length > 0 ? (
          <View style={styles.imageGrid}>
            {images.map((image, index) => (
              <Pressable
                key={index}
                style={styles.imageWrapper}
                onPress={() => setSelectedImage(getImageUrl(image))}
              >
                <Image
                  source={{ uri: getImageUrl(image) }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[styles.noImages, { backgroundColor: theme.backgroundSecondary }]}>
            <Icon name="image-outline" size={24} color={theme.tabIconDefault} />
            <ThemedText style={[styles.noImagesText, { color: theme.tabIconDefault }]}>
              업로드된 이미지가 없습니다
            </ThemedText>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ThemedText style={{ color: theme.tabIconDefault }}>로딩 중...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingHorizontal: Spacing.lg,
          paddingBottom: showDesktopLayout ? Spacing.xl + 80 : tabBarHeight + Spacing.xl + 80,
          ...(showDesktopLayout && {
            maxWidth: containerMaxWidth,
            alignSelf: 'center' as const,
            width: '100%' as any,
          }),
        }}
        showsVerticalScrollIndicator={true}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <Card style={styles.summaryCard}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
            업무 실적
          </ThemedText>
          <View style={styles.amountSection}>
            <View style={styles.amountRow}>
              <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                배송
              </ThemedText>
              <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                {summary?.deliveredCount || 0}건
              </ThemedText>
            </View>
            <View style={styles.amountRow}>
              <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                반품
              </ThemedText>
              <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                {summary?.returnedCount || 0}건
              </ThemedText>
            </View>
            <View style={styles.amountRow}>
              <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                기타
              </ThemedText>
              <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                {summary?.etcCount || 0}건
              </ThemedText>
            </View>
          </View>
        </Card>

        <Card style={styles.summaryCard}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
            금액 산출 내역
          </ThemedText>
          <View style={styles.amountSection}>
            {/* 배송+반품 금액 */}
            <View style={styles.amountRow}>
              <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                배송+반품 ({summary?.deliveredCount || 0}+{summary?.returnedCount || 0}) × {(summary?.pricePerUnit || 0).toLocaleString()}원
              </ThemedText>
              <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                {formatCurrency(summary?.deliveryReturnAmount || ((summary?.deliveredCount || 0) + (summary?.returnedCount || 0)) * (summary?.pricePerUnit || 0))}
              </ThemedText>
            </View>
            {/* 기타 금액 */}
            {(summary?.etcCount || 0) > 0 && (
              <View style={styles.amountRow}>
                <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                  기타 ({summary?.etcCount || 0}) × {(summary?.etcPricePerUnit || 1800).toLocaleString()}원
                </ThemedText>
                <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                  {formatCurrency(summary?.etcAmount || 0)}
                </ThemedText>
              </View>
            )}
            {/* 추가비용 (VAT별도 공급가) */}
            {summary?.extraCosts && summary.extraCosts.length > 0 && (
              <>
                {summary.extraCosts.map((cost, idx) => (
                  <View key={idx} style={styles.amountRow}>
                    <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                      추가: {cost.code || cost.name || '기타'} <ThemedText style={{ fontSize: 10, color: '#92400E' }}>(VAT별도)</ThemedText>
                    </ThemedText>
                    <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                      {formatCurrency(cost.amount || 0)}
                    </ThemedText>
                  </View>
                ))}
              </>
            )}
            {/* 공급가액 */}
            <View style={[styles.amountRow, { borderTopWidth: 1, borderTopColor: theme.backgroundSecondary, paddingTop: 8, marginTop: 4 }]}>
              <ThemedText style={[styles.totalLabel, { color: theme.text }]}>
                공급가액
              </ThemedText>
              <ThemedText style={[styles.amountValue, { color: theme.text, fontWeight: '700' }]}>
                {formatCurrency(summary?.supplyAmount || 0)}
              </ThemedText>
            </View>
            {/* 부가세 */}
            <View style={styles.amountRow}>
              <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                부가세 (10%)
              </ThemedText>
              <ThemedText style={[styles.amountValue, { color: theme.text }]}>
                {formatCurrency(summary?.vatAmount || 0)}
              </ThemedText>
            </View>
            {/* 총 금액 */}
            <View style={[styles.amountRow, styles.totalRow, { borderTopColor: theme.backgroundSecondary }]}>
              <ThemedText style={[styles.totalLabel, { color: theme.text }]}>
                총 금액
              </ThemedText>
              <ThemedText style={[styles.totalValue, { color: BrandColors.requester }]}>
                {formatCurrency(summary?.totalAmount || 0)}
              </ThemedText>
            </View>
            <View style={styles.amountRow}>
              <ThemedText style={[styles.amountLabel, { color: theme.tabIconDefault }]}>
                선금 (결제 완료)
              </ThemedText>
              <ThemedText style={[styles.amountValue, { color: BrandColors.success }]}>
                -{formatCurrency(summary?.depositAmount || 0)}
              </ThemedText>
            </View>
            <View style={[styles.amountRow, styles.balanceRow]}>
              <ThemedText style={[styles.totalLabel, { color: theme.text }]}>
                잔금 (결제 필요)
              </ThemedText>
              <ThemedText style={[styles.totalValue, { color: BrandColors.warning }]}>
                {formatCurrency(summary?.balanceAmount || 0)}
              </ThemedText>
            </View>
          </View>
        </Card>

        {summary?.helperClosingText ? (
          <Card style={styles.summaryCard}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
              헬퍼 메모
            </ThemedText>
            <ThemedText style={[styles.memoText, { color: theme.text }]}>
              {summary.helperClosingText}
            </ThemedText>
          </Card>
        ) : null}

        {renderImageGrid(summary?.deliveryHistoryImages || [], '집배송 이력 이미지', true)}

        {renderImageGrid(summary?.etcImages || [], '추가 참고 이미지')}

        {summary?.closingStatus === 'submitted' ? (
          <View style={styles.actionButtons}>
            <Button
              onPress={handleConfirm}
              disabled={confirmMutation.isPending}
              style={[styles.confirmButton, { backgroundColor: BrandColors.requester }]}
            >
              {confirmMutation.isPending ? '처리 중...' : '마감 확인'}
            </Button>
          </View>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  amountSection: {
    gap: Spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    ...Typography.body,
  },
  amountValue: {
    ...Typography.body,
    fontWeight: '600',
  },
  cardTitle: {
    ...Typography.h4,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  totalRow: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
  totalLabel: {
    ...Typography.body,
    fontWeight: '700',
  },
  totalValue: {
    ...Typography.h4,
    fontWeight: '700',
  },
  balanceRow: {
    marginTop: Spacing.xs,
  },
  memoText: {
    ...Typography.body,
    lineHeight: 22,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    fontWeight: '600',
  },
  requiredBadge: {
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '600',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  imageWrapper: {
    width: (screenWidth - Spacing.lg * 2 - Spacing.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  noImages: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  noImagesText: {
    ...Typography.small,
  },
  actionButtons: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  confirmButton: {
    paddingVertical: Spacing.md,
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
    width: screenWidth,
    height: screenWidth,
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
