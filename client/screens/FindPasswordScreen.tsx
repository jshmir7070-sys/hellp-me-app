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

type FindPasswordScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function FindPasswordScreen({ navigation }: FindPasswordScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [devPassword, setDevPassword] = useState<string | null>(null);

  async function handleResetPassword() {
    if (!email.trim()) {
      setError('이메일을 입력해주세요');
      return;
    }
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

    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/reset-password', baseUrl).href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          phoneNumber: phoneNumber.trim().replace(/-/g, ''),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
        if (data.devPassword) {
          setDevPassword(data.devPassword);
        }
      } else {
        setError(data.message || '비밀번호 재설정에 실패했습니다');
      }
    } catch (e) {
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  }

  const renderForm = () => (
    <View style={styles.formContainer}>
      {error ? (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      ) : null}

      <View style={styles.inputContainer}>
        <ThemedText style={[styles.label, { color: theme.text }]}>이메일</ThemedText>
        <TextInput
          testID="input-email"
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
            },
          ]}
          placeholder="가입한 이메일을 입력하세요"
          placeholderTextColor={Colors.light.tabIconDefault}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!isLoading}
        />
      </View>

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
        testID="button-reset"
        style={({ pressed }) => [
          styles.submitButton,
          { opacity: pressed ? 0.7 : 1 },
          isLoading && styles.buttonDisabled,
        ]}
        onPress={handleResetPassword}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ThemedText style={styles.submitButtonText}>임시 비밀번호 발송</ThemedText>
        )}
      </Pressable>
    </View>
  );

  const renderSuccess = () => (
    <Card variant="glass" padding="xl" style={styles.resultCard}>
      <Icon name="checkmark-circle" size={48} color={BrandColors.success} />
      <ThemedText style={styles.resultTitle}>임시 비밀번호가 발송되었습니다</ThemedText>
      <ThemedText style={[styles.resultDescription, { color: Colors.light.tabIconDefault }]}>
        등록된 휴대폰 번호로 임시 비밀번호가 전송되었습니다.{'\n'}
        로그인 후 비밀번호를 변경해주세요.
      </ThemedText>
      {devPassword ? (
        <View style={styles.devPasswordContainer}>
          <ThemedText style={[styles.devPasswordLabel, { color: Colors.light.tabIconDefault }]}>
            [개발용] 임시 비밀번호:
          </ThemedText>
          <ThemedText style={styles.devPassword}>{devPassword}</ThemedText>
        </View>
      ) : null}
      <Pressable
        style={[styles.resultButton, { backgroundColor: BrandColors.primary }]}
        onPress={() => navigation.navigate('Login')}
      >
        <ThemedText style={styles.resultButtonText}>로그인하기</ThemedText>
      </Pressable>
    </Card>
  );

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
            <Icon name="lock-closed-outline" size={48} color={BrandColors.primary} />
            <ThemedText style={styles.title}>비밀번호 찾기</ThemedText>
            <ThemedText style={[styles.description, { color: Colors.light.tabIconDefault }]}>
              {success 
                ? '임시 비밀번호가 발송되었습니다' 
                : '가입 정보를 입력하면 임시 비밀번호를 발송해드립니다'}
            </ThemedText>
          </View>

          {success ? renderSuccess() : renderForm()}
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
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  resultDescription: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  devPasswordContainer: {
    backgroundColor: BrandColors.warningLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    width: '100%',
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  devPasswordLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  devPassword: {
    ...Typography.h4,
    color: BrandColors.warning,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  resultButton: {
    width: '100%',
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
});
