import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Icon } from "@/components/Icon";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedText } from "@/components/ThemedText";
import { BrandColors } from "@/constants/theme";

interface NotificationBellProps {
  onPress: () => void;
}

export function NotificationBell({ onPress }: NotificationBellProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const primaryColor = user?.role === "helper" ? BrandColors.helper : BrandColors.requester;

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count || 0;

  return (
    <Pressable 
      onPress={onPress} 
      style={({ pressed }) => [
        styles.container,
        pressed && { opacity: 0.7 }
      ]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      testID="notification-bell"
    >
      <Icon name="notifications-outline" size={24} color={theme.text} />
      {unreadCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: primaryColor }]}>
          <ThemedText style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});
