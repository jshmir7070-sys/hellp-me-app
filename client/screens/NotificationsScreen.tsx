import React from "react";
import { View, FlatList, StyleSheet, RefreshControl, ActivityIndicator, ViewStyle } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await apiRequest("POST", `/api/notifications/${notification.id}/read`);
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return 'package-variant-closed';
      case 'contract':
        return 'file-document-outline';
      case 'payment':
        return 'credit-card-outline';
      case 'message':
        return 'message-outline';
      default:
        return 'bell-outline';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'order':
        return BrandColors.helper;
      case 'contract':
        return BrandColors.requester;
      case 'payment':
        return '#7B1FA2';
      case 'message':
        return BrandColors.warning;
      default:
        return theme.tabIconDefault;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <Card
          variant={!item.isRead ? "glass" : undefined}
          padding="md"
          style={styles.notificationCard}
        >
          <View style={styles.notificationContent}>
            <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) + '20' }]}>
              <Icon name={getNotificationIcon(item.type) as any} size={20} color={getNotificationColor(item.type)} />
            </View>
            <View style={styles.notificationText}>
              <View style={styles.notificationHeader}>
                <ThemedText style={[styles.notificationTitle, { color: theme.text }]}>
                  {item.title}
                </ThemedText>
                {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: primaryColor }]} /> : null}
              </View>
              <ThemedText style={[styles.notificationMessage, { color: theme.tabIconDefault }]} numberOfLines={2}>
                {item.message}
              </ThemedText>
              <ThemedText style={[styles.notificationTime, { color: theme.tabIconDefault }]}>
                {formatTime(item.createdAt)}
              </ThemedText>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <Card variant="glass" padding="xl" style={styles.emptyCard}>
      <View style={[styles.emptyIconContainer, { backgroundColor: isHelper ? BrandColors.helperLight : BrandColors.requesterLight }]}>
        <Icon name="bell-off-outline" size={32} color={primaryColor} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>알림이 없습니다</ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
        새로운 알림이 오면 여기에 표시됩니다
      </ThemedText>
    </Card>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          알림을 불러오는 중...
        </ThemedText>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: 1,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={notifications}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderNotification}
      ListEmptyComponent={renderEmpty}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={primaryColor}
        />
      }
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  loadingText: {
    ...Typography.body,
  },
  notificationCard: {
    padding: Spacing.lg,
  },
  unreadCard: {
    borderLeftWidth: 3,
    borderLeftColor: BrandColors.primary,
  },
  notificationContent: {
    flexDirection: 'row',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  notificationText: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notificationTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationMessage: {
    ...Typography.small,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  notificationTime: {
    ...Typography.small,
    fontSize: 12,
  },
  emptyCard: {
    padding: Spacing['3xl'],
    alignItems: 'center',
    marginTop: Spacing['3xl'],
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
