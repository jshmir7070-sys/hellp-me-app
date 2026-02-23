import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Image, ScrollView } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { Avatar } from '@/components/Avatar';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useResponsive } from '@/hooks/useResponsive';
import { Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';

const COLLAPSED_WIDTH = 64;

/**
 * 데스크탑 웹 전용 사이드바.
 * @react-navigation/bottom-tabs의 tabBar prop으로 전달됨.
 */
export function DesktopSidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const { sidebarWidth } = useResponsive();
  const insets = useSafeAreaInsets();
  const [collapsed, setCollapsed] = useState(false);

  const isHelper = user?.role === 'helper';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const accentColor = isAdmin ? BrandColors.helper : isHelper ? BrandColors.helper : BrandColors.requester;
  const currentWidth = collapsed ? COLLAPSED_WIDTH : sidebarWidth;

  const handleTabPress = (routeName: string, isFocused: boolean) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes.find(r => r.name === routeName)?.key ?? '',
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <View
      style={[
        styles.sidebar,
        {
          width: currentWidth,
          backgroundColor: theme.backgroundRoot,
          borderRightColor: theme.border,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* 로고 영역 */}
      <View style={[styles.logoSection, { borderBottomColor: theme.border }]}>
        {collapsed ? (
          <ThemedText style={[styles.logoCollapsed, { color: accentColor }]}>H</ThemedText>
        ) : (
          <Image
            source={require('@/assets/images/hellpme-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        )}
      </View>

      {/* 네비게이션 아이템 */}
      <ScrollView style={styles.navSection} showsVerticalScrollIndicator={false}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label = (options.tabBarLabel ?? options.title ?? route.name) as string;
          const icon = options.tabBarIcon;

          return (
            <Pressable
              key={route.key}
              onPress={() => handleTabPress(route.name, isFocused)}
              style={({ pressed }) => [
                styles.navItem,
                collapsed && styles.navItemCollapsed,
                {
                  backgroundColor: isFocused
                    ? isDark ? 'rgba(255,255,255,0.1)' : `${accentColor}10`
                    : pressed
                    ? isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                    : 'transparent',
                  borderLeftColor: isFocused ? accentColor : 'transparent',
                },
              ]}
            >
              <View style={styles.navIconContainer}>
                {icon?.({
                  focused: isFocused,
                  color: isFocused ? accentColor : theme.tabIconDefault,
                  size: 22,
                })}
              </View>
              {!collapsed && (
                <ThemedText
                  style={[
                    styles.navLabel,
                    {
                      color: isFocused ? accentColor : theme.tabIconDefault,
                      fontWeight: isFocused ? '600' : '400',
                    },
                  ]}
                >
                  {label}
                </ThemedText>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 하단 영역: 프로필 + 접기/펼치기 */}
      <View style={[styles.bottomSection, { borderTopColor: theme.border }]}>
        {/* 접기/펼치기 토글 */}
        <Pressable
          onPress={() => setCollapsed(!collapsed)}
          style={[styles.toggleButton, collapsed && styles.toggleButtonCollapsed]}
        >
          <Icon
            name={collapsed ? 'chevron-forward-outline' : 'chevron-back-outline'}
            size={18}
            color={theme.tabIconDefault}
          />
          {!collapsed && (
            <ThemedText style={[styles.toggleText, { color: theme.tabIconDefault }]}>
              메뉴 접기
            </ThemedText>
          )}
        </Pressable>

        {/* 사용자 정보 */}
        <View style={[styles.userSection, collapsed && styles.userSectionCollapsed]}>
          <Avatar
            uri={user?.profileImageUrl}
            size={collapsed ? 32 : 36}
            isHelper={isHelper}
          />
          {!collapsed && (
            <View style={styles.userInfo}>
              <ThemedText style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                {user?.name || '사용자'}
              </ThemedText>
              <ThemedText style={[styles.userRole, { color: theme.tabIconDefault }]}>
                {isAdmin ? '관리자' : isHelper ? '헬퍼' : '요청자'}
              </ThemedText>
            </View>
          )}
        </View>

        {/* 로그아웃 */}
        <Pressable
          onPress={logout}
          style={[styles.logoutButton, collapsed && styles.logoutButtonCollapsed]}
        >
          <Icon name="log-out-outline" size={20} color={theme.tabIconDefault} />
          {!collapsed && (
            <ThemedText style={[styles.logoutText, { color: theme.tabIconDefault }]}>
              로그아웃
            </ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    zIndex: 100,
  },
  logoSection: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  logoImage: {
    width: 120,
    height: 36,
  },
  logoCollapsed: {
    fontSize: 24,
    fontWeight: '700',
  },
  navSection: {
    flex: 1,
    paddingVertical: Spacing.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.xs,
    marginVertical: 2,
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    marginHorizontal: Spacing.xs,
  },
  navIconContainer: {
    width: 28,
    alignItems: 'center',
  },
  navLabel: {
    ...Typography.body,
    marginLeft: Spacing.md,
    fontSize: 14,
  },
  bottomSection: {
    borderTopWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  toggleButtonCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  toggleText: {
    ...Typography.small,
    marginLeft: Spacing.sm,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  userSectionCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
    overflow: 'hidden',
  },
  userName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '500',
  },
  userRole: {
    ...Typography.small,
    fontSize: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  logoutButtonCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  logoutText: {
    ...Typography.body,
    fontSize: 14,
    marginLeft: Spacing.sm,
  },
});
