import React, { useState, useEffect } from "react";
import { View, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { apiRequest } from "@/lib/query-client";

interface BankAccount {
  id: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

const BANKS = [
  "KB국민은행", "신한은행", "우리은행", "하나은행", "SC제일은행",
  "농협은행", "기업은행", "카카오뱅크", "케이뱅크", "토스뱅크",
  "새마을금고", "신협", "우체국", "수협", "부산은행", "대구은행",
  "광주은행", "전북은행", "경남은행", "제주은행"
];

export default function PaymentSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [showBankPicker, setShowBankPicker] = useState(false);

  const { data, isLoading, error } = useQuery<BankAccount | null>({
    queryKey: ['/api/helpers/bank-account'],
    enabled: isHelper,
    retry: false,
  });

  const hasAccount = data && !error;

  useEffect(() => {
    if (data) {
      setBankName(data.bankName || '');
      setAccountNumber(data.accountNumber || '');
      setAccountHolder(data.accountHolder || '');
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (payload: { bankName: string; accountNumber: string; accountHolder: string }) => {
      const res = await apiRequest('POST', '/api/helpers/bank-account', payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/helpers/bank-account'] });
      if (Platform.OS !== 'web') {
        Alert.alert('알림', '정산 계좌가 저장되었습니다.');
      }
    },
    onError: (error: Error) => {
      if (Platform.OS !== 'web') {
        Alert.alert('오류', error.message || '저장에 실패했습니다.');
      }
    },
  });

  const handleSave = () => {
    if (!bankName || !accountNumber || !accountHolder) {
      if (Platform.OS !== 'web') {
        Alert.alert('알림', '모든 정보를 입력해주세요.');
      }
      return;
    }
    mutation.mutate({ bankName, accountNumber, accountHolder });
  };

  if (!isHelper) {
    return (
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
      >
        <Card variant="glass" padding="xl" style={styles.comingSoonCard}>
          <View style={[styles.iconContainer, { backgroundColor: BrandColors.requesterLight }]}>
            <Icon name="card-outline" size={32} color={primaryColor} />
          </View>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            결제 수단
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
            이 기능은 곧 출시됩니다
          </ThemedText>
        </Card>
      </KeyboardAwareScrollViewCompat>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <Card variant="glass" padding="lg" style={styles.card}>
        <View style={[styles.iconHeader, { backgroundColor: BrandColors.helperLight }]}>
          <Icon name="cash-outline" size={24} color={primaryColor} />
        </View>
        <ThemedText style={[styles.title, { color: theme.text }]}>
          정산 계좌 정보
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          정산금을 받을 계좌를 등록해주세요
        </ThemedText>

        <View style={styles.formSection}>
          <ThemedText style={[styles.label, { color: theme.text }]}>은행</ThemedText>
          <Pressable
            style={[styles.selectInput, { backgroundColor: theme.backgroundDefault, borderColor: theme.backgroundSecondary }]}
            onPress={() => setShowBankPicker(!showBankPicker)}
          >
            <ThemedText style={[styles.selectText, { color: bankName ? theme.text : theme.tabIconDefault }]}>
              {bankName || "은행을 선택하세요"}
            </ThemedText>
            <Icon name="chevron-down-outline" size={20} color={theme.tabIconDefault} />
          </Pressable>

          {showBankPicker ? (
            <Card variant="glass" padding="md" style={styles.bankPickerCard}>
              <ScrollView style={styles.bankPickerScroll} nestedScrollEnabled>
                {BANKS.map((bank) => (
                  <Pressable
                    key={bank}
                    style={[
                      styles.bankOption,
                      bankName === bank && { backgroundColor: BrandColors.helperLight },
                    ]}
                    onPress={() => {
                      setBankName(bank);
                      setShowBankPicker(false);
                    }}
                  >
                    <ThemedText style={[styles.bankOptionText, { color: theme.text }]}>
                      {bank}
                    </ThemedText>
                    {bankName === bank ? (
                      <Icon name="checkmark-outline" size={18} color={primaryColor} />
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </Card>
          ) : null}

          <ThemedText style={[styles.label, { color: theme.text, marginTop: Spacing.lg }]}>
            계좌번호
          </ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundDefault, borderColor: theme.backgroundSecondary, color: theme.text }]}
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="'-' 없이 숫자만 입력"
            placeholderTextColor={theme.tabIconDefault}
            keyboardType="number-pad"
          />

          <ThemedText style={[styles.label, { color: theme.text, marginTop: Spacing.lg }]}>
            예금주
          </ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundDefault, borderColor: theme.backgroundSecondary, color: theme.text }]}
            value={accountHolder}
            onChangeText={setAccountHolder}
            placeholder="예금주명 입력"
            placeholderTextColor={theme.tabIconDefault}
          />
        </View>

        <Pressable
          style={[styles.saveButton, { backgroundColor: primaryColor, opacity: mutation.isPending ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.saveButtonText}>
              {hasAccount ? "수정하기" : "등록하기"}
            </ThemedText>
          )}
        </Pressable>
      </Card>

      <Card variant="outline" padding="md" style={StyleSheet.flatten([styles.infoCard, { marginTop: Spacing.lg }])}>
        <View style={styles.infoRow}>
          <Icon name="information-circle-outline" size={16} color={theme.tabIconDefault} />
          <ThemedText style={[styles.infoText, { color: theme.tabIconDefault }]}>
            정산금은 매월 1일에 등록된 계좌로 지급됩니다
          </ThemedText>
        </View>
      </Card>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    padding: Spacing.xl,
  },
  comingSoonCard: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  iconHeader: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.md,
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
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.small,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  formSection: {
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  selectInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    ...Typography.body,
  },
  bankPickerCard: {
    marginTop: Spacing.sm,
    maxHeight: 200,
  },
  bankPickerScroll: {
    maxHeight: 180,
  },
  bankOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  bankOptionText: {
    ...Typography.body,
  },
  saveButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    ...Typography.body,
    fontWeight: '600',
  },
  infoCard: {
    padding: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.small,
    flex: 1,
  },
});
