import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator, Linking, Image, Modal, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { JobsStackParamList } from "@/navigation/types";
import { apiRequest } from "@/lib/query-client";

const { width: screenWidth } = Dimensions.get('window');

type JobDetailScreenProps = NativeStackScreenProps<JobsStackParamList, 'JobDetail'>;

interface Order {
  id: number;
  title: string;
  companyName?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  dailyRate?: number;
  pricePerUnit?: number;
  status: string;
  category?: string;
  deadline?: string;
  description?: string;
  requirements?: string;
  workHours?: string;
  createdAt: string;
  courierCompany?: string;
  averageQuantity?: string;
  vehicleType?: string;
  scheduledDate?: string;
  scheduledDateEnd?: string;
  campAddress?: string;
  deliveryGuideUrl?: string;
  deliveryGuide?: string;
  deliveryLat?: string;
  deliveryLng?: string;
  deliveryArea?: string;
  mapImageUrl?: string;
  regionMapUrl?: string;
  matchedHelperId?: string;
  assignedHelperId?: string;
  helperId?: string;
}

interface ClosingReport {
  id: number;
  orderId: number;
  status: string;
  rejectReason?: string | null;
  rejectCategory?: string | null;
  revisionNote?: string | null;
  deliveredCount?: number;
  returnedCount?: number;
}

export default function JobDetailScreen({ navigation, route }: JobDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { jobId } = route.params;
  const queryClient = useQueryClient();
  const [mapModalVisible, setMapModalVisible] = useState(false);

  const { data: order, isLoading, error } = useQuery<Order>({
    queryKey: [`/api/orders/${jobId}`],
  });

  const { data: closingReport } = useQuery<ClosingReport | null>({
    queryKey: [`/api/orders/${jobId}/closing-report`],
    enabled: !!order && ['closing_submitted', 'in_progress'].includes(order.status),
  });

  const isAssignedHelper = order && user && 
    (order.matchedHelperId === user.id || order.assignedHelperId === user.id || order.helperId === user.id);

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/orders/${jobId}/applications`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${jobId}`] });
      if (Platform.OS === 'web') {
        alert('지원이 완료되었습니다!');
      } else {
        Alert.alert('지원 완료', '지원이 완료되었습니다. 요청자가 확인 후 연락드릴 예정입니다.');
      }
      navigation.goBack();
    },
    onError: (err: Error) => {
      const message = err.message || '지원에 실패했습니다.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('오류', message);
      }
    },
  });

  const startWorkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/orders/${jobId}/start`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${jobId}`] });
      if (Platform.OS === 'web') {
        alert('업무를 시작했습니다!');
      } else {
        Alert.alert('업무 시작', '업무가 시작되었습니다. 마감 후 마감자료를 제출해주세요.');
      }
    },
    onError: (err: Error) => {
      const message = err.message || '업무 시작에 실패했습니다.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('오류', message);
      }
    },
  });

  const formatCurrency = (amount?: number, suffix: string = '') => {
    if (!amount) return '협의';
    return new Intl.NumberFormat('ko-KR').format(amount) + '원' + suffix;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return '-';
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'awaiting_deposit': '계약금대기',
      'open': '지원가능',
      'scheduled': '배차완료',
      'in_progress': '업무중',
      'closing_submitted': '마감제출',
      'final_amount_confirmed': '최종금액확정',
      'balance_paid': '잔금완료',
      'settlement_paid': '정산완료',
      'closed': '완료',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registered': return BrandColors.helper;
      case 'matching': return BrandColors.info;
      case 'scheduled': return BrandColors.scheduled;
      case 'in_progress': return BrandColors.inProgress;
      default: return BrandColors.helper;
    }
  };

  const isHelperVerified = user?.role === 'helper' && user?.helperVerified === true;
  const onboardingStatus = user?.onboardingStatus;
  
  const handleApply = () => {
    if (user?.role === 'helper') {
      if (onboardingStatus === 'pending') {
        if (Platform.OS === 'web') {
          alert('서류 제출이 필요합니다. 프로필에서 서류를 제출해주세요.');
        } else {
          Alert.alert(
            '서류 제출 필요',
            '오더 신청을 위해 서류 제출이 필요합니다.\n프로필 > 서류제출에서 서류를 등록해주세요.',
            [
              { text: '취소', style: 'cancel' },
              { text: '서류 제출하기', onPress: () => navigation.navigate('HelperOnboarding' as any) },
            ]
          );
        }
        return;
      }
      if (onboardingStatus === 'submitted') {
        if (Platform.OS === 'web') {
          alert('서류 심사 중입니다. 승인 후 오더 신청이 가능합니다.');
        } else {
          Alert.alert('심사 중', '서류 심사가 진행 중입니다.\n승인 완료 후 오더 신청이 가능합니다.');
        }
        return;
      }
      if (onboardingStatus === 'rejected') {
        if (Platform.OS === 'web') {
          alert('서류가 반려되었습니다. 서류를 다시 제출해주세요.');
        } else {
          Alert.alert(
            '서류 반려',
            '서류가 반려되었습니다.\n프로필 > 서류제출에서 서류를 다시 등록해주세요.',
            [
              { text: '취소', style: 'cancel' },
              { text: '서류 재제출', onPress: () => navigation.navigate('HelperOnboarding' as any) },
            ]
          );
        }
        return;
      }
    }
    applyMutation.mutate();
  };

  const openMap = () => {
    if (order?.deliveryLat && order?.deliveryLng) {
      const url = Platform.select({
        ios: `maps://app?daddr=${order.deliveryLat},${order.deliveryLng}`,
        android: `geo:${order.deliveryLat},${order.deliveryLng}?q=${order.deliveryLat},${order.deliveryLng}`,
        default: `https://maps.google.com/?q=${order.deliveryLat},${order.deliveryLng}`,
      });
      Linking.openURL(url);
    } else if (order?.deliveryArea || order?.deliveryAddress) {
      const address = order.deliveryArea || order.deliveryAddress || '';
      const encodedAddress = encodeURIComponent(address);
      const url = `https://map.kakao.com/?q=${encodedAddress}`;
      Linking.openURL(url);
    }
  };

  const copyAddress = async (address: string) => {
    try {
      await Clipboard.setStringAsync(address);
      if (Platform.OS === 'web') {
        alert('주소가 복사되었습니다');
      } else {
        Alert.alert('복사 완료', '주소가 클립보드에 복사되었습니다');
      }
    } catch (e) {
      console.error('Failed to copy address:', e);
    }
  };

  const openDeliveryGuide = () => {
    if (order?.deliveryGuideUrl) {
      Linking.openURL(order.deliveryGuideUrl);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          정보를 불러오는 중...
        </ThemedText>
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <Icon name="alert-circle-outline" size={48} color={BrandColors.error} />
        <ThemedText style={[styles.loadingText, { color: theme.text }]}>
          일거리를 찾을 수 없습니다
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

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingBottom: insets.bottom + 80,
          paddingHorizontal: Spacing.lg,
        }}
      >
        <View style={styles.header}>
          {order.courierCompany ? (
            <View style={[styles.categoryBadge, { backgroundColor: BrandColors.helperLight }]}>
              <ThemedText style={[styles.categoryText, { color: BrandColors.helper }]}>
                {order.courierCompany}
              </ThemedText>
            </View>
          ) : null}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
            <ThemedText style={[styles.statusText, { color: getStatusColor(order.status) }]}>
              {getStatusLabel(order.status)}
            </ThemedText>
          </View>
        </View>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>평균수량</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                {order.averageQuantity || '-'}
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>단가</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: BrandColors.helper }]}>
                {formatCurrency(order.pricePerUnit || order.dailyRate)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>요청날짜</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                {formatDate(order.scheduledDate)}
                {order.scheduledDateEnd ? ` ~ ${formatDate(order.scheduledDateEnd)}` : ''}
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>차종</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                {order.vehicleType || '-'}
              </ThemedText>
            </View>
          </View>
        </Card>

        <Card style={styles.infoCard}>
          {order.campAddress ? (
            <>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Icon name="home-outline" size={18} color={theme.tabIconDefault} />
                  <View style={styles.infoContent}>
                    <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>캠프주소</ThemedText>
                    <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                      {order.campAddress}
                    </ThemedText>
                  </View>
                </View>
                <Pressable 
                  style={styles.copyButton}
                  onPress={() => copyAddress(order.campAddress!)}
                >
                  <Icon name="copy-outline" size={16} color={BrandColors.helper} />
                </Pressable>
              </View>
              <View style={styles.divider} />
            </>
          ) : null}

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Icon name="navigation" size={18} color={theme.tabIconDefault} />
              <View style={styles.infoContent}>
                <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>배송지</ThemedText>
                <ThemedText style={[styles.infoValue, { color: theme.text }]}>
                  {order.deliveryArea || order.deliveryAddress || '미정'}
                </ThemedText>
              </View>
            </View>
            {(order.deliveryArea || order.deliveryAddress) ? (
              <Pressable 
                style={styles.copyButton}
                onPress={() => copyAddress(order.deliveryArea || order.deliveryAddress || '')}
              >
                <Icon name="copy-outline" size={16} color={BrandColors.helper} />
              </Pressable>
            ) : null}
          </View>

          {(order.regionMapUrl || order.mapImageUrl) ? (
            <>
              <View style={styles.divider} />
              <Pressable onPress={() => setMapModalVisible(true)}>
                <Image 
                  source={{ uri: order.regionMapUrl || order.mapImageUrl }}
                  style={styles.mapPreview}
                  resizeMode="cover"
                />
                <View style={styles.mapOverlay}>
                  <Icon name="arrow-expand" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.mapOverlayText}>탭하여 확대</ThemedText>
                </View>
              </Pressable>
            </>
          ) : null}
        </Card>

        {(order.deliveryGuide || order.deliveryGuideUrl) ? (
          <Card style={styles.guideCard}>
            <View style={styles.guideHeader}>
              <Icon name="document-text-outline" size={18} color={BrandColors.helper} />
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>배송 가이드</ThemedText>
            </View>
            {order.deliveryGuide ? (
              <ThemedText style={[styles.guideText, { color: theme.text }]}>
                {order.deliveryGuide}
              </ThemedText>
            ) : null}
            {order.deliveryGuideUrl && !order.deliveryGuide ? (
              <Pressable 
                style={styles.guideButton}
                onPress={openDeliveryGuide}
              >
                <Icon name="open-in-new" size={16} color={BrandColors.helper} />
                <ThemedText style={[styles.guideButtonText, { color: BrandColors.helper }]}>
                  가이드 보기
                </ThemedText>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {order.description ? (
          <Card style={styles.descriptionCard}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>상세 설명</ThemedText>
            <ThemedText style={[styles.description, { color: theme.tabIconDefault }]}>
              {order.description}
            </ThemedText>
          </Card>
        ) : null}

        {order.requirements ? (
          <Card style={styles.requirementsCard}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>요구사항</ThemedText>
            <ThemedText style={[styles.requirements, { color: theme.tabIconDefault }]}>
              {order.requirements}
            </ThemedText>
          </Card>
        ) : null}

        {closingReport?.status === 'rejected' && closingReport.rejectReason ? (
          <Card style={StyleSheet.flatten([styles.requirementsCard, styles.rejectedCard])}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
              <Icon name="alert-circle-outline" size={18} color="#EF4444" />
              <ThemedText style={[styles.sectionTitle, { color: '#EF4444' }]}>마감자료 반려</ThemedText>
            </View>
            {closingReport.rejectCategory ? (
              <ThemedText style={[styles.requirements, { color: theme.tabIconDefault, marginBottom: Spacing.xs }]}>
                반려 사유: {closingReport.rejectCategory}
              </ThemedText>
            ) : null}
            <ThemedText style={[styles.requirements, { color: theme.text }]}>
              {closingReport.rejectReason}
            </ThemedText>
            {closingReport.revisionNote ? (
              <ThemedText style={[styles.requirements, { color: theme.tabIconDefault, marginTop: Spacing.sm, fontStyle: 'italic' }]}>
                수정 안내: {closingReport.revisionNote}
              </ThemedText>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.backgroundRoot }]}>
        {order.status === 'scheduled' && isAssignedHelper ? (
          <View style={styles.footerRow}>
            <Pressable
              testID="button-qr-checkin"
              style={({ pressed }) => [
                styles.qrButton,
                { backgroundColor: BrandColors.helper, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => navigation.navigate('QRScanner' as any, { orderId: String(order.id), type: 'start_work' })}
            >
              <Icon name="camera-outline" size={20} color="#FFFFFF" />
              <ThemedText style={styles.applyButtonText}>QR 체크인</ThemedText>
            </Pressable>
            <Pressable
              testID="button-start-work"
              style={({ pressed }) => [
                styles.applyButton,
                { backgroundColor: theme.tabIconDefault, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => startWorkMutation.mutate()}
              disabled={startWorkMutation.isPending}
            >
              {startWorkMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.applyButtonText}>QR 없이 시작</ThemedText>
              )}
            </Pressable>
          </View>
        ) : order.status === 'in_progress' && isAssignedHelper ? (
          <Pressable
            testID="button-submit-closing"
            style={({ pressed }) => [
              styles.applyButton,
              { backgroundColor: BrandColors.helper, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => navigation.navigate('ClosingReport' as any, { orderId: order.id })}
          >
            <ThemedText style={styles.applyButtonText}>마감 제출</ThemedText>
          </Pressable>
        ) : ['open', 'matching', 'registered'].includes(order.status) ? (
          <View style={styles.footerRow}>
            <Pressable
              testID="button-apply"
              style={({ pressed }) => [
                styles.applyButton,
                { backgroundColor: BrandColors.helper, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleApply}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.applyButtonText}>신청</ThemedText>
              )}
            </Pressable>
            <Pressable
              testID="button-close"
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => navigation.goBack()}
            >
              <ThemedText style={[styles.closeButtonText, { color: theme.text }]}>닫기</ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable
            testID="button-close-only"
            style={({ pressed }) => [
              styles.applyButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={[styles.applyButtonText, { color: theme.text }]}>닫기</ThemedText>
          </Pressable>
        )}
      </View>

      <Modal
        visible={mapModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMapModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setMapModalVisible(false)}
        >
          <View style={styles.modalContent}>
            {(order?.regionMapUrl || order?.mapImageUrl) ? (
              <Image
                source={{ uri: order.regionMapUrl || order.mapImageUrl }}
                style={styles.modalMapImage}
                resizeMode="contain"
              />
            ) : null}
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setMapModalVisible(false)}
            >
              <Icon name="close-outline" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
    gap: Spacing.lg,
  },
  loadingText: {
    ...Typography.body,
  },
  backButton: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  backButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  categoryText: {
    ...Typography.small,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  statusText: {
    ...Typography.small,
    fontWeight: '600',
  },
  summaryCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    ...Typography.small,
    marginBottom: 2,
  },
  summaryValue: {
    ...Typography.body,
    fontWeight: '600',
  },
  infoCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    flex: 1,
  },
  copyButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    ...Typography.small,
    marginBottom: 2,
  },
  infoValue: {
    ...Typography.body,
    fontWeight: '500',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  mapButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: Spacing.md,
  },
  guideCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  guideText: {
    ...Typography.body,
    lineHeight: 24,
  },
  guideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: BrandColors.helper,
  },
  guideButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  descriptionCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.body,
    lineHeight: 24,
  },
  requirementsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  rejectedCard: {
    borderColor: '#EF4444',
    borderWidth: 1,
  },
  requirements: {
    ...Typography.body,
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  qrButton: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
  closeButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  closeButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  mapPreview: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F0F0F0',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  mapOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: screenWidth - Spacing['2xl'] * 2,
    height: screenWidth - Spacing['2xl'] * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalMapImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.md,
  },
  modalCloseButton: {
    position: 'absolute',
    top: -50,
    right: 0,
    padding: Spacing.md,
  },
});
