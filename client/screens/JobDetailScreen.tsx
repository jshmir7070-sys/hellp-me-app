import React, { useState, useLayoutEffect } from "react";
import { View, ScrollView, Pressable, StyleSheet, Alert, Platform, ActivityIndicator, Linking, Image, Modal, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { OrderCard } from "@/components/order/OrderCard";
import { adaptHelperRecruitmentOrder, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Avatar } from "@/components/Avatar";
import { JobsStackParamList } from "@/navigation/types";
import { apiRequest, getApiUrl } from "@/lib/query-client";

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
  courierCategory?: string;
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
  arrivalTime?: string;
  campAddress?: string;
  campAddressDetail?: string;
  contactPhone?: string;
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
  // 냉탑전용 필드
  freight?: number;
  recommendedFee?: number;
  waypoints?: string;
  loadingPoint?: string;
  loadingPointDetail?: string;
  hasTachometer?: boolean;
  hasPartition?: boolean;
  // 기타택배 필드
  pricingType?: string;
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
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { jobId } = route.params;
  const queryClient = useQueryClient();
  const [mapModalVisible, setMapModalVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const profileImg = user?.profileImageUrl;
  const displayUserName = (user as any)?.nickname || user?.name || '헬퍼';
  const userTeamName = user?.teamName;

  const { data: order, isLoading, error } = useQuery<Order>({
    queryKey: [`/api/orders/${jobId}`],
  });

  const { data: closingReport } = useQuery<ClosingReport | null>({
    queryKey: [`/api/orders/${jobId}/closing-report`],
    enabled: !!order && ['closing_submitted', 'in_progress'].includes(order.status),
  });

  const isAssignedHelper = order && user &&
    (order.matchedHelperId === user.id || order.assignedHelperId === user.id || order.helperId === user.id);

  const orderCardData: OrderCardDTO | null = order
    ? adaptHelperRecruitmentOrder(order)
    : null;

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return '-';
    }
  };

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
              { text: '서류 제출하기', onPress: () => navigation.getParent()?.getParent()?.navigate('HelperOnboarding' as any) },
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
              { text: '서류 재제출', onPress: () => navigation.getParent()?.getParent()?.navigate('HelperOnboarding' as any) },
            ]
          );
        }
        return;
      }
    }
    applyMutation.mutate();
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
      {/* 커스텀 헤더: 프로필 + 팀명 */}
      <View style={[styles.customHeader, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable style={styles.headerBackButton} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerProfileSection}>
          <View style={styles.headerAvatarWrap}>
            {profileImg ? (
              profileImg.startsWith('avatar:') ? (
                <Avatar uri={profileImg} size={32} isHelper={true} />
              ) : (
                <Image
                  source={{ uri: profileImg.startsWith('/') ? `${getApiUrl()}${profileImg}` : profileImg }}
                  style={styles.headerAvatarImage}
                />
              )
            ) : (
              <Icon name="person" size={18} color="#FFFFFF" />
            )}
          </View>
          <View>
            <ThemedText style={styles.headerUserName} numberOfLines={1}>{displayUserName}</ThemedText>
            {userTeamName ? (
              <ThemedText style={styles.headerTeamName} numberOfLines={1}>{userTeamName}</ThemedText>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
      >
        {/* 상단: 오더카드 (오더공고 리스트와 동일) */}
        {orderCardData ? (
          <OrderCard
            data={orderCardData}
            context="helper_recruitment"
          />
        ) : null}

        {/* 하단: 상세 정보 */}
        {order.campAddress ? (
          <Card style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Icon name="home-outline" size={16} color={theme.tabIconDefault} />
              <ThemedText style={[styles.detailLabel, { color: theme.tabIconDefault }]}>캠프 및 터미널</ThemedText>
              <Pressable
                style={styles.copyButton}
                onPress={() => copyAddress(order.campAddress!)}
              >
                <Icon name="copy-outline" size={14} color={BrandColors.helper} />
              </Pressable>
            </View>
            <ThemedText style={[styles.detailValue, { color: theme.text }]}>
              {order.campAddress}
            </ThemedText>
            {order.campAddressDetail ? (
              <ThemedText style={[styles.detailValue, { color: theme.tabIconDefault, fontSize: 13 }]}>
                {order.campAddressDetail}
              </ThemedText>
            ) : null}
          </Card>
        ) : null}

        {/* 냉탑전용: 상차지 + 경유지 */}
        {order.courierCategory === 'cold' && order.loadingPoint ? (
          <Card style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Icon name="location-outline" size={16} color={theme.tabIconDefault} />
              <ThemedText style={[styles.detailLabel, { color: theme.tabIconDefault }]}>상차지</ThemedText>
              <Pressable style={styles.copyButton} onPress={() => copyAddress(order.loadingPoint!)}>
                <Icon name="copy-outline" size={14} color={BrandColors.helper} />
              </Pressable>
            </View>
            <ThemedText style={[styles.detailValue, { color: theme.text }]}>
              {order.loadingPoint}{order.loadingPointDetail ? ` ${order.loadingPointDetail}` : ''}
            </ThemedText>
            {order.waypoints ? (
              <View style={{ marginTop: Spacing.sm }}>
                <ThemedText style={[styles.detailLabel, { color: theme.tabIconDefault, marginBottom: 4 }]}>경유지</ThemedText>
                {(() => {
                  try {
                    const wp = JSON.parse(order.waypoints);
                    return Array.isArray(wp) ? wp.map((w: string, i: number) => (
                      <ThemedText key={i} style={[styles.detailValue, { color: theme.text, marginBottom: 2 }]}>
                        {i + 1}. {w}
                      </ThemedText>
                    )) : null;
                  } catch { return null; }
                })()}
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* 냉탑전용: 운임 + 수수료 + 차량 옵션 */}
        {order.courierCategory === 'cold' ? (
          <Card style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Icon name="cash-outline" size={16} color={theme.tabIconDefault} />
              <ThemedText style={[styles.detailLabel, { color: theme.tabIconDefault }]}>운임 정보</ThemedText>
            </View>
            {order.freight ? (
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailRowLabel, { color: theme.tabIconDefault }]}>운임</ThemedText>
                <ThemedText style={[styles.detailRowValue, { color: theme.text }]}>
                  {new Intl.NumberFormat('ko-KR').format(order.freight)}원
                </ThemedText>
              </View>
            ) : null}
            {order.recommendedFee ? (
              <View style={styles.detailRow}>
                <ThemedText style={[styles.detailRowLabel, { color: theme.tabIconDefault }]}>권장 수수료</ThemedText>
                <ThemedText style={[styles.detailRowValue, { color: theme.text }]}>
                  {new Intl.NumberFormat('ko-KR').format(order.recommendedFee)}원
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <ThemedText style={[styles.detailRowLabel, { color: theme.tabIconDefault }]}>타코미터</ThemedText>
              <ThemedText style={[styles.detailRowValue, { color: theme.text }]}>{order.hasTachometer ? '있음' : '없음'}</ThemedText>
            </View>
            <View style={styles.detailRow}>
              <ThemedText style={[styles.detailRowLabel, { color: theme.tabIconDefault }]}>칸막이</ThemedText>
              <ThemedText style={[styles.detailRowValue, { color: theme.text }]}>{order.hasPartition ? '있음' : '없음'}</ThemedText>
            </View>
          </Card>
        ) : null}

        {/* 담당자 연락처 */}
        {order.contactPhone ? (
          <Card style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Icon name="call-outline" size={16} color={theme.tabIconDefault} />
              <ThemedText style={[styles.detailLabel, { color: theme.tabIconDefault }]}>담당자 연락처</ThemedText>
            </View>
            <ThemedText style={[styles.detailValue, { color: theme.text }]}>{order.contactPhone}</ThemedText>
          </Card>
        ) : null}

        <Card style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Icon name="time-outline" size={16} color={theme.tabIconDefault} />
            <ThemedText style={[styles.detailLabel, { color: theme.tabIconDefault }]}>입차시간</ThemedText>
          </View>
          <ThemedText style={[styles.detailValue, { color: theme.text }]}>
            {formatDate(order.scheduledDate)}
            {order.scheduledDateEnd ? ` ~ ${formatDate(order.scheduledDateEnd)}` : ''}
          </ThemedText>
          {order.arrivalTime ? (
            <ThemedText style={[styles.arrivalTimeText, { color: BrandColors.helper }]}>
              입차 {order.arrivalTime}
            </ThemedText>
          ) : null}
        </Card>

        {(order.deliveryGuide || order.deliveryGuideUrl) ? (
          <Card style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Icon name="document-text-outline" size={16} color={theme.tabIconDefault} />
              <ThemedText style={[styles.detailLabel, { color: theme.tabIconDefault }]}>배송가이드</ThemedText>
            </View>
            {order.deliveryGuide ? (
              <ThemedText style={[styles.detailValue, { color: theme.text }]}>
                {order.deliveryGuide}
              </ThemedText>
            ) : null}
            {order.deliveryGuideUrl ? (
              <Pressable
                style={styles.guideLink}
                onPress={openDeliveryGuide}
              >
                <Icon name="open-in-new" size={14} color={BrandColors.helper} />
                <ThemedText style={{ color: BrandColors.helper, fontSize: 13, fontWeight: '600' }}>
                  가이드 보기
                </ThemedText>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Icon name="map-outline" size={16} color={theme.tabIconDefault} />
            <ThemedText style={[styles.detailLabel, { color: theme.tabIconDefault }]}>배송지역지도</ThemedText>
          </View>
          {(order.regionMapUrl || order.mapImageUrl) ? (
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
          ) : (
            <View style={styles.mapEmpty}>
              <Icon name="image-outline" size={32} color={theme.tabIconDefault} />
              <ThemedText style={[styles.mapEmptyText, { color: theme.tabIconDefault }]}>
                배송지도 없음
              </ThemedText>
            </View>
          )}
        </Card>

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

      <View style={[styles.footer, { paddingBottom: tabBarHeight + Spacing.xl, backgroundColor: theme.backgroundRoot }]}>
        {order.status === 'scheduled' && isAssignedHelper ? (
          <View style={styles.footerRow}>
            <Pressable
              testID="button-qr-checkin"
              style={({ pressed }) => [
                styles.qrButton,
                { backgroundColor: BrandColors.helper, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={() => navigation.getParent()?.getParent()?.navigate('QRScanner' as any, { orderId: String(order.id), type: 'start_work' })}
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
            onPress={() => navigation.navigate('ClosingReport', { orderId: order.id })}
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
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.helper,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  headerBackButton: {
    padding: Spacing.xs,
  },
  headerProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerAvatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerTeamName: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
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
  detailCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailRowLabel: {
    fontSize: 13,
  },
  detailRowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  arrivalTimeText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  guideLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  copyButton: {
    padding: Spacing.xs,
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
  mapEmpty: {
    width: '100%',
    height: 120,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  mapEmptyText: {
    fontSize: 13,
    fontWeight: '500',
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
