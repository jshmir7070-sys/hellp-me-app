import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { View, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator, ScrollView, Modal, Alert, Platform, Image, Linking, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Icon } from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useResponsive } from "@/hooks/useResponsive";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { OrderCard } from "@/components/order/OrderCard";
import { EditOrderModal } from "@/components/order/EditOrderModal";
import { adaptHelperMyOrder, adaptRequesterOrder, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { Avatar } from "@/components/Avatar";
import { HelperCard } from "@/components/HelperCard";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useOrderWebSocket } from "@/hooks/useOrderWebSocket";
import { BannerAdCarousel } from "@/components/BannerAdCarousel";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

interface Applicant {
  id: number;
  helperId: string;
  helperName: string;
  helperNickname?: string | null;
  helperPhone?: string;
  category?: string;
  teamName?: string | null;
  completedJobs?: number;
  reviewCount: number;
  averageRating: number | null;
  status: string;
  profileImageUrl?: string | null;
  profileImage?: string | null;
  appliedAt?: string;
  message?: string;
  expectedArrival?: string;
  reviews?: Array<{
    id: number;
    rating: number;
    comment?: string;
    createdAt: string;
    requesterName?: string;
  }>;
  recentReviews?: Array<{
    id: number;
    rating: number;
    comment?: string;
    createdAt: string;
    requesterName?: string;
  }>;
}

// SCREEN_WIDTH는 제거 — useResponsive().contentWidth 사용

interface DashboardStats {
  monthlyEarnings?: number;
  completedCount?: number;
  inProgressCount?: number;
  activeHelpers?: number;
  todayDeliveries?: number;
}

interface ScheduledOrder {
  id: number;
  title: string;
  companyName?: string;
  dailyRate?: number;
  workDate: string;
  workEndDate?: string;
  scheduledDate?: string;
  scheduledDateEnd?: string;
  startTime?: string;
  endTime?: string;
  pickupAddress?: string;
  status: string;
}

interface Contract {
  id: number;
  helperName?: string;
  orderTitle?: string;
  status: string;
  startDate?: string;
}

type HomeScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface PopupAnnouncement {
  id: number;
  title: string;
  content: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  isPopup: boolean;
  type?: string; // "notice" | "ad"
  priority?: string;
  createdAt: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, refreshUser } = useAuth();

  // WebSocket 연결 (실시간 오더 + 온보딩 상태 업데이트)
  useOrderWebSocket({ onOnboardingUpdate: refreshUser });
  const { isDesktop, isTablet, isMobile, containerMaxWidth, contentWidth, showDesktopLayout, columns } = useResponsive();

  const [editOrder, setEditOrder] = useState<any>(null);

  // 팝업 공지 상태
  const [popupVisible, setPopupVisible] = useState(false);
  const [currentPopupIndex, setCurrentPopupIndex] = useState(0);
  const [dismissedToday, setDismissedToday] = useState<Record<number, boolean>>({});
  // 공지/광고 분리 상태
  const [popupPhase, setPopupPhase] = useState<'notice' | 'ad'>('notice');
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [adsDismissedToday, setAdsDismissedToday] = useState(false);
  const adScrollRef = useRef<ScrollView>(null);
  const adTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const AD_CAROUSEL_WIDTH = Math.min(360, Dimensions.get('window').width - Spacing.xl * 2);

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;
  
  const showOnboardingBanner = isHelper && user?.onboardingStatus !== 'approved';

  const { data: helperStats, isLoading: isLoadingHelperStats, refetch: refetchHelperStats } = useQuery<any>({
    queryKey: ['/api/helper/work-history', { limit: 10 }],
    enabled: isHelper,
  });

  const { data: requesterOrders, isLoading: isLoadingRequesterOrders, refetch: refetchRequesterOrders } = useQuery<any[]>({
    queryKey: ['/api/requester/orders'],
    enabled: !isHelper,
  });

  const stats = useMemo<DashboardStats>(() => {
    if (isHelper && helperStats) {
      const records = Array.isArray(helperStats) ? helperStats : [];
      return {
        monthlyEarnings: records.reduce((sum: number, r: any) => sum + (r.dailyRate || 0), 0),
        completedCount: records.filter((r: any) => ['closed', 'settlement_paid'].includes(r.status)).length,
        inProgressCount: records.filter((r: any) => r.status === 'in_progress').length,
      };
    } else if (!isHelper && requesterOrders) {
      const orders = Array.isArray(requesterOrders) ? requesterOrders : [];
      return {
        activeHelpers: orders.filter((o: any) => o.status === 'in_progress').length,
        todayDeliveries: orders.filter((o: any) => ['closed', 'settlement_paid'].includes(o.status)).length,
        inProgressCount: orders.filter((o: any) => ['open', 'scheduled'].includes(o.status)).length,
      };
    }
    return {};
  }, [isHelper, helperStats, requesterOrders]);

  const isLoadingStats = isHelper ? isLoadingHelperStats : isLoadingRequesterOrders;
  const [isRefetching, setIsRefetching] = useState(false);

  const refetchStats = useCallback(async () => {
    setIsRefetching(true);
    try {
      if (isHelper) {
        await refetchHelperStats?.();
        await refetchScheduled?.();
      } else {
        await refetchRequesterOrders?.();
      }
    } finally {
      setIsRefetching(false);
    }
  }, [isHelper]);

  const { data: scheduledOrdersRaw = [], refetch: refetchScheduled } = useQuery<any[]>({
    queryKey: ['/api/orders/scheduled'],
    enabled: isHelper,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  
  const scheduledOrders: ScheduledOrder[] = useMemo(() => {
    return scheduledOrdersRaw.map((order: any) => ({
      ...order,
      workDate: order.workDate || order.scheduledDate || '',
      workEndDate: order.workEndDate || order.scheduledDateEnd,
    }));
  }, [scheduledOrdersRaw]);

  const { data: recentContracts = [] } = useQuery<Contract[]>({
    queryKey: ['/api/contracts?limit=3'],
    enabled: !isHelper,
  });

  // ===== 팝업 공지사항 =====
  const { data: popupAnnouncements = [] } = useQuery<PopupAnnouncement[]>({
    queryKey: ['/api/announcements/popups'],
    staleTime: 5 * 60 * 1000,
  });

  const getTodayDate = useCallback(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // AsyncStorage에서 오늘 dismiss한 공지/광고 ID 로드
  useEffect(() => {
    const loadDismissed = async () => {
      try {
        const today = getTodayDate();
        const key = `popup_dismissed_${today}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          setDismissedToday(JSON.parse(stored));
        }
        // 광고 그룹 dismiss 로드
        const adKey = `ad_dismissed_${today}`;
        const adStored = await AsyncStorage.getItem(adKey);
        if (adStored === 'true') {
          setAdsDismissedToday(true);
        }
      } catch (e) {
        console.error("Failed to load dismissed popups:", e);
      }
    };
    loadDismissed();
  }, [getTodayDate]);

  // 공지와 광고를 분리
  const visibleNotices = useMemo(() => {
    return popupAnnouncements.filter(a => (a.type || 'notice') !== 'ad' && !dismissedToday[a.id]);
  }, [popupAnnouncements, dismissedToday]);

  const visibleAds = useMemo(() => {
    if (adsDismissedToday) return [];
    return popupAnnouncements.filter(a => a.type === 'ad');
  }, [popupAnnouncements, adsDismissedToday]);

  // 팝업 표시 트리거: 공지 먼저 → 공지 없으면 광고
  useEffect(() => {
    if (visibleNotices.length > 0 && !popupVisible) {
      setPopupPhase('notice');
      setCurrentPopupIndex(0);
      setPopupVisible(true);
    } else if (visibleNotices.length === 0 && visibleAds.length > 0 && !popupVisible && !adsDismissedToday) {
      setPopupPhase('ad');
      setCurrentAdIndex(0);
      setPopupVisible(true);
    }
  }, [visibleNotices.length, visibleAds.length, adsDismissedToday]);

  const currentPopup: PopupAnnouncement | null = visibleNotices.length > 0 && currentPopupIndex < visibleNotices.length
    ? visibleNotices[currentPopupIndex]
    : null;

  // 공지: 건당 "오늘 하루 안보기"
  const handleDismissToday = useCallback(async (announcementId: number) => {
    try {
      const key = `popup_dismissed_${getTodayDate()}`;
      const newDismissed = { ...dismissedToday, [announcementId]: true };
      setDismissedToday(newDismissed);
      await AsyncStorage.setItem(key, JSON.stringify(newDismissed));
    } catch (e) {
      console.error("Failed to save dismissed popup:", e);
    }
    // 다음 공지로 이동 or 광고 phase로 전환 or 닫기
    if (currentPopupIndex < visibleNotices.length - 1) {
      setCurrentPopupIndex(prev => prev + 1);
    } else if (visibleAds.length > 0) {
      setPopupPhase('ad');
      setCurrentAdIndex(0);
    } else {
      setPopupVisible(false);
    }
  }, [dismissedToday, getTodayDate, currentPopupIndex, visibleNotices.length, visibleAds.length]);

  // 공지: 건당 닫기 (다음으로 넘어감)
  const handleClosePopup = useCallback(() => {
    if (popupPhase === 'notice') {
      if (currentPopupIndex < visibleNotices.length - 1) {
        setCurrentPopupIndex(prev => prev + 1);
      } else if (visibleAds.length > 0) {
        setPopupPhase('ad');
        setCurrentAdIndex(0);
      } else {
        setPopupVisible(false);
      }
    } else {
      // 광고 닫기
      setPopupVisible(false);
      if (adTimerRef.current) clearInterval(adTimerRef.current);
    }
  }, [popupPhase, currentPopupIndex, visibleNotices.length, visibleAds.length]);

  // 광고: 일괄 "오늘 하루 안보기"
  const handleDismissAdsToday = useCallback(async () => {
    try {
      const adKey = `ad_dismissed_${getTodayDate()}`;
      await AsyncStorage.setItem(adKey, 'true');
      setAdsDismissedToday(true);
    } catch (e) {
      console.error("Failed to save ad dismissal:", e);
    }
    setPopupVisible(false);
    if (adTimerRef.current) clearInterval(adTimerRef.current);
  }, [getTodayDate]);

  // 광고: 닫기
  const handleCloseAds = useCallback(() => {
    setPopupVisible(false);
    if (adTimerRef.current) clearInterval(adTimerRef.current);
  }, []);

  const handlePopupImagePress = useCallback((popup: PopupAnnouncement) => {
    if (popup.linkUrl) {
      if (popup.linkUrl.startsWith('http')) {
        Linking.openURL(popup.linkUrl);
      } else {
        navigation.navigate(popup.linkUrl as any);
      }
      setPopupVisible(false);
      if (adTimerRef.current) clearInterval(adTimerRef.current);
    }
  }, [navigation]);

  // 광고 자동 슬라이드 타이머
  useEffect(() => {
    if (popupPhase === 'ad' && popupVisible && visibleAds.length > 1) {
      adTimerRef.current = setInterval(() => {
        setCurrentAdIndex(prev => {
          const next = (prev + 1) % visibleAds.length;
          adScrollRef.current?.scrollTo({ x: next * AD_CAROUSEL_WIDTH, animated: true });
          return next;
        });
      }, 3500);

      return () => {
        if (adTimerRef.current) clearInterval(adTimerRef.current);
      };
    }
  }, [popupPhase, popupVisible, visibleAds.length, AD_CAROUSEL_WIDTH]);
  // ===== 팝업 공지사항 끝 =====

  const formatCurrency = (amount?: number) => {
    if (!amount) return '0원';
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const getOnboardingBannerContent = () => {
    if (!showOnboardingBanner) return null;
    switch (user?.onboardingStatus) {
      case 'pending':
        return {
          icon: 'file-document-outline' as const,
          title: '서류 제출이 필요합니다',
          message: '오더 신청을 위해 필수 서류를 제출해주세요.',
          buttonText: '서류 제출하기',
          color: BrandColors.warning,
        };
      case 'submitted':
        return {
          icon: 'clock-outline' as const,
          title: '서류 심사 중',
          message: '서류 심사가 진행 중입니다. 승인 완료 후 오더 신청이 가능합니다.',
          buttonText: '',
          color: BrandColors.info,
        };
      case 'rejected':
        return {
          icon: 'alert-circle-outline' as const,
          title: '서류가 반려되었습니다',
          message: '서류를 확인하고 다시 제출해주세요.',
          buttonText: '서류 재제출',
          color: BrandColors.error,
        };
      default:
        return null;
    }
  };

  const renderHeader = () => {
    const bannerContent = getOnboardingBannerContent();
    
    return (
    <View style={styles.headerContent}>
      <View style={styles.welcomeSection}>
        <ThemedText style={[styles.welcomeText, { color: theme.text }]}>
          안녕하세요, {user?.name || '사용자'}님
        </ThemedText>
        <View style={[styles.roleBadge, { backgroundColor: isHelper ? BrandColors.helperLight : BrandColors.requesterLight }]}>
          <ThemedText style={[styles.roleBadgeText, { color: primaryColor }]}>
            {isHelper ? '헬퍼' : '요청자'}
          </ThemedText>
        </View>
      </View>

      {bannerContent ? (
        <Pressable 
          style={[styles.onboardingBanner, { backgroundColor: bannerContent.color + '15', borderColor: bannerContent.color }]}
          onPress={bannerContent.buttonText ? () => navigation.navigate('DocumentsMenu' as any) : undefined}
        >
          <View style={styles.onboardingBannerContent}>
            <Icon name={bannerContent.icon} size={24} color={bannerContent.color} />
            <View style={styles.onboardingBannerText}>
              <ThemedText style={[styles.onboardingBannerTitle, { color: bannerContent.color }]}>
                {bannerContent.title}
              </ThemedText>
              <ThemedText style={[styles.onboardingBannerMessage, { color: theme.tabIconDefault }]}>
                {bannerContent.message}
              </ThemedText>
            </View>
            {bannerContent.buttonText ? (
              <Icon name="chevron-forward-outline" size={20} color={bannerContent.color} />
            ) : null}
          </View>
        </Pressable>
      ) : null}

      {isLoadingStats ? (
        <Card style={styles.statsCard}>
          <ActivityIndicator size="small" color={primaryColor} />
        </Card>
      ) : isHelper ? (
        <HelperDashboard
          theme={theme}
          primaryColor={primaryColor}
          stats={stats}
          scheduledOrders={scheduledOrders}
          formatCurrency={formatCurrency}
          contentWidth={contentWidth}
          showDesktopLayout={showDesktopLayout}
          columns={columns}
          navigation={navigation}
          onNavigateDetail={(orderId) => {
            navigation.navigate('JobDetail' as any, { jobId: String(orderId) });
          }}
        />
      ) : (
        <RequesterDashboard
          theme={theme}
          primaryColor={primaryColor}
          contentWidth={contentWidth}
          showDesktopLayout={showDesktopLayout}
          columns={columns}
          orders={requesterOrders || []}
          navigation={navigation}
          onEditOrder={setEditOrder}
          onNavigateDetail={(orderId) => {
            navigation.navigate('JobDetail' as any, { jobId: String(orderId) });
          }}
        />
      )}
    </View>
  );
  };

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: showDesktopLayout ? Spacing['3xl'] : tabBarHeight + Spacing['3xl'],
          paddingHorizontal: showDesktopLayout ? Spacing['2xl'] : Spacing.lg,
          ...(showDesktopLayout && {
            maxWidth: Math.min(containerMaxWidth, 960),
            alignSelf: 'center' as const,
            width: '100%' as any,
          }),
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={[]}
        renderItem={() => null}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetchStats()}
            tintColor={primaryColor}
          />
        }
      />
      <EditOrderModal
        visible={!!editOrder}
        onClose={() => setEditOrder(null)}
        orderId={editOrder?.id || 0}
        currentUnitPrice={editOrder?.pricePerUnit}
        currentDate={editOrder?.scheduledDate}
      />

      {/* 팝업 공지/광고 모달 */}
      {popupVisible ? (
        <Modal
          visible={popupVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={popupPhase === 'notice' ? handleClosePopup : handleCloseAds}
        >
          <View style={popupStyles.overlay}>
            <View style={popupStyles.container}>
              {/* ===== 공지 Phase: 건당 닫기 ===== */}
              {popupPhase === 'notice' && currentPopup ? (
                <>
                  {currentPopup.imageUrl ? (
                    <Pressable
                      onPress={() => handlePopupImagePress(currentPopup)}
                      style={popupStyles.imageWrap}
                    >
                      <ExpoImage
                        source={{ uri: `${getApiUrl().replace(/\/$/, '')}${currentPopup.imageUrl}` }}
                        style={popupStyles.image}
                        contentFit="cover"
                        transition={300}
                      />
                      {currentPopup.linkUrl ? (
                        <View style={popupStyles.linkBadge}>
                          <Icon name="open-outline" size={14} color="#fff" />
                          <ThemedText style={popupStyles.linkBadgeText}>자세히 보기</ThemedText>
                        </View>
                      ) : null}
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => handlePopupImagePress(currentPopup)}
                      style={popupStyles.textOnlyWrap}
                    >
                      <View style={[popupStyles.textOnlyIcon, { backgroundColor: primaryColor + '15' }]}>
                        <Icon name="megaphone-outline" size={32} color={primaryColor} />
                      </View>
                      <ThemedText style={popupStyles.textOnlyTitle}>{currentPopup.title}</ThemedText>
                      <ThemedText style={popupStyles.textOnlyContent}>{currentPopup.content}</ThemedText>
                      {currentPopup.linkUrl ? (
                        <View style={[popupStyles.linkRow, { backgroundColor: primaryColor + '10' }]}>
                          <Icon name="open-outline" size={14} color={primaryColor} />
                          <ThemedText style={[popupStyles.linkRowText, { color: primaryColor }]}>자세히 보기</ThemedText>
                        </View>
                      ) : null}
                    </Pressable>
                  )}

                  {/* 공지 카운터 */}
                  {visibleNotices.length > 1 ? (
                    <View style={popupStyles.counter}>
                      <ThemedText style={popupStyles.counterText}>
                        {currentPopupIndex + 1} / {visibleNotices.length}
                      </ThemedText>
                    </View>
                  ) : null}

                  {/* 공지 하단 버튼 */}
                  <View style={popupStyles.footer}>
                    <Pressable
                      onPress={() => handleDismissToday(currentPopup.id)}
                      style={popupStyles.dismissBtn}
                    >
                      <Icon name="time-outline" size={14} color="#999" />
                      <ThemedText style={popupStyles.dismissText}>오늘 하루 안보기</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={handleClosePopup}
                      style={popupStyles.closeBtn}
                    >
                      <ThemedText style={popupStyles.closeText}>닫기</ThemedText>
                    </Pressable>
                  </View>
                </>
              ) : null}

              {/* ===== 광고 Phase: 자동 슬라이드 캐러셀 ===== */}
              {popupPhase === 'ad' && visibleAds.length > 0 ? (
                <>
                  <ScrollView
                    ref={adScrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={(e) => {
                      const index = Math.round(e.nativeEvent.contentOffset.x / AD_CAROUSEL_WIDTH);
                      setCurrentAdIndex(index);
                      // 수동 스와이프 시 타이머 리셋
                      if (adTimerRef.current) clearInterval(adTimerRef.current);
                      if (visibleAds.length > 1) {
                        adTimerRef.current = setInterval(() => {
                          setCurrentAdIndex(prev => {
                            const next = (prev + 1) % visibleAds.length;
                            adScrollRef.current?.scrollTo({ x: next * AD_CAROUSEL_WIDTH, animated: true });
                            return next;
                          });
                        }, 3500);
                      }
                    }}
                    style={{ width: AD_CAROUSEL_WIDTH }}
                  >
                    {visibleAds.map((ad) => (
                      <Pressable
                        key={ad.id}
                        onPress={() => handlePopupImagePress(ad)}
                        style={{ width: AD_CAROUSEL_WIDTH }}
                      >
                        <ExpoImage
                          source={{ uri: `${getApiUrl().replace(/\/$/, '')}${ad.imageUrl}` }}
                          style={[popupStyles.adImage, { width: AD_CAROUSEL_WIDTH }]}
                          contentFit="cover"
                          transition={300}
                        />
                      </Pressable>
                    ))}
                  </ScrollView>

                  {/* 광고 도트 인디케이터 */}
                  {visibleAds.length > 1 ? (
                    <View style={popupStyles.adDots}>
                      {visibleAds.map((_, idx) => (
                        <View
                          key={idx}
                          style={[
                            popupStyles.adDot,
                            { backgroundColor: idx === currentAdIndex ? '#333' : '#ccc' }
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}

                  {/* 광고 하단 버튼 */}
                  <View style={popupStyles.footer}>
                    <Pressable
                      onPress={handleDismissAdsToday}
                      style={popupStyles.dismissBtn}
                    >
                      <Icon name="time-outline" size={14} color="#999" />
                      <ThemedText style={popupStyles.dismissText}>오늘 하루 안보기</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={handleCloseAds}
                      style={popupStyles.closeBtn}
                    >
                      <ThemedText style={popupStyles.closeText}>닫기</ThemedText>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const ORDER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function SimpleCalendar({ 
  theme, 
  primaryColor,
  scheduledOrders,
  selectedDate,
  onSelectDate,
}: { 
  theme: any; 
  primaryColor: string;
  scheduledOrders: ScheduledOrder[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}) {
  const today = new Date();
  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();

  const scheduledDates = useMemo(() => {
    const dates = new Set<string>();
    scheduledOrders.forEach(order => {
      if (order.workDate) {
        const startDate = new Date(order.workDate);
        const endDate = order.workEndDate ? new Date(order.workEndDate) : startDate;
        const current = new Date(startDate);
        while (current <= endDate) {
          dates.add(current.toISOString().split('T')[0]);
          current.setDate(current.getDate() + 1);
        }
      }
    });
    return dates;
  }, [scheduledOrders]);

  const orderRanges = useMemo(() => {
    return scheduledOrders.map((order, idx) => {
      const startDate = new Date(order.workDate);
      const endDate = order.workEndDate ? new Date(order.workEndDate) : startDate;
      return {
        id: order.id,
        startDate,
        endDate,
        color: ORDER_COLORS[idx % ORDER_COLORS.length],
        title: order.companyName || order.title,
      };
    });
  }, [scheduledOrders]);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];
  
  for (let i = 0; i < firstDay; i++) {
    week.push(null);
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  
  if (week.length > 0) {
    while (week.length < 7) {
      week.push(null);
    }
    weeks.push(week);
  }

  const formatMonthYear = () => {
    return `${currentYear}년 ${currentMonth + 1}월`;
  };

  const goToPrevMonth = () => {
    const newDate = new Date(currentYear, currentMonth - 1, 1);
    onSelectDate(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentYear, currentMonth + 1, 1);
    onSelectDate(newDate);
  };

  const isToday = (day: number) => {
    return day === today.getDate() && 
           currentMonth === today.getMonth() && 
           currentYear === today.getFullYear();
  };

  const isSelected = (day: number) => {
    return day === selectedDate.getDate() && 
           currentMonth === selectedDate.getMonth() && 
           currentYear === selectedDate.getFullYear();
  };

  const hasSchedule = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return scheduledDates.has(dateStr);
  };

  const getOrderBarsForDay = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    date.setHours(0, 0, 0, 0);
    
    return orderRanges.filter(range => {
      const start = new Date(range.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(range.endDate);
      end.setHours(0, 0, 0, 0);
      return date >= start && date <= end;
    }).map(range => {
      const start = new Date(range.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(range.endDate);
      end.setHours(0, 0, 0, 0);
      
      const isStart = date.getTime() === start.getTime();
      const isEnd = date.getTime() === end.getTime();
      const isSingleDay = isStart && isEnd;
      
      return {
        ...range,
        isStart,
        isEnd,
        isSingleDay,
      };
    });
  };

  return (
    <Card style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <Pressable onPress={goToPrevMonth} style={styles.calendarNav}>
          <Icon name="chevron-back-outline" size={20} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.calendarTitle, { color: theme.text }]}>
          {formatMonthYear()}
        </ThemedText>
        <Pressable onPress={goToNextMonth} style={styles.calendarNav}>
          <Icon name="chevron-forward-outline" size={20} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((day, idx) => (
          <View key={day} style={styles.weekdayCell}>
            <ThemedText style={[
              styles.weekdayText, 
              { color: idx === 0 ? '#EF4444' : idx === 6 ? '#3B82F6' : theme.tabIconDefault }
            ]}>
              {day}
            </ThemedText>
          </View>
        ))}
      </View>

      {weeks.map((week, weekIdx) => (
        <View key={weekIdx} style={styles.weekRow}>
          {week.map((day, dayIdx) => {
            const bars = day ? getOrderBarsForDay(day) : [];
            return (
              <Pressable 
                key={dayIdx} 
                style={styles.dayCell}
                onPress={() => day ? onSelectDate(new Date(currentYear, currentMonth, day)) : null}
              >
                {day ? (
                  <View style={[
                    styles.dayContent,
                    isSelected(day) && { backgroundColor: primaryColor },
                    isToday(day) && !isSelected(day) && { borderWidth: 1, borderColor: primaryColor },
                  ]}>
                    <ThemedText style={[
                      styles.dayText,
                      { color: dayIdx === 0 ? '#EF4444' : dayIdx === 6 ? '#3B82F6' : theme.text },
                      isSelected(day) && { color: '#FFFFFF' },
                    ]}>
                      {day}
                    </ThemedText>
                    {bars.length > 0 ? (
                      <View style={styles.barContainer}>
                        {bars.slice(0, 2).map((bar, barIdx) => (
                          <View 
                            key={bar.id}
                            style={[
                              styles.scheduleBar,
                              { backgroundColor: bar.color },
                              bar.isSingleDay && styles.scheduleBarSingle,
                              bar.isStart && !bar.isSingleDay && styles.scheduleBarStart,
                              bar.isEnd && !bar.isSingleDay && styles.scheduleBarEnd,
                              !bar.isStart && !bar.isEnd && styles.scheduleBarMiddle,
                            ]}
                          />
                        ))}
                        {bars.length > 2 ? (
                          <ThemedText style={styles.moreIndicator}>+{bars.length - 2}</ThemedText>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

function HelperDashboard({
  theme,
  primaryColor,
  stats,
  scheduledOrders,
  formatCurrency,
  navigation,
  onNavigateDetail,
  contentWidth,
  showDesktopLayout,
  columns,
}: {
  theme: any;
  primaryColor: string;
  stats?: DashboardStats;
  scheduledOrders: ScheduledOrder[];
  formatCurrency: (amount?: number) => string;
  navigation: NativeStackNavigationProp<any>;
  onNavigateDetail: (orderId: number) => void;
  contentWidth: number;
  showDesktopLayout: boolean;
  columns: number;
}) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const filteredOrders = useMemo(() => {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    return scheduledOrders.filter(order => order.workDate?.startsWith(dateStr));
  }, [scheduledOrders, selectedDate]);

  const cardWidth = contentWidth - Spacing.lg * 2;
  // 데스크탑 그리드용 카드 너비: 컬럼 수에 맞춰 분할
  const desktopColumns = Math.min(columns, 2); // 헬퍼 일정은 최대 2열
  const gridCardWidth = showDesktopLayout
    ? (cardWidth - Spacing.md * (desktopColumns - 1)) / desktopColumns
    : cardWidth;

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / cardWidth);
    setCurrentOrderIndex(index);
  };

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
  };

  return (
    <>
      {/* 홈 배너 광고 */}
      <BannerAdCarousel />

      <View style={styles.sectionHeader}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          {formatDate(selectedDate)} 일정
        </ThemedText>
      </View>

      {filteredOrders.length > 0 ? (
        showDesktopLayout ? (
          /* 데스크탑: 그리드 레이아웃으로 카드 나열 */
          <View style={styles.desktopGrid}>
            {filteredOrders.map((order) => {
              const orderDTO = adaptHelperMyOrder(order);
              const isScheduled = ['scheduled', 'assigned'].includes((order.status || '').toLowerCase());
              return (
                <View key={order.id} style={{ width: gridCardWidth }}>
                  <OrderCard
                    data={orderDTO}
                    context="helper_home"
                    onPress={() => {
                      if (isScheduled) {
                        navigation.navigate('QRCheckin' as any);
                      } else {
                        onNavigateDetail(order.id);
                      }
                    }}
                  />
                </View>
              );
            })}
          </View>
        ) : (
        /* 모바일: 가로 스와이프 */
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
              nestedScrollEnabled={true}
          decelerationRate="fast"
          snapToInterval={cardWidth}
          snapToAlignment="start"
          contentContainerStyle={styles.horizontalScrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {filteredOrders.map((order, index) => {
            const orderDTO = adaptHelperMyOrder(order);
            const isScheduled = ['scheduled', 'assigned'].includes((order.status || '').toLowerCase());
            return (
              <View key={order.id} style={[styles.swipeOrderCard, { width: cardWidth }]}>
                <OrderCard
                  data={orderDTO}
                  context="helper_home"
                  onPress={() => {
                    if (isScheduled) {
                      navigation.navigate('QRCheckin' as any);
                    } else {
                      onNavigateDetail(order.id);
                    }
                  }}
                />
              </View>
            );
          })}
        </ScrollView>
        )
      ) : (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIconContainer, { backgroundColor: BrandColors.helperLight }]}>
            <Icon name="calendar-outline" size={32} color={primaryColor} />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
            {formatDate(selectedDate)}에 일정이 없습니다
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
            오더 탭에서 새로운 일거리를 찾아보세요
          </ThemedText>
        </Card>
      )}

      {!showDesktopLayout && filteredOrders.length > 1 ? (
        <View style={styles.paginationDots}>
          {filteredOrders.map((_, idx) => (
            <View key={idx} style={[
              styles.dot,
              { backgroundColor: idx === currentOrderIndex ? primaryColor : theme.tabIconDefault }
            ]} />
          ))}
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>캘린더</ThemedText>
      </View>

      <SimpleCalendar
        theme={theme}
        primaryColor={primaryColor}
        scheduledOrders={scheduledOrders}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
    </>
  );
}

function RequesterDashboard({
  theme,
  primaryColor,
  orders,
  navigation,
  onEditOrder,
  onNavigateDetail,
  contentWidth,
  showDesktopLayout,
  columns,
}: {
  theme: any;
  primaryColor: string;
  orders: any[];
  navigation: NativeStackNavigationProp<any>;
  onEditOrder: (order: any) => void;
  onNavigateDetail: (orderId: number) => void;
  contentWidth: number;
  showDesktopLayout: boolean;
  columns: number;
}) {
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [applicantModalVisible, setApplicantModalVisible] = useState(false);
  const queryClient = useQueryClient();
  const rootNavigation = useNavigation<any>();

  // 화면 포커스 시 오더 목록 새로고침 (오더등록/계약서작성 후 복귀 시 즉시 반영)
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/requester/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/helper/work-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/scheduled'] });
    }, [queryClient])
  );

  // 계약서 미작성(입금대기) 오더 — 별도 배너로 표시
  const pendingContractOrders = useMemo(() => {
    return orders.filter((o: any) => {
      const status = (o.status || '').toUpperCase();
      return status === 'AWAITING_DEPOSIT';
    });
  }, [orders]);

  const activeOrders = useMemo(() => {
    const filtered = orders.filter((o: any) => {
      const status = (o.status || '').toUpperCase();
      // AWAITING_DEPOSIT 제외: 계약서 작성+입금 완료 전 오더는 별도 배너로 표시
      return [
        'REGISTERED', 'OPEN', 'MATCHING', 'ASSIGNED', 'SCHEDULED',
        'IN_PROGRESS', 'CHECKED_IN', 'CLOSING_SUBMITTED', 'FINAL_AMOUNT_CONFIRMED'
      ].includes(status);
    });
    const seen = new Set<string>();
    const unique = filtered.filter((o: any) => {
      const id = String(o.id || o.orderId);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    unique.sort((a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    return unique.slice(0, showDesktopLayout ? 12 : 5);
  }, [orders, showDesktopLayout]);

  React.useEffect(() => {
    if (currentOrderIndex >= activeOrders.length) {
      setCurrentOrderIndex(Math.max(0, activeOrders.length - 1));
    }
  }, [activeOrders.length, currentOrderIndex]);

  const currentOrder = activeOrders[currentOrderIndex];
  const currentOrderName = currentOrder?.companyName || currentOrder?.courierCompany || currentOrder?.title || '오더';

  const { data: applicants = [] } = useQuery<Applicant[]>({
    queryKey: [`/api/orders/${currentOrder?.id}/applications`],
    enabled: !!currentOrder?.id,
  });

  const selectHelperMutation = useMutation({
    mutationFn: async ({ helperId, orderId }: { helperId: string; orderId: number }) => {
      return apiRequest("POST", `/api/orders/${orderId}/select-helper`, {
        helperId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${variables.orderId}/applications`] });
      queryClient.invalidateQueries({ queryKey: ["/api/requester/orders"] });
      setApplicantModalVisible(false);
      setSelectedOrderId(null);
      Alert.alert("배정 완료", `${selectedApplicant?.helperName}님이 배정되었습니다.`);
    },
    onError: (error: any) => {
      Alert.alert("오류", error.message || "헬퍼 선택에 실패했습니다.");
    },
  });

  const cardWidth = contentWidth - Spacing.lg * 2;
  // 데스크탑 그리드용 카드 너비
  const desktopColumns = Math.min(columns, 3);
  const gridCardWidth = showDesktopLayout
    ? (cardWidth - Spacing.md * (desktopColumns - 1)) / desktopColumns
    : cardWidth;

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / cardWidth);
    if (index !== currentOrderIndex && index >= 0 && index < activeOrders.length) {
      setCurrentOrderIndex(index);
    }
  };

  const handleApplicantPress = (applicant: Applicant, orderId: number) => {
    setSelectedOrderId(orderId);
    setSelectedApplicant(applicant);
    setApplicantModalVisible(true);
  };

  const handleSelectHelper = () => {
    if (selectedApplicant && selectedOrderId) {
      const helperName = selectedApplicant.helperName || '선택한 헬퍼';
      if (Platform.OS === 'web') {
        if (confirm(`${helperName}님을 이 오더에 배정하시겠습니까?`)) {
          selectHelperMutation.mutate({ helperId: selectedApplicant.helperId, orderId: selectedOrderId });
        }
      } else {
        Alert.alert(
          '헬퍼 선택 확인',
          `${helperName}님을 이 오더에 배정하시겠습니까?\n다른 지원자들은 자동으로 미선택 처리됩니다.`,
          [
            { text: '취소', style: 'cancel' },
            { text: '배정하기', onPress: () => selectHelperMutation.mutate({ helperId: selectedApplicant.helperId, orderId: selectedOrderId }) },
          ]
        );
      }
    }
  };

  const renderStars = (rating: number | null) => {
    const displayRating = rating || 0;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={i <= displayRating ? "star" : "star-outline"}
          size={18}
          color={i <= displayRating ? BrandColors.warning : BrandColors.neutral}
          style={{ marginRight: 2 }}
        />
      );
    }
    return stars;
  };

  return (
    <>
      {/* 입금대기 오더 배너: 계약서 미작성 / 입금 대기 구분 */}
      {pendingContractOrders.length > 0 && pendingContractOrders.map((pendingOrder: any) => {
        const isContractDone = !!pendingOrder.contractConfirmed;
        return (
          <Pressable
            key={`pending-${pendingOrder.id}`}
            style={({ pressed }) => [
              styles.pendingContractBanner,
              { backgroundColor: isContractDone ? '#DBEAFE' : BrandColors.warningLight, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => {
              if (isContractDone) {
                onNavigateDetail(pendingOrder.id);
              } else {
                Alert.alert(
                  '계약서 작성',
                  '계약서 작성을 진행하시겠습니까?\n취소 시 오더가 삭제됩니다.',
                  [
                    { text: '닫기', style: 'cancel' },
                    {
                      text: '오더 삭제',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await apiRequest('DELETE', `/api/orders/${pendingOrder.id}`);
                          queryClient.invalidateQueries({ queryKey: ['/api/requester/orders'] });
                          Alert.alert('삭제 완료', '오더가 삭제되었습니다.');
                        } catch (err: any) {
                          Alert.alert('오류', err.message || '오더 삭제에 실패했습니다.');
                        }
                      },
                    },
                    {
                      text: '계약 진행',
                      onPress: () => rootNavigation.navigate('CreateContract', { orderId: pendingOrder.id }),
                    },
                  ]
                );
              }
            }}
          >
            <View style={styles.pendingContractBannerContent}>
              <View style={[styles.pendingContractIcon, { backgroundColor: isContractDone ? BrandColors.requester : BrandColors.warning }]}>
                <Icon name={isContractDone ? "card-outline" : "document-text-outline"} size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.pendingContractTitle, { color: isContractDone ? '#1E40AF' : '#92400E' }]}>
                  {isContractDone ? '예약금 입금이 필요합니다' : '계약서 작성이 필요합니다'}
                </ThemedText>
                <ThemedText style={[styles.pendingContractSubtitle, { color: isContractDone ? '#2563EB' : '#B45309' }]}>
                  {pendingOrder.companyName || '오더'} — {isContractDone ? '입금 확인 후 헬퍼 매칭이 시작됩니다' : '계약서 작성 및 입금 후 등록이 완료됩니다'}
                </ThemedText>
              </View>
              <Icon name="chevron-forward" size={20} color={isContractDone ? BrandColors.requester : BrandColors.warning} />
            </View>
          </Pressable>
        );
      })}

      {/* 홈 배너 광고 */}
      <BannerAdCarousel />

      <View style={styles.sectionHeader}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>나의 오더</ThemedText>
      </View>

      {activeOrders.length > 0 ? (
        showDesktopLayout ? (
          /* 데스크탑: 그리드 레이아웃 — 모든 오더카드 한눈에 */
          <View style={styles.desktopGrid}>
            {activeOrders.map((order: any, idx: number) => {
              const orderDTO = adaptRequesterOrder(order);
              const isSelected = idx === currentOrderIndex;
              return (
                <Pressable
                  key={order.id}
                  style={[
                    { width: gridCardWidth },
                    isSelected && styles.desktopCardSelected,
                  ]}
                  onPress={() => setCurrentOrderIndex(idx)}
                  onLongPress={() => onNavigateDetail(order.id)}
                >
                  <OrderCard
                    data={orderDTO}
                    context="requester_home"
                    onPress={() => onNavigateDetail(order.id)}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
              nestedScrollEnabled={true}
            decelerationRate="fast"
            snapToInterval={cardWidth}
            snapToAlignment="center"
            contentContainerStyle={styles.horizontalScrollContent}
            onMomentumScrollEnd={handleScroll}
          >
            {activeOrders.map((order: any, orderIdx: number) => {
              const orderDTO = adaptRequesterOrder(order);
              return (
                <View key={order.id} style={[styles.swipeOrderCard, { width: cardWidth }]}>
                  <OrderCard
                    data={orderDTO}
                    context="requester_home"
                    onPress={() => onNavigateDetail(order.id)}
                  />
                </View>
              );
            })}
          </ScrollView>
          {activeOrders.length > 1 ? (
            <View style={styles.paginationDots}>
              {activeOrders.map((_: any, idx: number) => (
                <View key={idx} style={[
                  styles.dot,
                  { backgroundColor: idx === currentOrderIndex ? primaryColor : theme.tabIconDefault }
                ]} />
              ))}
            </View>
          ) : null}
        </>
        )
      ) : (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIconContainer, { backgroundColor: BrandColors.requesterLight }]}>
            <Icon name="document-text-outline" size={32} color={primaryColor} />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>진행중인 오더가 없습니다</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
            새 오더를 등록하여 헬퍼를 찾아보세요
          </ThemedText>
        </Card>
      )}

      {/* 헬퍼 지원자 카드 - 등록중/매칭중 상태일 때 최대 3명 세로 정렬 */}
      {applicants.length > 0 && currentOrder && (
        ['REGISTERED', 'MATCHING', 'OPEN'].includes((currentOrder.status || '').toUpperCase())
      ) ? (
        <View style={styles.helperCardsContainer}>
          <View style={styles.helperCardsHeader}>
            <ThemedText style={[styles.helperCardsTitle, { color: theme.text }]}>
              지원한 헬퍼 ({applicants.length}명)
            </ThemedText>
            {applicants.length > 3 ? (
              <Pressable onPress={() => navigation.navigate('ApplicantList', { orderId: currentOrder.id })}>
                <ThemedText style={[styles.helperCardsMore, { color: primaryColor }]}>
                  전체보기
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
          {/* 3명 이상이면 세로 스크롤 영역, 미만이면 그냥 세로 리스트 */}
          <ScrollView
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={applicants.length >= 3}
            style={applicants.length >= 3 ? { maxHeight: 200 } : undefined}
            contentContainerStyle={[styles.helperCardsList, showDesktopLayout && styles.helperCardsListDesktop]}
          >
            {applicants.map((applicant: Applicant) => {
              const imgUrl = applicant.profileImageUrl || applicant.profileImage;
              const displayName = applicant.helperNickname || applicant.helperName || '헬퍼';
              const rating = applicant.averageRating || 0;
              return (
                <Pressable
                  key={applicant.helperId}
                  style={({ pressed }) => [
                    styles.helperCompactCard,
                    { opacity: pressed ? 0.85 : 1 },
                    showDesktopLayout && { width: `calc(50% - ${Spacing.sm / 2}px)` as any },
                  ]}
                  onPress={() => handleApplicantPress(applicant, currentOrder.id)}
                >
                  <View style={styles.helperCompactAvatar}>
                    {imgUrl ? (
                      imgUrl.startsWith('avatar:') ? (
                        <Avatar uri={imgUrl} size={44} isHelper={true} />
                      ) : (
                        <Image
                          source={{ uri: imgUrl.startsWith('/') ? `${getApiUrl()}${imgUrl}` : imgUrl }}
                          style={styles.helperCompactAvatarImage}
                        />
                      )
                    ) : (
                      <Icon name="person" size={22} color={BrandColors.helper} />
                    )}
                  </View>
                  <View style={styles.helperCompactInfo}>
                    <View style={styles.helperCompactNameRow}>
                      <ThemedText style={[styles.helperCompactName, { color: theme.text }]} numberOfLines={1}>
                        {displayName}
                      </ThemedText>
                      {applicant.teamName ? (
                        <View style={styles.helperCompactTeamBadge}>
                          <ThemedText style={styles.helperCompactTeamText}>{applicant.teamName}</ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.helperCompactStatsRow}>
                      <Icon name="star" size={12} color={BrandColors.warning} />
                      <ThemedText style={[styles.helperCompactStatText, { color: theme.text }]}>
                        {rating.toFixed(1)}
                      </ThemedText>
                      <View style={styles.helperCompactDivider} />
                      <ThemedText style={[styles.helperCompactStatText, { color: theme.tabIconDefault }]}>
                        수행 {applicant.completedJobs || 0}건
                      </ThemedText>
                      <View style={styles.helperCompactDivider} />
                      <ThemedText style={[styles.helperCompactStatText, { color: theme.tabIconDefault }]}>
                        리뷰 {applicant.reviewCount || 0}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <Modal
        visible={applicantModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setApplicantModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.fbProfileModal, { backgroundColor: '#FFFFFF' }]}>
            {selectedApplicant ? (
              <>
                <ScrollView 
                  style={styles.fbProfileScroll}
                  contentContainerStyle={{ paddingBottom: Spacing.md }}
                  showsVerticalScrollIndicator={true}
                >
                  <Pressable 
                    style={styles.fbCloseButton}
                    onPress={() => setApplicantModalVisible(false)}
                  >
                    <View style={styles.fbCloseButtonBg}>
                      <Icon name="close" size={20} color="#FFFFFF" />
                    </View>
                  </Pressable>

                  <LinearGradient
                    colors={[BrandColors.helper, '#1565C0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.fbCoverPhoto}
                  >
                    <View style={styles.fbCoverPattern}>
                      <Icon name="car-outline" size={50} color="rgba(255,255,255,0.1)" />
                      <Icon name="cube-outline" size={35} color="rgba(255,255,255,0.08)" style={{ marginLeft: 15 }} />
                    </View>
                  </LinearGradient>

                  <View style={styles.fbProfileSection}>
                    <View style={styles.fbAvatarWrapper}>
                      <View style={styles.fbAvatarCircle}>
                        <Avatar
                          uri={(() => {
                            const img = selectedApplicant.profileImageUrl || selectedApplicant.profileImage;
                            if (!img) return undefined;
                            if (img.startsWith('avatar:')) return img;
                            return img.startsWith('http') ? img : `${getApiUrl()}${img}`;
                          })()}
                          size={80}
                          isHelper={true}
                        />
                      </View>
                    </View>

                    <ThemedText style={[styles.fbProfileName, { color: '#1A1A1A' }]}>
                      {selectedApplicant.helperNickname || selectedApplicant.helperName}
                    </ThemedText>
                    
                    {selectedApplicant.category ? (
                      <ThemedText style={[styles.fbProfileCategory, { color: '#666666' }]}>
                        {selectedApplicant.category}
                      </ThemedText>
                    ) : null}

                    <View style={styles.fbRatingRow}>
                      <View style={styles.starsRow}>{renderStars(selectedApplicant.averageRating)}</View>
                      <ThemedText style={[styles.fbRatingValue, { color: '#1A1A1A' }]}>
                        {selectedApplicant.averageRating ? selectedApplicant.averageRating.toFixed(1) : '-'}
                      </ThemedText>
                      <ThemedText style={[styles.fbReviewCount, { color: '#666666' }]}>
                        ({selectedApplicant.reviewCount}건)
                      </ThemedText>
                    </View>
                  </View>

                  {selectedApplicant.message ? (
                    <View style={[styles.fbSectionContainer, { backgroundColor: '#FFFFFF' }]}>
                      <View style={styles.fbSectionHeader}>
                        <Icon name="chatbubble-outline" size={18} color={BrandColors.helper} />
                        <ThemedText style={[styles.fbSectionTitle, { color: '#1A1A1A' }]}>지원 메시지</ThemedText>
                      </View>
                      <View style={[styles.fbMessageCard, { backgroundColor: '#F5F5F5' }]}>
                        <ThemedText style={[styles.fbMessageText, { color: '#1A1A1A' }]}>
                          {selectedApplicant.message}
                        </ThemedText>
                      </View>
                    </View>
                  ) : null}

                  <View style={[styles.fbSectionContainer, { backgroundColor: '#FFFFFF' }]}>
                    <View style={styles.fbSectionHeader}>
                      <Icon name="star-outline" size={18} color={BrandColors.warning} />
                      <ThemedText style={[styles.fbSectionTitle, { color: '#1A1A1A' }]}>리뷰</ThemedText>
                      <ThemedText style={[styles.fbReviewCountBadge, { color: '#666666' }]}>
                        {selectedApplicant.reviewCount || 0}건
                      </ThemedText>
                    </View>
                    {(selectedApplicant.recentReviews || selectedApplicant.reviews) && (selectedApplicant.recentReviews || selectedApplicant.reviews)!.length > 0 ? (
                      <>
                        {(selectedApplicant.recentReviews || selectedApplicant.reviews)!.map((review) => (
                          <View key={review.id} style={[styles.fbReviewCard, { backgroundColor: '#F5F5F5' }]}>
                            <View style={styles.fbReviewHeader}>
                              <View style={styles.miniStarsRow}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <Icon
                                    key={i}
                                    name={i <= review.rating ? "star" : "star-outline"}
                                    size={14}
                                    color={i <= review.rating ? BrandColors.warning : BrandColors.neutral}
                                  />
                                ))}
                              </View>
                              <ThemedText style={[styles.fbReviewDate, { color: '#666666' }]}>
                                {new Date(review.createdAt).toLocaleDateString('ko-KR')}
                              </ThemedText>
                            </View>
                            {review.comment ? (
                              <ThemedText style={[styles.fbReviewComment, { color: '#1A1A1A' }]}>
                                {review.comment}
                              </ThemedText>
                            ) : null}
                          </View>
                        ))}
                      </>
                    ) : (
                      <View style={[styles.fbEmptyReview, { backgroundColor: '#F5F5F5' }]}>
                        <Icon name="chatbubble-ellipses-outline" size={24} color="#CCCCCC" />
                        <ThemedText style={{ color: '#999999', marginTop: 8 }}>아직 리뷰가 없습니다</ThemedText>
                      </View>
                    )}
                  </View>
                </ScrollView>

                <View style={[styles.fbButtonContainerFixed, { backgroundColor: '#FFFFFF' }]}>
                  <Pressable
                    style={[styles.fbButton, styles.fbButtonOutline, { borderColor: '#CCCCCC' }]}
                    onPress={() => setApplicantModalVisible(false)}
                  >
                    <ThemedText style={[styles.fbButtonText, { color: '#1A1A1A' }]}>닫기</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.fbButton, styles.fbButtonPrimary]}
                    onPress={handleSelectHelper}
                    disabled={selectHelperMutation.isPending}
                  >
                    {selectHelperMutation.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <ThemedText style={styles.fbButtonPrimaryText}>선택하기</ThemedText>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

function handleRequesterAction(action: string, data: OrderCardDTO, navigation: NativeStackNavigationProp<any>) {
  switch (action) {
    case 'VIEW_APPLICANTS':
      navigation.navigate('ApplicantList', { orderId: data.orderId });
      break;
    case 'VIEW_DETAIL':
    case 'VIEW_CLOSING':
      navigation.navigate('Contract', { contractId: data.contractId || data.orderId });
      break;
    case 'REVIEW_CLOSING':
      navigation.navigate('RequesterClosing', { orderId: Number(data.orderId) });
      break;
    case 'PAY_DOWN':
    case 'PAY_BALANCE':
      navigation.navigate('Payment', { orderId: data.orderId });
      break;
    case 'WRITE_REVIEW':
      navigation.navigate('Main', { screen: 'ProfileTab', params: { screen: 'WriteReview', params: { orderId: data.orderId } } });
      break;
    case 'VIEW_REVIEW':
      navigation.navigate('Main', { screen: 'ReviewsTab' });
      break;
    case 'EDIT_ORDER':
      navigation.navigate('CreateContract', { editMode: true, orderId: data.orderId });
      break;
    case 'CANCEL_ORDER':
      break;
  }
}

const styles = StyleSheet.create({
  headerContent: {
    flex: 1,
  },
  welcomeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing['2xl'],
  },
  welcomeText: {
    ...Typography.h3,
  },
  roleBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  roleBadgeText: {
    ...Typography.small,
    fontWeight: '600',
  },
  onboardingBanner: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  onboardingBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  onboardingBannerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  onboardingBannerTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  onboardingBannerMessage: {
    ...Typography.small,
  },
  statsCard: {
    padding: Spacing.xl,
    marginBottom: Spacing['2xl'],
  },
  cardTitle: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  earningsAmount: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  statValue: {
    ...Typography.h3,
  },
  statLabel: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
  },
  addOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  addOrderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  seeAllLink: {
    ...Typography.body,
    fontWeight: '600',
  },
  calendarCard: {
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  calendarNav: {
    padding: Spacing.sm,
  },
  calendarTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  weekdayText: {
    ...Typography.small,
    fontWeight: '500',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayContent: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    ...Typography.small,
  },
  scheduleDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  barContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
    gap: 1,
    overflow: 'hidden',
  },
  scheduleBar: {
    height: 3,
    marginHorizontal: -2,
  },
  scheduleBarSingle: {
    marginHorizontal: 4,
    borderRadius: 2,
  },
  scheduleBarStart: {
    marginLeft: 4,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
  },
  scheduleBarEnd: {
    marginRight: 4,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  scheduleBarMiddle: {
    marginHorizontal: -2,
  },
  moreIndicator: {
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyCard: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    ...Typography.small,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing['2xl'],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
  orderCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  orderCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  orderCompany: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  orderMetaText: {
    ...Typography.small,
  },
  orderPayment: {
    ...Typography.h4,
  },
  contractCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  contractCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contractAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  contractInfo: {
    flex: 1,
  },
  contractName: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  contractJob: {
    ...Typography.small,
  },
  contractStatus: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  contractStatusText: {
    ...Typography.small,
    fontWeight: '500',
  },
  horizontalScrollContent: {
    paddingRight: Spacing.lg,
  },
  swipeOrderCard: {
    // width는 인라인으로 contentWidth 기반 동적 설정
  },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  desktopCardSelected: {
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderColor: BrandColors.requester,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.5,
  },
  applicantCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  applicantCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  applicantOrderName: {
    ...Typography.body,
    fontWeight: '600',
  },
  applicantBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  applicantBadgeText: {
    ...Typography.small,
    fontWeight: '600',
  },
  applicantHint: {
    ...Typography.small,
  },
  emptyApplicantCard: {
    padding: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emptyApplicantText: {
    ...Typography.body,
  },
  applicantCountText: {
    ...Typography.small,
  },
  applicantCardsRow: {
    flexDirection: 'column',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  miniHelperCard: {
    backgroundColor: 'rgba(0,123,255,0.08)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniHelperAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,123,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  miniHelperInfo: {
    flex: 1,
  },
  miniHelperName: {
    fontSize: 14,
    fontWeight: '600',
  },
  miniHelperPhone: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  miniHelperRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: BorderRadius.sm,
  },
  miniHelperRatingText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },
  moreApplicantsCard: {
    backgroundColor: 'rgba(0,123,255,0.05)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,123,255,0.2)',
    borderStyle: 'dashed',
  },
  moreApplicants: {
    backgroundColor: 'rgba(0,123,255,0.08)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  moreApplicantsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007BFF',
  },
  noApplicantRow: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  noApplicantText: {
    fontSize: 12,
  },
  noApplicantCard: {
    marginTop: Spacing.md,
    padding: Spacing.xl,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  helperCardsContainer: {
    marginTop: Spacing.lg,
  },
  helperCardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  helperCardsTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  helperCardsMore: {
    fontSize: 13,
    fontWeight: '500',
  },
  helperCardsList: {
    gap: Spacing.xs,
  },
  helperCardsListDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  /* 가로 스크롤 헬퍼 카드 (3명 이상일 때) */
  helperScrollCard: {
    width: 110,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: 4,
  },
  helperScrollAvatar: {
    marginBottom: 4,
  },
  helperScrollAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperScrollName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 100,
  },
  helperScrollRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  helperScrollRatingText: {
    fontSize: 11,
    fontWeight: '500',
  },
  helperScrollStatText: {
    fontSize: 10,
  },
  helperCompactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  helperCompactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.helperLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  helperCompactAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  helperCompactInfo: {
    flex: 1,
  },
  helperCompactNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  helperCompactName: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperCompactTeamBadge: {
    backgroundColor: BrandColors.helperLight,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
  },
  helperCompactTeamText: {
    fontSize: 10,
    fontWeight: '600',
    color: BrandColors.helper,
  },
  helperCompactStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  helperCompactStatText: {
    fontSize: 11,
  },
  helperCompactDivider: {
    width: 1,
    height: 10,
    backgroundColor: '#E5E7EB',
  },
  helperApplicantCard: {
    padding: Spacing.lg,
    alignItems: 'center',
    width: 120,
  },
  helperApplicantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BrandColors.helperLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  helperApplicantName: {
    ...Typography.body,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  helperApplicantRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  helperApplicantRatingText: {
    ...Typography.small,
    fontWeight: '600',
  },
  helperApplicantReviewCount: {
    ...Typography.small,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  applicantModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  applicantModalHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  applicantModalAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BrandColors.helperLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  applicantModalName: {
    ...Typography.h3,
    textAlign: 'center',
  },
  applicantModalCategory: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  applicantModalRating: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  ratingValue: {
    ...Typography.h4,
    fontWeight: '700',
  },
  reviewCountValue: {
    ...Typography.small,
    marginTop: 2,
  },
  applicantMessageBox: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  applicantMessageLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  applicantMessageText: {
    ...Typography.body,
  },
  reviewSection: {
    marginBottom: Spacing.lg,
  },
  reviewSectionTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  reviewList: {
    maxHeight: 150,
  },
  reviewItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  reviewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  miniStarsRow: {
    flexDirection: 'row',
  },
  reviewDate: {
    ...Typography.small,
  },
  reviewComment: {
    ...Typography.small,
  },
  applicantModalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  modalButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  fbProfileModal: {
    width: '90%',
    maxWidth: 640,
    height: '85%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  fbProfileScroll: {
    flex: 1,
  },
  fbCloseButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 10,
  },
  fbCloseButtonBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbCoverPhoto: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fbCoverPattern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbProfileSection: {
    alignItems: 'center',
    marginTop: -45,
    paddingHorizontal: Spacing.lg,
    backgroundColor: '#FFFFFF',
    paddingBottom: Spacing.md,
  },
  fbAvatarWrapper: {
    marginBottom: Spacing.md,
  },
  fbAvatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E3F2FD',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fbAvatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  fbProfileName: {
    ...Typography.h3,
    fontWeight: '700',
    textAlign: 'center',
  },
  fbProfileCategory: {
    ...Typography.small,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  fbRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  fbRatingValue: {
    ...Typography.body,
    fontWeight: '700',
  },
  fbReviewCount: {
    ...Typography.small,
  },
  fbSectionContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  fbSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  fbSectionTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  fbMessageCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  fbMessageText: {
    ...Typography.body,
    lineHeight: 22,
  },
  fbReviewCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  fbReviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  fbReviewDate: {
    ...Typography.small,
  },
  fbReviewComment: {
    ...Typography.small,
    lineHeight: 18,
  },
  fbReviewCountBadge: {
    ...Typography.small,
    marginLeft: 'auto',
  },
  fbEmptyReview: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbButtonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  fbButtonContainerFixed: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  fbButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fbButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  fbButtonPrimary: {
    backgroundColor: BrandColors.requester,
  },
  fbButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  fbButtonPrimaryText: {
    ...Typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fbMiniCardsRow: {
    flexDirection: 'column',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  fbMiniCard: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  fbMiniCover: {
    height: 32,
  },
  fbMiniProfileArea: {
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    marginTop: -18,
    backgroundColor: '#FFFFFF',
  },
  fbMiniAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E3F2FD',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },
  fbMiniAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  fbMiniName: {
    ...Typography.small,
    fontWeight: '600',
    textAlign: 'center',
  },
  fbMiniRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  fbMiniRatingText: {
    fontSize: 11,
  },
  pendingContractBanner: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  pendingContractBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  pendingContractIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingContractTitle: {
    ...Typography.body,
    fontWeight: '700',
    color: '#92400E',
  },
  pendingContractSubtitle: {
    ...Typography.small,
    color: '#B45309',
    marginTop: 2,
  },
});

const popupStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 9 / 14,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  linkBadge: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  linkBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  textOnlyWrap: {
    padding: Spacing['2xl'],
    alignItems: 'center',
    minHeight: 240,
    justifyContent: 'center',
  },
  textOnlyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  textOnlyTitle: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.md,
    color: '#1A1A1A',
  },
  textOnlyContent: {
    ...Typography.body,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  linkRowText: {
    fontSize: 13,
    fontWeight: '600',
  },
  counter: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  counterText: {
    fontSize: 12,
    color: '#999',
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  dismissBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.lg,
    borderRightWidth: 1,
    borderRightColor: '#F0F0F0',
  },
  dismissText: {
    fontSize: 13,
    color: '#999',
  },
  closeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  // 광고 캐러셀 스타일
  adImage: {
    aspectRatio: 9 / 14,
  },
  adDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  adDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
