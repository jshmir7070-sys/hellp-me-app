import React from "react";
import { View, FlatList, StyleSheet, RefreshControl } from "react-native";
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
import { Avatar } from "@/components/Avatar";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";

interface Review {
  id: number;
  rating: number;
  comment: string;
  reviewerName: string;
  orderTitle: string;
  createdAt: string;
}

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function ReviewsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  const { data: reviews = [], isLoading, refetch, isRefetching } = useQuery<Review[]>({
    queryKey: [isHelper ? '/api/helper/reviews' : '/api/contracts'],
    select: (data: any) => {
      if (!Array.isArray(data)) return [];
      return data.map((item: any) => ({
        id: item.id,
        rating: item.rating || 0,
        comment: item.review || '',
        reviewerName: item.reviewerName || item.helperName || '익명',
        orderTitle: item.orderTitle || item.title || '',
        createdAt: item.createdAt || item.updatedAt || '',
      })).filter((r: Review) => r.comment);
    },
  });

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Icon
            key={star}
            name="star-outline"
            size={16}
            color={star <= rating ? 'BrandColors.warning' : Colors.light.backgroundTertiary}
            style={{ marginRight: 2 }}
          />
        ))}
      </View>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return `${date.getMonth() + 1}월 ${date.getDate()}일`;
    } catch {
      return dateStr;
    }
  };

  const renderItem = ({ item }: { item: Review }) => (
    <Card variant="glass" padding="md" style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <Avatar 
            uri={(item as any).reviewerProfileImage}
            size={36}
            isHelper={!isHelper}
          />
          <View>
            <ThemedText style={[styles.reviewerName, { color: theme.text }]}>
              {item.reviewerName}
            </ThemedText>
            <ThemedText style={[styles.orderTitle, { color: theme.tabIconDefault }]}>
              {item.orderTitle}
            </ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.reviewDate, { color: theme.tabIconDefault }]}>
          {formatDate(item.createdAt)}
        </ThemedText>
      </View>

      <View style={styles.ratingRow}>
        {renderStars(item.rating)}
        <ThemedText style={[styles.ratingText, { color: theme.text }]}>
          {item.rating.toFixed(1)}
        </ThemedText>
      </View>

      {item.comment ? (
        <ThemedText style={[styles.comment, { color: theme.text }]}>
          {item.comment}
        </ThemedText>
      ) : null}
    </Card>
  );

  const renderEmpty = () => (
    <Card variant="glass" padding="xl" style={styles.emptyCard}>
      <View style={[styles.emptyIconContainer, { backgroundColor: isHelper ? BrandColors.helperLight : BrandColors.requesterLight }]}>
        <Icon name="star-outline" size={32} color={primaryColor} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        리뷰가 없습니다
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
        {isHelper ? '업무를 완료하면 요청자가 리뷰를 남길 수 있습니다' : '헬퍼에게 리뷰를 남겨보세요'}
      </ThemedText>
    </Card>
  );

  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: 1,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={reviews}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderItem}
      ListHeaderComponent={reviews.length > 0 ? (
        <Card variant="glass" padding="lg" style={styles.summaryCard}>
          <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>
            평균 평점
          </ThemedText>
          <View style={styles.summaryRow}>
            <ThemedText style={[styles.averageRating, { color: primaryColor }]}>
              {averageRating.toFixed(1)}
            </ThemedText>
            {renderStars(Math.round(averageRating))}
          </View>
          <ThemedText style={[styles.reviewCount, { color: theme.tabIconDefault }]}>
            총 {reviews.length}개의 리뷰
          </ThemedText>
        </Card>
      ) : null}
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
  summaryCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  summaryLabel: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  averageRating: {
    fontSize: 32,
    fontWeight: '700',
  },
  reviewCount: {
    ...Typography.small,
  },
  reviewCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerName: {
    ...Typography.body,
    fontWeight: '600',
  },
  orderTitle: {
    ...Typography.small,
  },
  reviewDate: {
    ...Typography.small,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  ratingText: {
    ...Typography.body,
    fontWeight: '600',
  },
  comment: {
    ...Typography.body,
    lineHeight: 22,
  },
  emptyCard: {
    padding: Spacing['3xl'],
    alignItems: 'center',
    marginTop: Spacing['2xl'],
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
