import React, { useState, useMemo } from "react";
import { View, FlatList, Pressable, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useOrderWebSocket } from "@/hooks/useOrderWebSocket";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { OrderCard } from "@/components/order/OrderCard";
import { JobDetailModal } from "@/components/order/JobDetailModal";
import { adaptHelperRecruitmentOrder, adaptHelperApplicationOrder, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from "@/constants/theme";

type JobListScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

type TabType = 'jobs' | 'applications';

export default function JobListScreen({ navigation }: JobListScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  
  useOrderWebSocket();

  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderCardDTO | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['/api/orders'],
    refetchInterval: 30000, // 30초마다 자동 새로고침
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

  const categories = ['전체', '택배사', '기타택배', '냉잡전용'];

  const filteredOrders = useMemo(() => {
    const filtered = selectedCategory && selectedCategory !== '전체'
      ? orders.filter((order: any) => order.courierCompany === selectedCategory)
      : orders;
    
    return filtered.map((order: any) => 
      adaptHelperRecruitmentOrder(order, appliedOrderIds.has(String(order.id)))
    );
  }, [orders, selectedCategory, appliedOrderIds]);

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
        applyMutation.mutate(data.orderId);
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
    console.log("[JobListScreen] handlePress called, opening modal", data.orderId);
    setSelectedOrder(data);
    setModalVisible(true);
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
            <Badge variant="gradient" color="blue" size="sm">
              {pendingApplications.length}
            </Badge>
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
                    ? Colors.light.buttonText
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
          {filteredOrders.length}개의 일거리
        </ThemedText>
        <Pressable style={styles.sortButton}>
          <Icon name="tune" size={16} color={theme.tabIconDefault} />
          <ThemedText style={[styles.sortText, { color: theme.tabIconDefault }]}>정렬</ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderApplicationsHeader = () => (
    <View style={styles.headerContent}>
      {renderTabBar()}
      <View style={styles.applicationsSummary}>
        <Card variant="glass" padding="lg" style={styles.summaryCard}>
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
              <ThemedText style={[styles.summaryValue, { color: BrandColors.success }]}>
                {decidedApplications.filter(a => a.applicationStatus === 'accepted').length}건
              </ThemedText>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.backgroundDefault }]} />
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>미선정</ThemedText>
              <ThemedText style={[styles.summaryValue, { color: BrandColors.error }]}>
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
      context={activeTab === 'jobs' ? "helper_recruitment" : "helper_application"}
      onAction={handleAction}
      onPress={handlePress}
    />
  );

  const renderJobsEmpty = () => (
    <Card variant="glass" padding="xl" style={styles.emptyCard}>
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
    <Card variant="glass" padding="xl" style={styles.emptyCard}>
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
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
            flexGrow: 1,
          }}
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          data={applicationOrders}
          keyExtractor={(item) => item.orderId}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={5}
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

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={filteredOrders}
        keyExtractor={(item) => item.orderId}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={5}
        renderItem={renderItem}
        ListHeaderComponent={renderJobsHeader}
        ListEmptyComponent={renderJobsEmpty}
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
    ...Typography.body,
    fontWeight: '600',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sortText: {
    ...Typography.small,
  },
  applicationsSummary: {
    marginBottom: Spacing.md,
  },
  summaryCard: {},
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
