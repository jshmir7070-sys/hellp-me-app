import React, { useState, useMemo, useRef } from "react";
import { View, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator, ScrollView, Dimensions, Modal, Alert, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
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
import { JobDetailModal } from "@/components/order/JobDetailModal";
import { adaptHelperMyOrder, adaptRequesterOrder, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { Avatar } from "@/components/Avatar";
import { HelperCard } from "@/components/HelperCard";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface Applicant {
  id: number;
  helperId: string;
  helperName: string;
  helperNickname?: string | null;
  helperPhone?: string;
  category?: string;
  reviewCount: number;
  averageRating: number | null;
  status: string;
  profileImageUrl?: string | null;
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
}

const SCREEN_WIDTH = Dimensions.get("window").width;

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

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { isDesktop, isTablet, isMobile, containerMaxWidth } = useResponsive();

  const [editOrder, setEditOrder] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderCardDTO | null>(null);
  const [selectedRawOrder, setSelectedRawOrder] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;
  
  const showOnboardingBanner = isHelper && user?.onboardingStatus !== 'approved';

  const { data: helperStats, isLoading: isLoadingHelperStats } = useQuery<any>({
    queryKey: ['/api/helper/work-history', { limit: 10 }],
    enabled: isHelper,
  });

  const { data: requesterOrders, isLoading: isLoadingRequesterOrders } = useQuery<any[]>({
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
  const isRefetching = false;

  const refetchStats = () => {};

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
          navigation={navigation}
          onShowModal={(order) => {
            setSelectedOrder(order);
            setModalVisible(true);
          }}
        />
      ) : (
        <RequesterDashboard 
          theme={theme} 
          primaryColor={primaryColor}
          orders={requesterOrders || []}
          navigation={navigation}
          onEditOrder={setEditOrder}
          onShowModal={(order, rawOrder) => {
            setSelectedOrder(order);
            setSelectedRawOrder(rawOrder);
            setModalVisible(true);
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
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
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
      <JobDetailModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedOrder(null);
          setSelectedRawOrder(null);
        }}
        order={selectedOrder}
        hideButtons={isHelper}
        isRequester={!isHelper}
        onEdit={selectedRawOrder ? () => {
          setModalVisible(false);
          setEditOrder(selectedRawOrder);
        } : undefined}
        onDelete={selectedRawOrder ? async () => {
          const orderId = selectedRawOrder.id;
          try {
            const { apiRequest, queryClient: qc } = await import('@/lib/query-client');
            await apiRequest('DELETE', `/api/orders/${orderId}`);
            setModalVisible(false);
            setSelectedOrder(null);
            setSelectedRawOrder(null);
            qc.invalidateQueries({ queryKey: ['/api/requester/orders'] });
          } catch (err) {
            console.error('Delete order error:', err);
          }
        } : undefined}
        onHide={selectedRawOrder && ['closing_submitted', 'final_amount_confirmed', 'balance_paid', 'settlement_paid', 'closed'].includes(selectedRawOrder.status?.toLowerCase() || '') ? async () => {
          const orderId = selectedRawOrder.id;
          try {
            const { apiRequest, queryClient: qc } = await import('@/lib/query-client');
            await apiRequest('POST', `/api/orders/${orderId}/hide`);
            setModalVisible(false);
            setSelectedOrder(null);
            setSelectedRawOrder(null);
            qc.invalidateQueries({ queryKey: ['/api/requester/orders'] });
          } catch (err) {
            console.error('Hide order error:', err);
          }
        } : undefined}
      />
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
  onShowModal,
}: { 
  theme: any; 
  primaryColor: string;
  stats?: DashboardStats;
  scheduledOrders: ScheduledOrder[];
  formatCurrency: (amount?: number) => string;
  navigation: NativeStackNavigationProp<any>;
  onShowModal: (order: OrderCardDTO) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const filteredOrders = useMemo(() => {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    return scheduledOrders.filter(order => order.workDate?.startsWith(dateStr));
  }, [scheduledOrders, selectedDate]);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const cardWidth = SCREEN_WIDTH - Spacing.lg * 2;
    const index = Math.round(offsetX / cardWidth);
    setCurrentOrderIndex(index);
  };

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
  };

  return (
    <>
      <View style={styles.sectionHeader}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
          {formatDate(selectedDate)} 일정
        </ThemedText>
      </View>

      {filteredOrders.length > 0 ? (
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
              nestedScrollEnabled={true}
          decelerationRate="fast"
          snapToInterval={SCREEN_WIDTH - Spacing.lg * 2}
          snapToAlignment="start"
          contentContainerStyle={styles.horizontalScrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {filteredOrders.map((order, index) => {
            const orderDTO = adaptHelperMyOrder(order);
            return (
              <View key={order.id} style={styles.swipeOrderCard}>
                <OrderCard
                  data={orderDTO}
                  context="helper_home"
                  onPress={(data) => onShowModal(data)}
                />
              </View>
            );
          })}
        </ScrollView>
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

      {filteredOrders.length > 1 ? (
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
  onShowModal,
}: { 
  theme: any; 
  primaryColor: string;
  orders: any[];
  navigation: NativeStackNavigationProp<any>;
  onEditOrder: (order: any) => void;
  onShowModal: (order: OrderCardDTO, rawOrder: any) => void;
}) {
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [applicantModalVisible, setApplicantModalVisible] = useState(false);
  const queryClient = useQueryClient();

  const activeOrders = useMemo(() => {
    const filtered = orders.filter((o: any) => {
      const status = (o.status || '').toUpperCase();
      return [
        'AWAITING_DEPOSIT', 'REGISTERED', 'OPEN', 'MATCHING', 'ASSIGNED', 'SCHEDULED',
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
    return unique.slice(0, 5);
  }, [orders]);

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

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const cardWidth = SCREEN_WIDTH - Spacing.lg * 2;
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
      selectHelperMutation.mutate({ helperId: selectedApplicant.helperId, orderId: selectedOrderId });
    }
  };

  const renderStars = (rating: number | null) => {
    const displayRating = rating || 0;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={i <= displayRating ? "star-outline" : "star-outline"}
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
      <View style={styles.sectionHeader}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>나의 오더</ThemedText>
      </View>

      {activeOrders.length > 0 ? (
        <>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
              nestedScrollEnabled={true}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH - Spacing.lg * 2}
            snapToAlignment="center"
            contentContainerStyle={styles.horizontalScrollContent}
            onMomentumScrollEnd={handleScroll}
          >
            {activeOrders.map((order: any, orderIdx: number) => {
              const orderDTO = adaptRequesterOrder(order);
              return (
                <View key={order.id} style={styles.swipeOrderCard}>
                  <OrderCard
                    data={orderDTO}
                    context="requester_home"
                    onPress={(data) => onShowModal(data, order)}
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

      {/* 헬퍼 지원자 카드 - 매칭중 상태일 때 */}
      {applicants.length > 0 && currentOrder && (
        ['MATCHING', 'OPEN'].includes((currentOrder.status || '').toUpperCase())
      ) ? (
        <View style={styles.helperCardsContainer}>
          <View style={styles.helperCardsHeader}>
            <ThemedText style={[styles.helperCardsTitle, { color: theme.text }]}>
              지원한 헬퍼 ({applicants.length}명)
            </ThemedText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {applicants.map((applicant: Applicant) => (
              <Pressable
                key={applicant.helperId}
                style={styles.helperApplicantCard}
                onPress={() => handleApplicantPress(applicant, currentOrder.id)}
              >
                <View style={styles.helperApplicantAvatar}>
                  <Icon name="person" size={24} color={BrandColors.helper} />
                </View>
                <ThemedText
                  style={[styles.helperApplicantName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {applicant.helperNickname || applicant.helperName}
                </ThemedText>
                <View style={styles.helperApplicantRating}>
                  <Icon name="star" size={12} color={BrandColors.warning} />
                  <ThemedText style={[styles.helperApplicantRatingText, { color: theme.text }]}>
                    {applicant.averageRating ? applicant.averageRating.toFixed(1) : '-'}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.helperApplicantReviewCount, { color: theme.tabIconDefault }]}>
                  리뷰 {applicant.reviewCount}개
                </ThemedText>
              </Pressable>
            ))}
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
                        {selectedApplicant.profileImageUrl ? (
                          selectedApplicant.profileImageUrl.startsWith('avatar:') ? (
                            <Avatar uri={selectedApplicant.profileImageUrl} size={80} isHelper={true} />
                          ) : (
                            <Image
                              source={{ uri: `${getApiUrl()}${selectedApplicant.profileImageUrl}` }}
                              style={styles.fbAvatarImage}
                            />
                          )
                        ) : (
                          <Icon name="person" size={50} color={BrandColors.helper} />
                        )}
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
                    {selectedApplicant.reviews && selectedApplicant.reviews.length > 0 ? (
                      <>
                        {selectedApplicant.reviews.map((review) => (
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
    aspectRatio: 1,
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
    width: SCREEN_WIDTH - Spacing.lg * 2,
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
    width: SCREEN_WIDTH - Spacing.xl * 2,
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
});
