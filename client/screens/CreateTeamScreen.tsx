import React, { useState } from "react";
import { View, StyleSheet, Pressable, Alert, Platform, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Icon } from "@/components/Icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { apiRequest } from "@/lib/query-client";

type CreateTeamScreenProps = NativeStackScreenProps<any, 'CreateTeam'>;

export default function CreateTeamScreen({ navigation }: CreateTeamScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const primaryColor = BrandColors.helper;

  const [teamCode, setTeamCode] = useState("");

  const joinMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/helper/join-team", {
        qrCode: teamCode.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/helper/my-team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my-team"] });
      if (Platform.OS === "web") {
        alert("팀에 가입되었습니다!");
      } else {
        Alert.alert("가입 완료", "팀에 성공적으로 가입되었습니다.", [
          { text: "확인", onPress: () => navigation.goBack() },
        ]);
      }
    },
    onError: (err: Error) => {
      const message = err.message || "팀 가입에 실패했습니다.";
      if (Platform.OS === "web") {
        alert(message);
      } else {
        Alert.alert("오류", message);
      }
    },
  });

  const handleJoin = () => {
    const code = teamCode.trim();
    if (!code) {
      Alert.alert("알림", "팀 코드를 입력해주세요.");
      return;
    }
    joinMutation.mutate();
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      {/* 안내 카드 */}
      <Card style={styles.infoCard}>
        <View style={[styles.iconContainer, { backgroundColor: BrandColors.helperLight }]}>
          <Icon name="people-outline" size={32} color={primaryColor} />
        </View>
        <ThemedText style={[styles.title, { color: theme.text }]}>
          팀 가입하기
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          팀장 또는 협력업체에서 전달받은{'\n'}팀 고유 코드를 입력하세요
        </ThemedText>
      </Card>

      {/* 코드 입력 */}
      <Card style={styles.inputCard}>
        <ThemedText style={[styles.label, { color: theme.text }]}>팀 코드 *</ThemedText>
        <TextInput
          style={[
            styles.codeInput,
            {
              color: theme.text,
              borderColor: teamCode.trim() ? primaryColor : theme.backgroundTertiary,
              backgroundColor: theme.backgroundDefault,
            },
          ]}
          value={teamCode}
          onChangeText={setTeamCode}
          placeholder="팀 코드를 입력하세요"
          placeholderTextColor={theme.tabIconDefault}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <ThemedText style={[styles.hint, { color: theme.tabIconDefault }]}>
          예: TEAM-1234567890-A1B2C3
        </ThemedText>
      </Card>

      {/* 가입 버튼 */}
      <Pressable
        style={[
          styles.joinButton,
          { backgroundColor: primaryColor },
          joinMutation.isPending && { opacity: 0.7 },
        ]}
        onPress={handleJoin}
        disabled={joinMutation.isPending}
      >
        {joinMutation.isPending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Icon name="enter-outline" size={20} color="#fff" />
            <ThemedText style={styles.joinButtonText}>팀 가입</ThemedText>
          </>
        )}
      </Pressable>

      {/* 안내사항 */}
      <Card style={[styles.guideCard, { backgroundColor: BrandColors.helperLight }]}>
        <View style={styles.guideHeader}>
          <Icon name="information-circle-outline" size={18} color={primaryColor} />
          <ThemedText style={[styles.guideTitle, { color: primaryColor }]}>안내</ThemedText>
        </View>
        <ThemedText style={[styles.guideText, { color: theme.tabIconDefault }]}>
          • 팀은 관리자가 생성하고, 팀장에게 고유 코드가 부여됩니다{'\n'}
          • 팀장 또는 협력업체로부터 팀 코드를 전달받으세요{'\n'}
          • 팀 코드 입력 시 자동으로 해당 팀에 가입됩니다{'\n'}
          • 이미 다른 팀에 소속된 경우 기존 팀에서 탈퇴 후 가입 가능합니다
        </ThemedText>
      </Card>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    padding: Spacing['2xl'],
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  codeInput: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1,
  },
  hint: {
    fontSize: 12,
    marginTop: Spacing.sm,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  guideCard: {
    padding: Spacing.lg,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  guideText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
