import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Checkbox from 'expo-checkbox';

import { ThemedText } from '@/components/ThemedText';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TossLogo } from '@/components/TossLogo';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography, BrandColors, PremiumGradients } from '@/constants/theme';

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
  const { theme, isDark } = useTheme();
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
        secureGetPassword(), // Use SecureStore for password
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
        await secureSetPassword(password); // Use SecureStore for password
      } else {
        await AsyncStorage.removeItem(AUTO_LOGIN_KEY);
        await secureRemovePassword(); // Use SecureStore for password
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
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing['3xl'], paddingBottom: insets.bottom + Spacing.xl }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrapper}>
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <TossLogo size="large" gradient />
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              프리미엄 물류 플랫폼
            </ThemedText>
          </View>

          {/* Login Form Card */}
          <Card variant="default" padding="xl" style={styles.formCard}>
            {error ? (
              <Card
                variant="outlined"
                padding="md"
                style={[styles.errorContainer, { borderColor: BrandColors.error }]}
              >
                <ThemedText style={styles.errorText}>{error}</ThemedText>
              </Card>
            ) : null}

            <Input
              variant="premium"
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
              variant="premium"
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
                  color={saveEmail ? PremiumGradients.blue[0] : undefined}
                  style={styles.checkbox}
                  disabled={autoLogin}
                />
                <ThemedText style={[styles.checkboxLabel, { color: theme.text }]}>
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
                  color={autoLogin ? PremiumGradients.blue[0] : undefined}
                  style={styles.checkbox}
                />
                <ThemedText style={[styles.checkboxLabel, { color: theme.text }]}>
                  자동 로그인
                </ThemedText>
              </Pressable>
            </View>

            <Button
              variant="premium"
              size="lg"
              fullWidth
              onPress={handleLogin}
              disabled={isLoading}
              loading={isLoading}
              style={styles.loginButton}
            >
              {isLoading ? '로그인 중...' : '로그인'}
            </Button>

            <View style={styles.findContainer}>
              <Pressable
                onPress={() => navigation.navigate('FindEmail')}
                disabled={isLoading}
              >
                <ThemedText style={[styles.findLink, { color: theme.tabIconDefault }]}>
                  아이디 찾기
                </ThemedText>
              </Pressable>
              <ThemedText style={[styles.divider, { color: theme.tabIconDefault }]}>|</ThemedText>
              <Pressable
                onPress={() => navigation.navigate('FindPassword')}
                disabled={isLoading}
              >
                <ThemedText style={[styles.findLink, { color: theme.tabIconDefault }]}>
                  비밀번호 찾기
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.signupContainer}>
              <ThemedText style={[styles.signupText, { color: theme.tabIconDefault }]}>
                계정이 없으신가요?
              </ThemedText>
              <Pressable
                onPress={() => navigation.navigate('Signup')}
                disabled={isLoading}
              >
                <ThemedText style={[styles.signupLink, { color: PremiumGradients.blue[0] }]}>
                  회원가입
                </ThemedText>
              </Pressable>
            </View>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: Spacing['4xl'],
    gap: Spacing.md,
  },
  subtitle: {
    ...Typography.body,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  formCard: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: BrandColors.errorLight,
    marginBottom: Spacing.lg,
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
  },
  loginButton: {
    marginTop: Spacing.md,
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
  },
  divider: {
    ...Typography.small,
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
  },
  signupLink: {
    ...Typography.body,
    fontWeight: '600',
  },
});
