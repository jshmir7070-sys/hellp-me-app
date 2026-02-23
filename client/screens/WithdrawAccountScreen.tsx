import React, { useState } from "react";
import { View, Pressable, StyleSheet, Alert, Platform, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getToken } from '@/utils/secure-token-storage';

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

type WithdrawAccountScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const WITHDRAW_REASONS = [
  { id: 'not_using', label: '서비스를 더 이상 이용하지 않음' },
  { id: 'inconvenient', label: '서비스 이용이 불편함' },
  { id: 'other_service', label: '다른 서비스를 이용함' },
  { id: 'personal', label: '개인 사정' },
  { id: 'other', label: '기타' },
];

export default function WithdrawAccountScreen({ navigation }: WithdrawAccountScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const { user, logout } = useAuth();

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  const handleWithdraw = async () => {
    if (!selectedReason) {
      Alert.alert('알림', '탈퇴 사유를 선택해주세요');
      return;
    }

    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsLoading(true);
    try {
      const token = await getToken();
      const reason = WITHDRAW_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;
      
      const response = await fetch(new URL('/api/auth/withdraw', getApiUrl()).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password, reason }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('오류', data.message || '회원탈퇴에 실패했습니다');
        return;
      }

      Alert.alert(
        '탈퇴 완료',
        '회원탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.',
        [{ text: '확인', onPress: () => logout() }]
      );
    } catch (error) {
      console.error('Withdraw error:', error);
      Alert.alert('오류', '회원탈퇴 처리 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
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
      <Card style={styles.warningCard}>
        <View style={styles.warningHeader}>
          <Icon name="alert-circle-outline" size={24} color={BrandColors.error} />
          <ThemedText style={[styles.warningTitle, { color: BrandColors.error }]}>
            회원탈퇴 안내
          </ThemedText>
        </View>
        <ThemedText style={[styles.warningText, { color: theme.text }]}>
          회원탈퇴 시 다음 사항을 확인해주세요:
        </ThemedText>
        <View style={styles.warningList}>
          <ThemedText style={[styles.warningItem, { color: theme.tabIconDefault }]}>
            • 모든 개인정보가 삭제됩니다 (복구 불가)
          </ThemedText>
          <ThemedText style={[styles.warningItem, { color: theme.tabIconDefault }]}>
            • 진행 중인 오더가 없어야 합니다
          </ThemedText>
          <ThemedText style={[styles.warningItem, { color: theme.tabIconDefault }]}>
            • 미정산 금액이 없어야 합니다
          </ThemedText>
          <ThemedText style={[styles.warningItem, { color: theme.tabIconDefault }]}>
            • 동일 이메일로 재가입은 가능합니다
          </ThemedText>
        </View>
      </Card>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>
          탈퇴 사유를 선택해주세요
        </ThemedText>
        
        <Card style={styles.reasonCard}>
          {WITHDRAW_REASONS.map((reason, index) => (
            <React.Fragment key={reason.id}>
              <Pressable
                style={styles.reasonRow}
                onPress={() => setSelectedReason(reason.id)}
              >
                <View style={styles.reasonLeft}>
                  <View style={[
                    styles.radioOuter,
                    { borderColor: selectedReason === reason.id ? primaryColor : theme.tabIconDefault }
                  ]}>
                    {selectedReason === reason.id ? (
                      <View style={[styles.radioInner, { backgroundColor: primaryColor }]} />
                    ) : null}
                  </View>
                  <ThemedText style={[styles.reasonLabel, { color: theme.text }]}>
                    {reason.label}
                  </ThemedText>
                </View>
              </Pressable>
              {index < WITHDRAW_REASONS.length - 1 ? <View style={styles.divider} /> : null}
            </React.Fragment>
          ))}
        </Card>
      </View>

      {showConfirm ? (
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.tabIconDefault }]}>
            비밀번호 확인
          </ThemedText>
          <Card style={styles.passwordCard}>
            <TextInput
              style={[styles.passwordInput, { color: theme.text, backgroundColor: theme.backgroundDefault }]}
              placeholder="비밀번호를 입력하세요"
              placeholderTextColor={theme.tabIconDefault}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
            <ThemedText style={[styles.passwordHint, { color: theme.tabIconDefault }]}>
              본인 확인을 위해 비밀번호를 입력해주세요
            </ThemedText>
          </Card>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.withdrawButton,
          { 
            backgroundColor: BrandColors.error,
            opacity: pressed || isLoading ? 0.7 : 1,
          },
        ]}
        onPress={handleWithdraw}
        disabled={isLoading}
      >
        <ThemedText style={styles.withdrawButtonText}>
          {isLoading ? '처리 중...' : showConfirm ? '회원탈퇴 완료' : '회원탈퇴 진행'}
        </ThemedText>
      </Pressable>

      <Pressable
        style={[styles.cancelButton, { borderColor: theme.tabIconDefault }]}
        onPress={() => navigation.goBack()}
      >
        <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>
          취소
        </ThemedText>
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  warningCard: {
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
    backgroundColor: '#FEF2F2',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  warningTitle: {
    ...Typography.h4,
    fontWeight: '600',
  },
  warningText: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  warningList: {
    gap: Spacing.xs,
  },
  warningItem: {
    ...Typography.small,
  },
  section: {
    marginBottom: Spacing['2xl'],
  },
  sectionTitle: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  reasonCard: {
    padding: 0,
    overflow: 'hidden',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  reasonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reasonLabel: {
    ...Typography.body,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: Spacing.lg,
  },
  passwordCard: {
    padding: Spacing.lg,
  },
  passwordInput: {
    ...Typography.body,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  passwordHint: {
    ...Typography.small,
  },
  withdrawButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  withdrawButtonText: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cancelButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: {
    ...Typography.body,
    fontWeight: '500',
  },
});
