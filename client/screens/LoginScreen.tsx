import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Checkbox from 'expo-checkbox';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';

const logoImage = require('../assets/images/hellpme-logo.png');

const SAVED_EMAIL_KEY = 'saved_email';
const AUTO_LOGIN_KEY = 'auto_login';
// 비밀번호 평문 저장 제거 - 자동 로그인은 refresh token 기반으로 처리

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
    // 자동 로그인은 AuthContext의 토큰 갱신으로 처리됨
    // 비밀번호 기반 자동 로그인 제거 (보안)
  }, [initialCheckDone]);

  async function loadSavedSettings() {
    try {
      const [savedEmail, savedAutoLogin] = await Promise.all([
        AsyncStorage.getItem(SAVED_EMAIL_KEY),
        AsyncStorage.getItem(AUTO_LOGIN_KEY),
      ]);
      // 기존 평문 비밀번호 저장 데이터 삭제 (마이그레이션)
      await AsyncStorage.removeItem('saved_password');

      if (savedEmail) {
        setEmail(savedEmail);
        setSaveEmail(true);
      }

      if (savedAutoLogin === 'true') {
        setAutoLogin(true);
        // 자동 로그인은 AuthContext의 토큰 기반으로 처리됨
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
      } else {
        await AsyncStorage.removeItem(AUTO_LOGIN_KEY);
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
          <View style={styles.logoContainer}>
            <Image source={logoImage} style={styles.logo} resizeMode="contain" />
            <ThemedText style={[styles.subtitle, { color: Colors.light.tabIconDefault }]}>
              헬퍼 매칭 서비스
            </ThemedText>
          </View>

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
              placeholder="이메일을 입력하세요"
              placeholderTextColor={Colors.light.tabIconDefault}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>비밀번호</ThemedText>
            <TextInput
              testID="input-password"
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              placeholder="비밀번호를 입력하세요"
              placeholderTextColor={Colors.light.tabIconDefault}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
            />
          </View>

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
                color={autoLogin ? BrandColors.primary : undefined}
                style={styles.checkbox}
              />
              <ThemedText style={[styles.checkboxLabel, { color: theme.text }]}>
                자동 로그인
              </ThemedText>
            </Pressable>
          </View>

          <Pressable
            testID="button-login"
            style={({ pressed }) => [
              styles.loginButton,
              { opacity: pressed ? 0.7 : 1 },
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.loginButtonText}>로그인</ThemedText>
            )}
          </Pressable>

          <View style={styles.findContainer}>
            <Pressable
              testID="button-find-email"
              onPress={() => navigation.navigate('FindEmail')}
              disabled={isLoading}
            >
              <ThemedText style={[styles.findLink, { color: Colors.light.tabIconDefault }]}>
                아이디 찾기
              </ThemedText>
            </Pressable>
            <ThemedText style={[styles.divider, { color: Colors.light.tabIconDefault }]}>|</ThemedText>
            <Pressable
              testID="button-find-password"
              onPress={() => navigation.navigate('FindPassword')}
              disabled={isLoading}
            >
              <ThemedText style={[styles.findLink, { color: Colors.light.tabIconDefault }]}>
                비밀번호 찾기
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.signupContainer}>
            <ThemedText style={[styles.signupText, { color: Colors.light.tabIconDefault }]}>
              계정이 없으신가요?
            </ThemedText>
            <Pressable
              testID="button-signup"
              onPress={() => navigation.navigate('Signup')}
              disabled={isLoading}
            >
              <ThemedText style={styles.signupLink}>회원가입</ThemedText>
            </Pressable>
          </View>
        </View>
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
  },
  logo: {
    width: 300,
    height: 100,
    marginBottom: Spacing.lg,
  },
  subtitle: {
    ...Typography.body,
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
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing['3xl'],
    marginBottom: Spacing.lg,
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
  loginButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
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
    marginTop: Spacing.xl,
    gap: Spacing.xs,
  },
  signupText: {
    ...Typography.body,
  },
  signupLink: {
    ...Typography.body,
    color: BrandColors.primary,
    fontWeight: '600',
  },
});
