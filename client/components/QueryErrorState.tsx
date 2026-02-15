/**
 * API 조회 실패 시 표시하는 공통 에러 상태 컴포넌트
 *
 * useQuery의 error/isError 상태와 함께 사용합니다.
 *
 * 사용 예:
 *   const { data, isLoading, isError, error, refetch } = useQuery(...);
 *   if (isError) return <QueryErrorState error={error} onRetry={refetch} />;
 */

import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Icon } from "@/components/Icon";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";

interface QueryErrorStateProps {
  /** 에러 객체 */
  error?: Error | null;
  /** 재시도 콜백 */
  onRetry?: () => void;
  /** 커스텀 메시지 (미지정 시 기본 메시지) */
  message?: string;
  /** 컴팩트 모드 (작은 카드 안에 표시할 때) */
  compact?: boolean;
}

export function QueryErrorState({ error, onRetry, message, compact = false }: QueryErrorStateProps) {
  const { theme } = useTheme();

  const displayMessage = message || error?.message || "데이터를 불러올 수 없습니다.";

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Icon name="alert-circle-outline" size={20} color={BrandColors.error} />
        <ThemedText style={[styles.compactText, { color: theme.tabIconDefault }]} numberOfLines={2}>
          {displayMessage}
        </ThemedText>
        {onRetry && (
          <Pressable onPress={onRetry} hitSlop={8}>
            <Icon name="refresh-outline" size={20} color={BrandColors.primary} />
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Icon name="cloud-offline-outline" size={48} color={theme.tabIconDefault} />
      <ThemedText style={[styles.title, { color: theme.text }]}>
        불러오기 실패
      </ThemedText>
      <ThemedText style={[styles.message, { color: theme.tabIconDefault }]}>
        {displayMessage}
      </ThemedText>
      {onRetry && (
        <Pressable
          style={[styles.retryButton, { backgroundColor: BrandColors.primary }]}
          onPress={onRetry}
        >
          <Icon name="refresh-outline" size={18} color="#fff" />
          <ThemedText style={styles.retryText}>다시 시도</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["2xl"],
    gap: Spacing.md,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  compactText: {
    flex: 1,
    fontSize: 13,
  },
});
