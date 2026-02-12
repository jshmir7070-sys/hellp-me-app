import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Checkbox from 'expo-checkbox';

import { ThemedText } from '@/components/ThemedText';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { TossLogo } from '@/components/TossLogo';
import { useAuth } from '@/contexts/AuthContext';
import { Spacing, BorderRadius, Typography, BrandColors, PremiumGradients } from '@/constants/theme';

const SAVED_EMAIL_KEY = 'saved_email';
const AUTO_LOGIN_KEY = 'auto_login';
const SAVED_PASSWORD_KEY = 'saved_password';

// SecureStore helpers for password (iOS Keychain / Android Keystore)
async function secureGetPassword(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(SAVED_PASSWORD_KEY);
  }
  return SecureStore.getItemAsync(SAVED_PASSWORD_KEY);
}

async function secureSetPassword(password: string): Promise<void> {
  if (Platform.OS === 'web') {
    return AsyncStorage.setItem(SAVED_PASSWORD_KEY, password);
  }
  return SecureStore.setItemAsync(SAVED_PASSWORD_KEY, password);
}

async function secureRemovePassword(): Promise<void> {
  if (Platform.OS === 'web') {
    return AsyncStorage.removeItem(SAVED_PASSWORD_KEY);
  }
  return SecureStore.deleteItemAsync(SAVED_PASSWORD_KEY);
}

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveEmail, setSaveEmail] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    loadSavedSettings();
  }, []);

  useEffect(() => {
    if (initialCheckDone && autoLogin && email && password && !isAuthenticated) {
      handleLogin();
    }
  }, [initialCheckDone]);

  async function loadSavedSettings() {
    try {
      const [savedEmail, savedAutoLogin, savedPassword] = await Promise.all([
        AsyncStorage.getItem(SAVED_EMAIL_KEY),
        AsyncStorage.getItem(AUTO_LOGIN_KEY),
        secureGetPassword(),
      ]);

      if (savedEmail) {
        setEmail(savedEmail);
        setSaveEmail(true);
      }

      if (savedAutoLogin === 'true') {
        setAutoLogin(true);
        if (savedPassword) {
          setPassword(savedPassword);
        }
      }

      setInitialCheckDone(true);
    } catch (e) {
      console.error('Failed to load saved settings:', e);
      setInitialCheckDone(true);
    }
  }

  async function saveSettings() {
    try {
      if (saveEmail) {
        await AsyncStorage.setItem(SAVED_EMAIL_KEY, email);
      } else {
        await AsyncStorage.removeItem(SAVED_EMAIL_KEY);
      }

      if (autoLogin) {
        await AsyncStorage.setItem(AUTO_LOGIN_KEY, 'true');
        await secureSetPassword(password);
      } else {
        await AsyncStorage.removeItem(AUTO_LOGIN_KEY);
        await secureRemovePassword();
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요');
      return;
    }

    setIsLoading(true);
    setError(null);

    await saveSettings();
    const result = await login(email.trim(), password);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error || '로그인에 실패했습니다');
    }
  }

  function handleAutoLoginChange(value: boolean) {
    setAutoLogin(value);
    if (value) {
      setSaveEmail(true);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing['2xl'], paddingBottom: insets.bottom + Spacing.lg }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrapper}>
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <TossLogo size="large" />
            <ThemedText style={styles.subtitle}>
              프리미엄 물류 플랫폼
            </ThemedText>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            </View>
          ) : null}

          {/* Login Form */}
          <View style={styles.formSection}>
            <Input
              variant="outlined"
              placeholder="이메일을 입력하세요"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
              }}
              disabled={isLoading}
              containerStyle={styles.inputContainer}
            />

            <Input
              variant="outlined"
              placeholder="비밀번호를 입력하세요"
              secureTextEntry
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              disabled={isLoading}
              containerStyle={styles.inputContainer}
            />

            <View style={styles.checkboxRow}>
              <Pressable
                style={styles.checkboxItem}
                onPress={() => setSaveEmail(!saveEmail)}
                disabled={autoLogin}
              >
                <Checkbox
                  value={saveEmail}
                  onValueChange={setSaveEmail}
                  color={saveEmail ? BrandColors.primary : undefined}
                  style={styles.checkbox}
                  disabled={autoLogin}
                />
                <ThemedText style={styles.checkboxLabel}>
                  아이디 저장
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles.checkboxItem}
                onPress={() => handleAutoLoginChange(!autoLogin)}
              >
                <Checkbox
                  value={autoLogin}
                  onValueChange={handleAutoLoginChange}
                  color={autoLogin ? BrandColors.primary : undefined}
                  style={styles.checkbox}
                />
                <ThemedText style={styles.checkboxLabel}>
                  자동 로그인
                </ThemedText>
              </Pressable>
            </View>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleLogin}
              disabled={isLoading}
              loading={isLoading}
              style={styles.loginButton}
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </Button>
          </View>

          <View style={styles.findContainer}>
            <Pressable
              onPress={() => navigation.navigate('FindEmail')}
              disabled={isLoading}
            >
              <ThemedText style={styles.findLink}>
                아이디 찾기
              </ThemedText>
            </Pressable>
            <ThemedText style={styles.divider}>|</ThemedText>
            <Pressable
              onPress={() => navigation.navigate('FindPassword')}
              disabled={isLoading}
            >
              <ThemedText style={styles.findLink}>
                비밀번호 찾기
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.signupContainer}>
            <ThemedText style={styles.signupText}>
              계정이 없으신가요?
            </ThemedText>
            <Pressable
              onPress={() => navigation.navigate('Signup')}
              disabled={isLoading}
            >
              <ThemedText style={styles.signupLink}>
                회원가입
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 400,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
    gap: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    fontWeight: '500',
    color: '#6B7280',
  },
  formSection: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: BrandColors.errorLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: BrandColors.error,
  },
  errorText: {
    color: BrandColors.error,
    ...Typography.small,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing['3xl'],
    marginBottom: Spacing.xl,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  checkboxLabel: {
    ...Typography.small,
    color: '#374151',
  },
  loginButton: {
    marginTop: Spacing.sm,
  },
  findContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  findLink: {
    ...Typography.small,
    color: '#6B7280',
  },
  divider: {
    ...Typography.small,
    color: '#D1D5DB',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  signupText: {
    ...Typography.body,
    color: '#6B7280',
  },
  signupLink: {
    ...Typography.body,
    fontWeight: '600',
    color: BrandColors.primary,
  },
});
