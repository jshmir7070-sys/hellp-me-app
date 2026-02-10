import React from "react";
import { View, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { useQuery } from "@tanstack/react-query";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { OrderCard } from "@/components/order/OrderCard";
import { adaptRequesterOrder, adaptWorkHistory, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function WorkConfirmationScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: [isHelper ? '/api/helper/work-history?status=completed' : '/api/requester/orders?status=completed'],
  });

  const adaptedOrders: OrderCardDTO[] = orders.map(order => 
    isHelper ? adaptWorkHistory(order) : adaptRequesterOrder(order)
  );

  const handleAction = (action: string, data: OrderCardDTO) => {
    switch (action) {
      case 'VIEW_DETAIL':
      case 'VIEW_CLOSING':
        navigation.navigate('Contract', { contractId: data.contractId, orderId: data.orderId });
        break;
      case 'VIEW_SETTLEMENT':
      case 'VIEW_PAYOUT':
        navigation.getParent()?.navigate('ProfileTab', { screen: 'SettlementHistory' });
        break;
      case 'WRITE_REVIEW':
        navigation.navigate('CreateReview', { orderId: data.orderId });
        break;
      case 'VIEW_REVIEW':
        navigation.navigate('ReviewDetail', { orderId: data.orderId });
        break;
      case 'REPORT_DISPUTE':
        navigation.getParent()?.navigate('JobsTab', { 
          screen: 'DisputeCreate', 
          params: { orderId: data.orderId, type: 'amount_error' } 
        });
        break;
    }
  };

  const handlePress = (data: OrderCardDTO) => {
    navigation.navigate('Contract', { contractId: data.contractId, orderId: data.orderId });
  };

  const renderItem = ({ item }: { item: OrderCardDTO }) => (
    <OrderCard
      data={item}
      context="settlement_list"
      onAction={handleAction}
      onPress={handlePress}
    />
  );

  const renderEmpty = () => (
    <Card variant="glass" padding="xl" style={styles.emptyCard}>
      <View style={[styles.emptyIconContainer, { backgroundColor: isHelper ? BrandColors.helperLight : BrandColors.requesterLight }]}>
        <Icon name="clipboard-outline" size={32} color={primaryColor} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        마감된 오더가 없습니다
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
        {isHelper ? '업무를 마감하면 여기에 표시됩니다' : '오더가 마감되면 여기에 표시됩니다'}
      </ThemedText>
    </Card>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg + 94,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: 1,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={adaptedOrders}
      keyExtractor={(item) => item.orderId}
      renderItem={renderItem}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={primaryColor}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    padding: Spacing['3xl'],
    alignItems: 'center',
    marginTop: Spacing['4xl'],
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
});
