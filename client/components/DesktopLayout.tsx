import React from 'react';
import { View, StyleSheet, Text, Pressable, Platform, ScrollView } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { useTheme } from '@/hooks/useTheme';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NavItem {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
}

interface DesktopLayoutProps {
  children: React.ReactNode;
  navItems: NavItem[];
  title?: string;
  userType?: 'helper' | 'requester';
}

export function DesktopLayout({
  children,
  navItems,
  title = 'Hellp Me',
  userType = 'helper',
}: DesktopLayoutProps) {
  const { isDesktop, isTablet, sidebarWidth } = useResponsive();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const showSidebar = isDesktop || isTablet;
  const primaryColor = userType === 'helper' ? colors.primary : colors.secondary;

  if (!showSidebar) {
    return <>{children}</>;
  }

  const isActiveRoute = (itemRoute: string) => {
    return route.name.toLowerCase().includes(itemRoute.toLowerCase());
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.sidebar,
          {
            width: sidebarWidth,
            backgroundColor: colors.surface,
            borderRightColor: colors.border,
            paddingTop: insets.top,
          },
        ]}
      >
        <View style={styles.logoContainer}>
          <View style={[styles.logoIcon, { backgroundColor: primaryColor }]}>
            <Feather name="truck" size={24} color="#fff" />
          </View>
          <Text style={[styles.logoText, { color: colors.text }]}>{title}</Text>
        </View>

        <ScrollView style={styles.navContainer} showsVerticalScrollIndicator={false}>
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.route);
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.navItem,
                  isActive && { backgroundColor: `${primaryColor}15` },
                ]}
                onPress={() => navigation.navigate(item.route)}
              >
                <Feather
                  name={item.icon}
                  size={20}
                  color={isActive ? primaryColor : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.navLabel,
                    { color: isActive ? primaryColor : colors.textSecondary },
                    isActive && styles.navLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
                {isActive && (
                  <View
                    style={[styles.activeIndicator, { backgroundColor: primaryColor }]}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {userType === 'helper' ? '헬퍼' : '요청자'} 모드
          </Text>
        </View>
      </View>

      <View style={[styles.content, { marginLeft: sidebarWidth }]}>
        {children}
      </View>
    </View>
  );
}

interface DesktopCardGridProps {
  children: React.ReactNode;
  columns?: number;
}

export function DesktopCardGrid({ children, columns }: DesktopCardGridProps) {
  const { isDesktop, isTablet, isMobile } = useResponsive();
  
  const gridColumns = columns ?? (isDesktop ? 3 : isTablet ? 2 : 1);
  const gap = isDesktop ? 24 : 16;

  if (isMobile) {
    return <View style={{ gap: 12 }}>{children}</View>;
  }

  const childArray = React.Children.toArray(children);

  return (
    <View style={[styles.cardGrid, { gap }]}>
      {childArray.map((child, index) => (
        <View
          key={index}
          style={{
            width: `${(100 / gridColumns) - 2}%` as any,
            minWidth: 280,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

interface DesktopSplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
  leftWidth?: number | string;
  gap?: number;
}

export function DesktopSplitView({
  left,
  right,
  leftWidth = '40%',
  gap = 24,
}: DesktopSplitViewProps) {
  const { isMobile, isTablet } = useResponsive();

  if (isMobile) {
    return (
      <View style={{ gap: 16 }}>
        {left}
        {right}
      </View>
    );
  }

  return (
    <View style={[styles.splitView, { gap }]}>
      <View style={{ width: leftWidth as any, flexShrink: 0 }}>{left}</View>
      <View style={{ flex: 1 }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    zIndex: 100,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
  },
  navContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
    gap: 12,
  },
  navLabel: {
    fontSize: 14,
    flex: 1,
  },
  navLabelActive: {
    fontWeight: '600',
  },
  activeIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  splitView: {
    flexDirection: 'row',
  },
});
