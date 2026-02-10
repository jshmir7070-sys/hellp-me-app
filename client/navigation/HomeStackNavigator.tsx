import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { Icon } from "@/components/Icon";
import { useQuery } from "@tanstack/react-query";
import HomeScreen from "@/screens/HomeScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import ApplicantListScreen from "@/screens/ApplicantListScreen";
import RequesterClosingScreen from "@/screens/RequesterClosingScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { BrandColors } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";

export type HomeStackParamList = {
  Home: undefined;
  Notifications: undefined;
  ApplicantList: { orderId: number };
  RequesterClosing: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

function HomeHeaderRight() {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const primaryColor = user?.role === "helper" ? BrandColors.helper : BrandColors.requester;

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count || 0;

  const handlePress = () => {
    navigation.navigate("Notifications");
  };

  return (
    <TouchableOpacity 
      onPress={handlePress}
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      style={styles.pressableContainer}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel="알림"
    >
      <View style={styles.bellContainer}>
        <Icon name="notifications-outline" size={28} color={theme.text} />
        {unreadCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: primaryColor }]}>
            <ThemedText style={styles.badgeText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pressableContainer: {
    padding: 12,
    marginRight: Platform.OS === "ios" ? 4 : 12,
    zIndex: 999,
  },
  bellContainer: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
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

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => <HeaderTitle size="small" />,
          headerLeft: () => null, // Toss-style: no back button on main tab
          headerRight: () => <HomeHeaderRight />,
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerTitle: "알림",
        }}
      />
      <Stack.Screen
        name="ApplicantList"
        component={ApplicantListScreen}
        options={{
          headerTitle: "지원자 목록",
        }}
      />
      <Stack.Screen
        name="RequesterClosing"
        component={RequesterClosingScreen}
        options={{
          headerTitle: "마감 확인",
        }}
      />
    </Stack.Navigator>
  );
}
