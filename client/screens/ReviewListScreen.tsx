import React from "react";
import { View, FlatList, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

interface Review {
  id: number;
  orderId: number;
  orderTitle: string;
  helperName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export default function ReviewListScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

  const { data: reviews = [], isLoading, refetch, isRefetching } = useQuery<Review[]>({
    queryKey: ['/api/requester/reviews'],
  });

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Icon
            key={star}
            name={star <= rating ? "star" : "star-outline"}
            size={16}
            color={star <= rating ? BrandColors.warning : theme.tabIconDefault}
            style={{ marginRight: 2 }}
          />
        ))}
      </View>
    );
  };

  const renderItem = ({ item }: { item: Review }) => (
    <Card variant="glass" padding="lg" style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <ThemedText style={[styles.orderTitle, { color: theme.text }]}>
          {item.orderTitle || `오더 #${item.orderId}`}
        </ThemedText>
        {renderStars(item.rating)}
      </View>
      <ThemedText style={[styles.helperName, { color: theme.tabIconDefault }]}>
        헬퍼: {item.helperName}
      </ThemedText>
      {item.comment ? (
        <ThemedText style={[styles.comment, { color: theme.text }]}>
          {item.comment}
        </ThemedText>
      ) : null}
      <ThemedText style={[styles.dateText, { color: theme.tabIconDefault }]}>
        {new Date(item.createdAt).toLocaleDateString('ko-KR')}
      </ThemedText>
    </Card>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={BrandColors.requester} />
          <ThemedText style={[styles.emptyTitle, { color: theme.tabIconDefault }]}>
            불러오는 중...
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Icon name="star-outline" size={48} color={theme.tabIconDefault} />
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
          작성한 리뷰가 없습니다
        </ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
          완료된 오더에 대해 리뷰를 작성해보세요
        </ThemedText>
      </View>
    );
  };

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg + 94,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: 1,
      }}
      data={reviews}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={BrandColors.requester}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  reviewCard: {
    marginBottom: Spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  orderTitle: {
    ...Typography.body,
    fontWeight: '600',
    flex: 1,
  },
  starsRow: {
    flexDirection: 'row',
  },
  helperName: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  comment: {
    ...Typography.body,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  dateText: {
    ...Typography.small,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl * 3,
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    ...Typography.small,
    textAlign: 'center',
  },
});
