import React, { useState, useMemo } from "react";
import { View, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator, Modal, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { useOrderWebSocket } from "@/hooks/useOrderWebSocket";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { OrderCard } from "@/components/order/OrderCard";
import { JobDetailModal } from "@/components/order/JobDetailModal";
import { adaptHelperRecruitmentOrder, adaptHelperApplicationOrder, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

type JobListScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

type TabType = 'jobs' | 'applications';

interface PaginatedResponse {
  items: any[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export default function JobListScreen({ navigation }: JobListScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const queryClient = useQueryClient();

  useOrderWebSocket();

  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>('전체지역');
  const [selectedSort, setSelectedSort] = useState<string>('최신순');
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderCardDTO | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const regions = ['전체지역','서울','경기','인천','부산','대구','광주','대전','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'];
  const sortOptions = ['최신순','등록중','매칭중','마감'];

  // UI 카테고리명 → API 카테고리 코드 매핑
  const categoryCodeMap: Record<string, string> = {
    '택배사': 'parcel',
    '기타택배': 'other',
    '냉탑전용': 'cold',
  };

  const {
    data: ordersData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching
  } = useInfiniteQuery<PaginatedResponse>({
    queryKey: ['/api/orders', selectedCategory],
    queryFn: async ({ pageParam = 1 }) => {
      const categoryParam = selectedCategory && selectedCategory !== '전체'
        ? `&category=${encodeURIComponent(selectedCategory)}`
        : '';
      const res = await apiRequest('GET', `/api/orders?page=${pageParam}&limit=20${categoryParam}`);
      return res.json();
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    refetchInterval: 30000,
  });

  const { data: myApplications = [], isLoading: isLoadingApplications, refetch: refetchApplications, isRefetching: isRefetchingApplications } = useQuery<any[]>({
    queryKey: ['/api/orders/my-applications'],
  });

  const appliedOrderIds = useMemo(() =>
    new Set(myApplications.map((app: any) => String(app.orderId || app.id))),
    [myApplications]);

  const applyMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest('POST', `/api/orders/${orderId}/apply`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders/my-applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
  });

  const cancelApplicationMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest('DELETE', `/api/orders/${orderId}/apply`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders/my-applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
  });

  const categories = ['전체', '택배사', '기타택배', '냉탑전용'];

  const totalOrders = ordersData?.pages[0]?.totalCount ?? 0;

  const filteredOrders = useMemo(() => {
    let allOrders = ordersData?.pages.flatMap(page => page.items) || [];

    // 지역 필터
    if (selectedRegion !== '전체지역') {
      allOrders = allOrders.filter((o: any) =>
        (o.deliveryArea || '').startsWith(selectedRegion)
      );
    }

    // 상태 필터
    if (selectedSort === '등록중') {
      allOrders = allOrders.filter((o: any) => o.status === 'open');
    } else if (selectedSort === '매칭중') {
      allOrders = allOrders.filter((o: any) => o.status === 'scheduled');
    } else if (selectedSort === '마감') {
      allOrders = allOrders.filter((o: any) =>
        ['closed', 'cancelled', 'in_progress'].includes(o.status)
      );
    }

    return allOrders.map((order: any) =>
      adaptHelperRecruitmentOrder(order, appliedOrderIds.has(String(order.id)))
    );
  }, [ordersData, appliedOrderIds, selectedRegion, selectedSort]);

  const applicationOrders = useMemo(() => {
    return myApplications.map((app: any) => adaptHelperApplicationOrder(app));
  }, [myApplications]);

  const pendingApplications = useMemo(() =>
    applicationOrders.filter(app => app.applicationStatus === 'pending'),
    [applicationOrders]);

  const decidedApplications = useMemo(() =>
    applicationOrders.filter(app => app.applicationStatus !== 'pending'),
    [applicationOrders]);

  const handleAction = (action: string, data: OrderCardDTO) => {
    switch (action) {
      case 'APPLY':
        if (Platform.OS === 'web') {
          if (confirm('이 오더에 지원하시겠습니까?')) {
            applyMutation.mutate(data.orderId);
          }
        } else {
          Alert.alert(
            '오더 지원 확인',
            '이 오더에 지원하시겠습니까?',
            [
              { text: '취소', style: 'cancel' },
              { text: '지원하기', onPress: () => applyMutation.mutate(data.orderId) },
            ]
          );
        }
        break;
      case 'CANCEL_APPLICATION':
        cancelApplicationMutation.mutate(data.orderId);
        break;
      case 'VIEW_DETAIL':
        navigation.navigate('JobDetail', { jobId: data.orderId });
        break;
      case 'CLOSE':
        break;
    }
  };

  const handlePress = (data: OrderCardDTO) => {
    navigation.navigate('JobDetail', { jobId: data.orderId });
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedOrder(null);
  };

  const renderTabBar = () => (
    <View style={styles.tabBarContainer}>
      <Pressable
        style={[
          styles.tabButton,
          activeTab === 'jobs' && { borderBottomColor: BrandColors.helper, borderBottomWidth: 2 },
        ]}
        onPress={() => setActiveTab('jobs')}
      >
        <ThemedText
          style={[
            styles.tabButtonText,
            { color: activeTab === 'jobs' ? BrandColors.helper : theme.tabIconDefault },
          ]}
        >
          오더공고
        </ThemedText>
      </Pressable>
      <Pressable
        style={[
          styles.tabButton,
          activeTab === 'applications' && { borderBottomColor: BrandColors.helper, borderBottomWidth: 2 },
        ]}
        onPress={() => setActiveTab('applications')}
      >
        <View style={styles.tabButtonContent}>
          <ThemedText
            style={[
              styles.tabButtonText,
              { color: activeTab === 'applications' ? BrandColors.helper : theme.tabIconDefault },
            ]}
          >
            신청내역
          </ThemedText>
          {pendingApplications.length > 0 ? (
            <View style={[styles.badge, { backgroundColor: BrandColors.helper }]}>
              <ThemedText style={styles.badgeText}>{pendingApplications.length}</ThemedText>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );

  const renderJobsHeader = () => (
    <View style={styles.headerContent}>
      {renderTabBar()}
      <View style={styles.filterRow}>
        {categories.map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.filterChip,
              {
                backgroundColor: (selectedCategory === cat || (cat === '전체' && !selectedCategory))
                  ? BrandColors.helper
                  : theme.backgroundDefault,
              },
            ]}
            onPress={() => setSelectedCategory(cat === '전체' ? null : cat)}
          >
            <ThemedText
              style={[
                styles.filterChipText,
                {
                  color: (selectedCategory === cat || (cat === '전체' && !selectedCategory))
                    ? '#FFFFFF'
                    : theme.text,
                },
              ]}
            >
              {cat}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.resultInfo}>
        <ThemedText style={[styles.resultCount, { color: theme.text }]}>
          오더등록:{totalOrders}
        </ThemedText>
        <View style={styles.dropdownGroup}>
          <Pressable onPress={() => setShowRegionPicker(true)} style={[styles.dropdown, { borderColor: theme.border }]}>
            <ThemedText style={[styles.dropdownText, { color: theme.text }]}>{selectedRegion}</ThemedText>
            <Icon name="chevron-down" size={10} color={theme.tabIconDefault} />
          </Pressable>
          <Pressable onPress={() => setShowSortPicker(true)} style={[styles.dropdown, { borderColor: theme.border }]}>
            <ThemedText style={[styles.dropdownText, { color: theme.text }]}>{selectedSort}</ThemedText>
            <Icon name="chevron-down" size={10} color={theme.tabIconDefault} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderApplicationsHeader = () => (
    <View style={styles.headerContent}>
      {renderTabBar()}
      <View style={styles.applicationsSummary}>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>대기중</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: BrandColors.helper }]}>
                {pendingApplications.length}건
              </ThemedText>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.backgroundDefault }]} />
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>매칭완료</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#10B981' }]}>
                {decidedApplications.filter(a => a.applicationStatus === 'accepted').length}건
              </ThemedText>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.backgroundDefault }]} />
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>미선정</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: '#EF4444' }]}>
                {decidedApplications.filter(a => a.applicationStatus === 'rejected').length}건
              </ThemedText>
            </View>
          </View>
        </Card>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: OrderCardDTO }) => (
    <OrderCard
      data={item}
      context="helper_home"
      onPress={handlePress}
    />
  );

  const FilterModal = ({ visible, onClose, options, selected, onSelect, title }: {
    visible: boolean; onClose: () => void; options: string[]; selected: string;
    onSelect: (v: string) => void; title: string;
  }) => (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
          <ThemedText style={[styles.modalTitle, { color: theme.text }]}>{title}</ThemedText>
          <View style={styles.modalOptions}>
            {options.map(opt => (
              <Pressable key={opt} onPress={() => { onSelect(opt); onClose(); }}
                style={[styles.modalOption, selected === opt && { backgroundColor: BrandColors.helper, borderColor: BrandColors.helper }]}>
                <ThemedText style={{ color: selected === opt ? '#FFF' : theme.text, fontSize: 12 }}>
                  {opt}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  const renderJobsEmpty = () => (
    <Card style={styles.emptyCard}>
      <View style={[styles.emptyIcon, { backgroundColor: BrandColors.helperLight }]}>
        <Icon name="search-outline" size={32} color={BrandColors.helper} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        등록된 일거리가 없습니다
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
        새로운 일거리가 등록되면 알려드릴게요
      </ThemedText>
    </Card>
  );

  const renderApplicationsEmpty = () => (
    <Card style={styles.emptyCard}>
      <View style={[styles.emptyIcon, { backgroundColor: BrandColors.helperLight }]}>
        <Icon name="document-text-outline" size={32} color={BrandColors.helper} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        신청내역이 없습니다
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
        오더공고에서 일거리를 신청해보세요
      </ThemedText>
    </Card>
  );

  if (isLoading || (activeTab === 'applications' && isLoadingApplications)) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
      </View>
    );
  }

  if (activeTab === 'applications') {
    return (
      <>
        <FlatList
          style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: showDesktopLayout ? Spacing.xl : tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
            flexGrow: 1,
            ...(showDesktopLayout && {
              maxWidth: containerMaxWidth,
              alignSelf: 'center' as const,
              width: '100%' as any,
            }),
          }}
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          data={applicationOrders}
          keyExtractor={(item) => item.orderId}
          renderItem={renderItem}
          ListHeaderComponent={renderApplicationsHeader}
          ListEmptyComponent={renderApplicationsEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefetchingApplications}
              onRefresh={() => refetchApplications()}
              tintColor={BrandColors.helper}
            />
          }
        />
        <JobDetailModal
          visible={modalVisible}
          onClose={handleCloseModal}
          order={selectedOrder}
        />
      </>
    );
  }

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return (
        <View style={{ paddingVertical: Spacing.md, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={BrandColors.helper} />
        </View>
      );
    }
    return null;
  };

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: showDesktopLayout ? Spacing.xl : tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
          ...(showDesktopLayout && {
            maxWidth: containerMaxWidth,
            alignSelf: 'center' as const,
            width: '100%' as any,
          }),
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={filteredOrders}
        keyExtractor={(item) => item.orderId}
        renderItem={renderItem}
        ListHeaderComponent={renderJobsHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderJobsEmpty}
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={BrandColors.helper}
          />
        }
      />
      <JobDetailModal
        visible={modalVisible}
        onClose={handleCloseModal}
        order={selectedOrder}
      />
      <FilterModal
        visible={showRegionPicker}
        onClose={() => setShowRegionPicker(false)}
        options={regions}
        selected={selectedRegion}
        onSelect={setSelectedRegion}
        title="지역 선택"
      />
      <FilterModal
        visible={showSortPicker}
        onClose={() => setShowSortPicker(false)}
        options={sortOptions}
        selected={selectedSort}
        onSelect={setSelectedSort}
        title="정렬/상태"
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBarContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  tabButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    ...Typography.small,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  headerContent: {
    marginBottom: Spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  filterChip: {
    flex: 1,
    marginHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  filterChipText: {
    ...Typography.small,
    fontWeight: '500',
  },
  resultInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  dropdownGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    gap: 2,
  },
  dropdownText: {
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  modalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  applicationsSummary: {
    marginBottom: Spacing.md,
  },
  summaryCard: {
    padding: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
  },
  summaryLabel: {
    ...Typography.small,
    marginBottom: 4,
  },
  summaryValue: {
    ...Typography.h4,
    fontWeight: '700',
  },
  emptyCard: {
    padding: Spacing['3xl'],
    alignItems: 'center',
    marginTop: Spacing['4xl'],
  },
  emptyIcon: {
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
});
