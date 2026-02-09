import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

type FindEmailScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function FindEmailScreen({ navigation }: FindEmailScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundEmail, setFoundEmail] = useState<string | null>(null);

  async function handleFindEmail() {
    if (!name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    if (!phoneNumber.trim()) {
      setError('휴대폰 번호를 입력해주세요');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFoundEmail(null);

    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/find-email', baseUrl).href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phoneNumber: phoneNumber.trim().replace(/-/g, ''),
        }),
      });

      const data = await res.json();

      if (res.ok && data.email) {
        setFoundEmail(data.email);
      } else {
        setError(data.message || '일치하는 계정을 찾을 수 없습니다');
      }
    } catch (e) {
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  }

  function maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 3) {
      return `${localPart[0]}***@${domain}`;
    }
    const visible = localPart.substring(0, 3);
    return `${visible}***@${domain}`;
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xl }
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerSection}>
            <Icon name="mail-outline" size={48} color={BrandColors.primary} />
            <ThemedText style={styles.title}>아이디 찾기</ThemedText>
            <ThemedText style={[styles.description, { color: Colors.light.tabIconDefault }]}>
              가입 시 등록한 이름과 휴대폰 번호를 입력하세요
            </ThemedText>
          </View>

          {foundEmail ? (
            <Card variant="glass" padding="xl" style={styles.resultCard}>
              <Icon name="checkmark-circle" size={48} color={BrandColors.success} />
              <ThemedText style={styles.resultTitle}>아이디를 찾았습니다</ThemedText>
              <ThemedText style={styles.resultEmail}>{maskEmail(foundEmail)}</ThemedText>
              <View style={styles.resultButtons}>
                <Pressable
                  style={[styles.resultButton, { backgroundColor: BrandColors.primary }]}
                  onPress={() => navigation.goBack()}
                >
                  <ThemedText style={styles.resultButtonText}>로그인하기</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.resultButton, styles.outlineButton, { borderColor: theme.backgroundTertiary }]}
                  onPress={() => navigation.navigate('FindPassword')}
                >
                  <ThemedText style={[styles.resultButtonText, { color: theme.text }]}>
                    비밀번호 찾기
                  </ThemedText>
                </Pressable>
              </View>
            </Card>
          ) : (
            <View style={styles.formContainer}>
              {error ? (
                <View style={styles.errorContainer}>
                  <ThemedText style={styles.errorText}>{error}</ThemedText>
                </View>
              ) : null}

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>이름</ThemedText>
                <TextInput
                  testID="input-name"
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                    },
                  ]}
                  placeholder="이름을 입력하세요"
                  placeholderTextColor={Colors.light.tabIconDefault}
                  value={name}
                  onChangeText={setName}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>휴대폰 번호</ThemedText>
                <TextInput
                  testID="input-phone"
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                    },
                  ]}
                  placeholder="010-1234-5678"
                  placeholderTextColor={Colors.light.tabIconDefault}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  editable={!isLoading}
                />
              </View>

              <Pressable
                testID="button-find"
                style={({ pressed }) => [
                  styles.submitButton,
                  { opacity: pressed ? 0.7 : 1 },
                  isLoading && styles.buttonDisabled,
                ]}
                onPress={handleFindEmail}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.submitButtonText}>아이디 찾기</ThemedText>
                )}
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  title: {
    ...Typography.h2,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  description: {
    ...Typography.body,
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: BrandColors.errorLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: BrandColors.error,
    ...Typography.small,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    ...Typography.body,
  },
  submitButton: {
    height: Spacing.buttonHeight,
    backgroundColor: BrandColors.primary,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
  resultCard: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  resultTitle: {
    ...Typography.h4,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  resultEmail: {
    ...Typography.h3,
    color: BrandColors.primary,
    marginBottom: Spacing.xl,
  },
  resultButtons: {
    width: '100%',
    gap: Spacing.md,
  },
  resultButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  resultButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
});
