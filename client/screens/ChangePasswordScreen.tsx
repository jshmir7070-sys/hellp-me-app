import React, { useState } from "react";
import { View, StyleSheet, Alert, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from "@/constants/theme";

type ChangePasswordScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function ChangePasswordScreen({ navigation }: ChangePasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { user, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHelper = user?.role === "helper";
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;
  
  const inputBgColor = isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundSecondary;
  const borderColor = isDark ? Colors.dark.backgroundTertiary : Colors.light.backgroundTertiary;

  const validateForm = () => {
    if (!currentPassword) {
      setError("현재 비밀번호를 입력해주세요");
      return false;
    }
    if (!newPassword) {
      setError("새 비밀번호를 입력해주세요");
      return false;
    }
    if (newPassword.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다");
      return false;
    }
    return true;
  };

  const handleChangePassword = async () => {
    setError(null);
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) {
        setError("로그인이 필요합니다");
        return;
      }

      const response = await fetch(new URL("/api/auth/change-password", getApiUrl()).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "비밀번호 변경에 실패했습니다");
        return;
      }

      Alert.alert(
        "비밀번호 변경 완료",
        "비밀번호가 성공적으로 변경되었습니다. 보안을 위해 다시 로그인해주세요.",
        [
          {
            text: "확인",
            onPress: () => {
              logout();
            },
          },
        ]
      );
    } catch (err) {
      console.error("Change password error:", err);
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg + 94,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <ThemedText style={[styles.title, { color: theme.text }]}>
        비밀번호 변경
      </ThemedText>
      <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
        보안을 위해 정기적으로 비밀번호를 변경해주세요
      </ThemedText>

      <Card variant="glass" padding="lg" style={styles.formCard}>
        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            현재 비밀번호
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: inputBgColor,
                color: theme.text,
                borderColor: borderColor,
              },
            ]}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="현재 비밀번호 입력"
            placeholderTextColor={theme.tabIconDefault}
            testID="input-current-password"
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            새 비밀번호
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: inputBgColor,
                color: theme.text,
                borderColor: borderColor,
              },
            ]}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="새 비밀번호 (8자 이상)"
            placeholderTextColor={theme.tabIconDefault}
            testID="input-new-password"
          />
        </View>

        <View style={styles.inputGroup}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            새 비밀번호 확인
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: inputBgColor,
                color: theme.text,
                borderColor: borderColor,
              },
            ]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="새 비밀번호 다시 입력"
            placeholderTextColor={theme.tabIconDefault}
            testID="input-confirm-password"
          />
        </View>

        {error ? (
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        ) : null}

        <Button
          onPress={handleChangePassword}
          disabled={loading}
          style={[styles.submitButton, { backgroundColor: primaryColor }]}
        >
          {loading ? "변경 중..." : "비밀번호 변경"}
        </Button>
      </Card>

      <ThemedText style={[styles.notice, { color: theme.tabIconDefault }]}>
        비밀번호 변경 후 자동으로 로그아웃됩니다.{"\n"}
        새 비밀번호로 다시 로그인해주세요.
      </ThemedText>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  title: {
    ...Typography.h2,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
    marginBottom: Spacing["2xl"],
  },
  formCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.small,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  input: {
    ...Typography.body,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  errorText: {
    ...Typography.small,
    color: "BrandColors.error",
    marginBottom: Spacing.md,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  notice: {
    ...Typography.small,
    textAlign: "center",
    lineHeight: 20,
  },
});
