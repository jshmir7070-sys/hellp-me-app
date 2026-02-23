import React from "react";
import { createBottomTabNavigator, BottomTabBar } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Text, Alert, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import JobsStackNavigator from "@/navigation/JobsStackNavigator";
import CreateJobStackNavigator from "@/navigation/CreateJobStackNavigator";
import ClosingStackNavigator from "@/navigation/ClosingStackNavigator";
import SettlementStackNavigator from "@/navigation/SettlementStackNavigator";
import ReviewStackNavigator from "@/navigation/ReviewStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useResponsive } from "@/hooks/useResponsive";
import { BrandColors, Spacing } from "@/constants/theme";

export type MainTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  CreateOrderTab: undefined;
  WorkStatusTab: undefined;
  SettlementTab: undefined;
  ReviewsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const unreadCount = useUnreadNotifications();
  const { isDesktop, isTablet, sidebarWidth, showDesktopLayout } = useResponsive();
  const insets = useSafeAreaInsets();

  const isHelper = user?.role === 'helper';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const accentColor = isAdmin ? BrandColors.helper : isHelper ? BrandColors.helper : BrandColors.requester;

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      tabBar={(props) => showDesktopLayout ? <DesktopSidebar {...props} /> : <BottomTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: accentColor,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: showDesktopLayout ? {
          display: 'none',
        } : {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" && !showDesktopLayout ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
        sceneStyle: showDesktopLayout ? {
          marginLeft: sidebarWidth,
        } : undefined,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "홈",
          tabBarIcon: ({ color, size }) => (
            <Icon name="home-outline" size={size} color={color} />
          ),
          tabBarButtonTestID: "tab-home",
        }}
      />
      
      {isHelper || isAdmin ? (
        <Tab.Screen
          name="OrdersTab"
          component={JobsStackNavigator}
          options={{
            title: "오더공고",
            tabBarIcon: ({ color, size }) => (
              <Icon name="document-text-outline" size={size} color={color} />
            ),
            tabBarButtonTestID: "tab-orders",
          }}
        />
      ) : (
        <Tab.Screen
          name="CreateOrderTab"
          component={CreateJobStackNavigator}
          options={{
            title: "오더등록",
            tabBarIcon: ({ color, size }) => (
              <Icon name="add-circle-outline" size={size} color={color} />
            ),
            tabBarButtonTestID: "tab-create-order",
          }}
        />
      )}

      <Tab.Screen
        name="WorkStatusTab"
        component={ClosingStackNavigator}
        options={{
          title: isAdmin ? "마감관리" : isHelper ? "마감" : "마감확인",
          tabBarIcon: ({ color, size }) => (
            <Icon name="checkmark-circle-outline" size={size} color={color} />
          ),
          tabBarButtonTestID: "tab-work-status",
        }}
      />

      {isHelper ? (
        <Tab.Screen
          name="SettlementTab"
          component={SettlementStackNavigator}
          options={{
            title: "정산",
            tabBarIcon: ({ color, size }) => (
              <Icon name="card-outline" size={size} color={color} />
            ),
            tabBarButtonTestID: "tab-settlement",
          }}
        />
      ) : isAdmin ? (
        <Tab.Screen
          name="ReviewsTab"
          component={ReviewStackNavigator}
          options={{
            title: "이력/리뷰",
            tabBarIcon: ({ color, size }) => (
              <Icon name="list-outline" size={size} color={color} />
            ),
            tabBarButtonTestID: "tab-reviews",
          }}
        />
      ) : (
        <Tab.Screen
          name="ReviewsTab"
          component={ReviewStackNavigator}
          options={{
            title: "이력/리뷰",
            tabBarIcon: ({ color, size }) => (
              <Icon name="list-outline" size={size} color={color} />
            ),
            tabBarButtonTestID: "tab-reviews",
          }}
        />
      )}

      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "나의정보",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Icon name="person-outline" size={size} color={color} />
              {unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          ),
          tabBarButtonTestID: "tab-profile",
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
