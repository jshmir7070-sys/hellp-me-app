import React, { useEffect, useCallback } from "react";
import { View, Pressable, StyleSheet, Switch, Linking, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Constants from "expo-constants";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark, themeMode, setThemeMode } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const { user } = useAuth();

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  const [pushNotifications, setPushNotifications] = React.useState(true);
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [smsNotifications, setSmsNotifications] = React.useState(false);

  // 서버에서 알림 설정 불러오기
  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest('GET', '/api/users/notification-settings');
        const settings = await res.json();
        setPushNotifications(settings.pushNotifications ?? true);
        setEmailNotifications(settings.emailNotifications ?? true);
        setSmsNotifications(settings.smsNotifications ?? false);
      } catch (err) {
        console.error('Failed to load notification settings:', err);
      }
    })();
  }, []);

  // 알림 설정 서버에 저장
  const updateNotificationSetting = useCallback(async (key: string, value: boolean) => {
    try {
      await apiRequest('PATCH', '/api/users/notification-settings', { [key]: value });
    } catch (err) {
      console.error('Failed to update notification setting:', err);
      Alert.alert('오류', '알림 설정 저장에 실패했습니다.');
    }
  }, []);

  const handlePushToggle = (value: boolean) => {
    setPushNotifications(value);
    updateNotificationSetting('pushNotifications', value);
  };

  const handleEmailToggle = (value: boolean) => {
    setEmailNotifications(value);
    updateNotificationSetting('emailNotifications', value);
  };

  const handleSmsToggle = (value: boolean) => {
    setSmsNotifications(value);
    updateNotificationSetting('smsNotifications', value);
  };

  const handleDarkModeToggle = (value: boolean) => {
    setThemeMode(value ? 'dark' : 'light');
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: showDesktopLayout ? Spacing.xl : tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        ...(showDesktopLayout && {
          maxWidth: containerMaxWidth,
          alignSelf: 'center' as const,
          width: '100%' as any,
        }),
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>알림 설정</ThemedText>

        <Card style={styles.settingsCard}>
          <SettingsRow
            icon="notifications-outline"
            label="푸시 알림"
            theme={theme}
            right={
              <Switch
                value={pushNotifications}
                onValueChange={handlePushToggle}
                trackColor={{ false: '#E0E0E0', true: primaryColor }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="mail-outline"
            label="이메일 알림"
            theme={theme}
            right={
              <Switch
                value={emailNotifications}
                onValueChange={handleEmailToggle}
                trackColor={{ false: '#E0E0E0', true: primaryColor }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="cellphone"
            label="SMS 알림"
            theme={theme}
            right={
              <Switch
                value={smsNotifications}
                onValueChange={handleSmsToggle}
                trackColor={{ false: '#E0E0E0', true: primaryColor }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </Card>
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>화면 설정</ThemedText>

        <Card style={styles.settingsCard}>
          <SettingsRow
            icon={isDark ? "weather-night" : "white-balance-sunny"}
            label="다크 모드"
            theme={theme}
            right={
              <Switch
                value={isDark}
                onValueChange={handleDarkModeToggle}
                trackColor={{ false: '#E0E0E0', true: primaryColor }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </Card>
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>계정 관리</ThemedText>

        <Card style={styles.settingsCard}>
          <Pressable onPress={() => navigation.navigate('EditProfile')}>
            <SettingsRow
              icon="person-outline"
              label="프로필 수정"
              theme={theme}
              right={<Icon name="chevron-forward-outline" size={20} color={theme.tabIconDefault} />}
            />
          </Pressable>
          <View style={styles.divider} />
          <Pressable onPress={() => navigation.navigate('ChangePassword')}>
            <SettingsRow
              icon="lock-closed-outline"
              label="비밀번호 변경"
              theme={theme}
              right={<Icon name="chevron-forward-outline" size={20} color={theme.tabIconDefault} />}
            />
          </Pressable>
          <View style={styles.divider} />
          <Pressable onPress={() => navigation.navigate('WithdrawAccount')}>
            <SettingsRow
              icon="person-remove-outline"
              label="회원탈퇴"
              theme={theme}
              right={<Icon name="chevron-forward-outline" size={20} color={BrandColors.error} />}
            />
          </Pressable>
        </Card>
      </View>

      {(user?.role === 'admin' || user?.role === 'superadmin') ? (
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>관리자 메뉴</ThemedText>

          <Card style={styles.settingsCard}>
            <Pressable onPress={() => navigation.navigate('AdminDisputeList')}>
              <SettingsRow
                icon="document-text-outline"
                label="이의제기관리"
                theme={theme}
                right={<Icon name="chevron-forward-outline" size={20} color={theme.tabIconDefault} />}
              />
            </Pressable>
            <View style={styles.divider} />
            <Pressable onPress={() => navigation.navigate('AdminIncidentList')}>
              <SettingsRow
                icon="warning-outline"
                label="화물사고접수"
                theme={theme}
                right={<Icon name="chevron-forward-outline" size={20} color={theme.tabIconDefault} />}
              />
            </Pressable>
            <View style={styles.divider} />
            <Pressable onPress={() => navigation.navigate('AdminDeductionList')}>
              <SettingsRow
                icon="remove-circle-outline"
                label="화물사고차감"
                theme={theme}
                right={<Icon name="chevron-forward-outline" size={20} color={theme.tabIconDefault} />}
              />
            </Pressable>
            <View style={styles.divider} />
            <Pressable onPress={() => navigation.navigate('AdminRefundList')}>
              <SettingsRow
                icon="cash-outline"
                label="화물사고환불"
                theme={theme}
                right={<Icon name="chevron-forward-outline" size={20} color={theme.tabIconDefault} />}
              />
            </Pressable>
          </Card>
        </View>
      ) : null}

      <ThemedText style={[styles.versionText, { color: theme.tabIconDefault }]}>
        버전 {Constants.expoConfig?.version || '1.0.0'}
      </ThemedText>
    </KeyboardAwareScrollViewCompat>
  );
}

function SettingsRow({
  icon,
  label,
  theme,
  right
}: {
  icon: string;
  label: string;
  theme: any;
  right: React.ReactNode;
}) {
  return (
    <View style={styles.settingsRow}>
      <View style={styles.settingsLeft}>
        <Icon name={icon as any} size={20} color={theme.text} />
        <ThemedText style={[styles.settingsLabel, { color: theme.text }]}>{label}</ThemedText>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing['2xl'],
  },
  sectionTitle: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  settingsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingsLabel: {
    ...Typography.body,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: Spacing.lg,
  },
  versionText: {
    ...Typography.small,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
