import React, { useState, useCallback } from "react";
import { View, FlatList, StyleSheet, RefreshControl, ActivityIndicator, ViewStyle, Linking, Pressable, Alert } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
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
  phoneNumber?: string | null;
  relatedId?: number | null;
  payload?: string | null;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  // 펼쳐진 알림 ID 추적
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const handleNotificationPress = useCallback(async (notification: Notification) => {
    // 읽음 처리
    if (!notification.isRead) {
      try {
        await apiRequest("POST", `/api/notifications/${notification.id}/read`);
        queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
        queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }

    // 토글 펼치기/접기
    setExpandedId(prev => prev === notification.id ? null : notification.id);
  }, [queryClient]);

  const handlePhoneCall = useCallback((phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    Alert.alert(
      '전화 걸기',
      `${phoneNumber}로 전화하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '전화', onPress: () => Linking.openURL(`tel:${cleanNumber}`) },
      ]
    );
  }, []);

  // 메시지에서 전화번호 추출 (010-xxxx-xxxx 패턴)
  const extractPhoneFromMessage = useCallback((message: string): string | null => {
    const phoneRegex = /(\d{2,3}-\d{3,4}-\d{4})/;
    const match = message.match(phoneRegex);
    return match ? match[1] : null;
  }, []);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      // 오더 관련
      case 'order_created':
      case 'order_registered':
      case 'order_approved':
      case 'new_order':
        return 'cube-outline';
      // 지원/매칭 관련
      case 'helper_applied':
      case 'order_application':
        return 'person-add-outline';
      case 'helper_selected':
        return 'checkmark-circle-outline';
      case 'matching_completed':
      case 'matching_success':
        return 'checkmark-done-outline';
      case 'application_rejected':
      case 'matching_failed':
      case 'application_auto_cancelled':
        return 'close-circle-outline';
      // 계약/정산
      case 'contract_sign_request':
        return 'document-text-outline';
      case 'settlement_completed':
        return 'card-outline';
      // 분쟁
      case 'dispute_submitted':
      case 'dispute_resolved':
        return 'alert-circle-outline';
      // 출퇴근
      case 'helper_checked_in':
        return 'log-in-outline';
      case 'work_closed':
        return 'checkmark-done-outline';
      // 온보딩
      case 'onboarding_approved':
        return 'shield-checkmark-outline';
      case 'onboarding_rejected':
        return 'shield-outline';
      // 공지
      case 'announcement':
        return 'megaphone-outline';
      // 기본
      default:
        return 'notifications-outline';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'matching_completed':
      case 'matching_success':
      case 'helper_selected':
      case 'onboarding_approved':
      case 'work_closed':
        return BrandColors.success;
      case 'helper_applied':
      case 'order_application':
      case 'new_order':
        return BrandColors.helper;
      case 'order_created':
      case 'order_registered':
      case 'order_approved':
      case 'contract_sign_request':
        return BrandColors.requester;
      case 'settlement_completed':
        return '#7B1FA2';
      case 'application_rejected':
      case 'matching_failed':
      case 'application_auto_cancelled':
      case 'dispute_submitted':
        return BrandColors.error;
      case 'dispute_resolved':
        return BrandColors.warning;
      case 'announcement':
        return BrandColors.info || '#2196F3';
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
    const isExpanded = expandedId === item.id;
    const cardStyle: ViewStyle = !item.isRead
      ? StyleSheet.flatten([styles.notificationCard, styles.unreadCard])
      : styles.notificationCard;

    // 전화번호: DB 필드 우선, 없으면 메시지에서 추출
    const phoneNumber = item.phoneNumber || extractPhoneFromMessage(item.message);
    const notifColor = getNotificationColor(item.type);

    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <Card style={cardStyle}>
          <View style={styles.notificationContent}>
            <View style={[styles.iconContainer, { backgroundColor: notifColor + '20' }]}>
              <Icon name={getNotificationIcon(item.type) as any} size={20} color={notifColor} />
            </View>
            <View style={styles.notificationText}>
              <View style={styles.notificationHeader}>
                <ThemedText style={[styles.notificationTitle, { color: theme.text }]}>
                  {item.title}
                </ThemedText>
                {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: primaryColor }]} /> : null}
              </View>
              <ThemedText
                style={[styles.notificationMessage, { color: theme.tabIconDefault }]}
                numberOfLines={isExpanded ? undefined : 2}
              >
                {item.message}
              </ThemedText>

              {/* 전화번호 표시 (펼쳤을 때 또는 항상) */}
              {phoneNumber && isExpanded ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.phoneRow,
                    { backgroundColor: BrandColors.success + '15', opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => handlePhoneCall(phoneNumber)}
                >
                  <View style={[styles.phoneIconCircle, { backgroundColor: BrandColors.success + '25' }]}>
                    <Icon name="call" size={16} color={BrandColors.success} />
                  </View>
                  <ThemedText style={[styles.phoneNumber, { color: BrandColors.success }]}>
                    {phoneNumber}
                  </ThemedText>
                  <Icon name="chevron-forward-outline" size={14} color={BrandColors.success} />
                </Pressable>
              ) : null}

              <View style={styles.notificationFooter}>
                <ThemedText style={[styles.notificationTime, { color: theme.tabIconDefault }]}>
                  {formatTime(item.createdAt)}
                </ThemedText>
                {(item.message.length > 60 || phoneNumber) ? (
                  <Icon
                    name={isExpanded ? "chevron-up-outline" : "chevron-down-outline"}
                    size={14}
                    color={theme.tabIconDefault}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <Card style={styles.emptyCard}>
      <View style={[styles.emptyIconContainer, { backgroundColor: isHelper ? BrandColors.helperLight : BrandColors.requesterLight }]}>
        <Icon name="notifications-outline" size={32} color={primaryColor} />
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
        paddingBottom: tabBarHeight + Spacing.xl,
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  phoneIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneNumber: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
