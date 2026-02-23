import React, { useMemo } from "react";
import { View, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { ThemedText } from "@/components/ThemedText";
import { OrderCard, type CardContext } from "@/components/order/OrderCard";
import { Spacing, Typography, BrandColors } from "@/constants/theme";
import type { OrderCardDTO } from "@/adapters/orderCardAdapter";

export type PageContext = 
  | "requester_home"
  | "requester_history"
  | "requester_closing"
  | "helper_home"
  | "helper_recruitment"
  | "helper_application"
  | "helper_my_orders"
  | "helper_history"
  | "settlement_list"
  | "review_list";

interface OrderListPageProps {
  data: any[];
  context: PageContext;
  adapter: (item: any) => OrderCardDTO;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onCardPress?: (item: OrderCardDTO) => void;
  onCardAction?: (action: string, item: OrderCardDTO) => void;
  emptyIcon?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  ListHeaderComponent?: React.ReactElement;
  hasBottomTab?: boolean;
}

const contextToCardContext: Record<PageContext, CardContext> = {
  requester_home: "requester_home",
  requester_history: "requester_history",
  requester_closing: "requester_closing",
  helper_home: "helper_my_orders",
  helper_recruitment: "helper_recruitment",
  helper_application: "helper_application",
  helper_my_orders: "helper_my_orders",
  helper_history: "helper_my_orders",
  settlement_list: "settlement_list",
  review_list: "review_list",
};

const contextToEmptyConfig: Record<PageContext, { icon: string; title: string; subtitle: string }> = {
  requester_home: { icon: "inbox-outline", title: "등록된 오더가 없습니다", subtitle: "새 오더를 등록해보세요" },
  requester_history: { icon: "time-outline", title: "사용 이력이 없습니다", subtitle: "완료된 오더가 여기에 표시됩니다" },
  requester_closing: { icon: "document-text-outline", title: "마감 대기 중인 오더가 없습니다", subtitle: "헬퍼가 마감자료를 제출하면 여기에 표시됩니다" },
  helper_home: { icon: "calendar-outline", title: "예정된 오더가 없습니다", subtitle: "오더공고에서 지원해보세요" },
  helper_recruitment: { icon: "search-outline", title: "모집 중인 오더가 없습니다", subtitle: "새로운 오더가 등록되면 알려드립니다" },
  helper_application: { icon: "send-outline", title: "지원한 오더가 없습니다", subtitle: "오더공고에서 지원해보세요" },
  helper_my_orders: { icon: "briefcase-outline", title: "진행 중인 오더가 없습니다", subtitle: "매칭된 오더가 여기에 표시됩니다" },
  helper_history: { icon: "time-outline", title: "수행 이력이 없습니다", subtitle: "완료된 업무가 여기에 표시됩니다" },
  settlement_list: { icon: "card-outline", title: "정산 내역이 없습니다", subtitle: "정산 대상 오더가 여기에 표시됩니다" },
  review_list: { icon: "star-outline", title: "리뷰 대상이 없습니다", subtitle: "리뷰 작성 가능한 오더가 여기에 표시됩니다" },
};

export function OrderListPage({
  data,
  context,
  adapter,
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  onCardPress,
  onCardAction,
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  ListHeaderComponent,
  hasBottomTab = true,
}: OrderListPageProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();

  const isHelper = ["helper_home", "helper_recruitment", "helper_application", "helper_my_orders", "helper_history"].includes(context);
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  const cardContext = contextToCardContext[context];
  const emptyConfig = contextToEmptyConfig[context];

  const adaptedData = useMemo(() => {
    return (data || []).map(adapter);
  }, [data, adapter]);

  const renderItem = ({ item }: { item: OrderCardDTO }) => (
    <OrderCard
      data={item}
      context={cardContext}
      onPress={onCardPress}
      onAction={onCardAction}
    />
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <ThemedText style={[styles.emptyTitle, { color: theme.tabIconDefault }]}>
            불러오는 중...
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Icon name={emptyIcon || emptyConfig.icon} size={48} color={theme.tabIconDefault} />
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
          {emptyTitle || emptyConfig.title}
        </ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
          {emptySubtitle || emptyConfig.subtitle}
        </ThemedText>
      </View>
    );
  };

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: hasBottomTab
            ? (showDesktopLayout ? Spacing.xl : insets.bottom + 80)
            : insets.bottom + Spacing.xl,
          ...(showDesktopLayout && {
            maxWidth: containerMaxWidth,
            alignSelf: 'center' as const,
            width: '100%' as any,
          }),
        },
      ]}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={adaptedData}
      keyExtractor={(item) => item.orderId}
      renderItem={renderItem}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={primaryColor}
          />
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 3,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: "600",
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...Typography.small,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});

export default OrderListPage;
