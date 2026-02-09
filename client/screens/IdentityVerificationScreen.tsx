import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from "@/constants/theme";
import { getApiUrl } from '@/lib/query-client';

type IdentityVerificationScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route?: {
    params?: {
      returnScreen?: string;
      purpose?: 'signup' | 'profile' | 'payment';
    };
  };
};

interface VerificationResult {
  success: boolean;
  verified: boolean;
  customer?: {
    name: string;
    phoneNumber: string;
    birthDate: string;
    gender: string;
    ci: string;
    di: string;
  };
  message?: string;
}

export default function IdentityVerificationScreen({ navigation, route }: IdentityVerificationScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const webViewRef = useRef<WebView>(null);

  const returnScreen = route?.params?.returnScreen;
  const purpose = route?.params?.purpose || 'profile';

  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'loading' | 'ready' | 'processing' | 'success' | 'failed'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);

  useEffect(() => {
    initVerification();
  }, []);

  const initVerification = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setStatus('failed');
        setErrorMessage('로그인이 필요합니다');
        return;
      }

      const response = await fetch(
        new URL('/api/auth/create-identity-verification', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            purpose,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '본인인증 초기화에 실패했습니다');
      }

      const data = await response.json();
      if (data.verificationUrl) {
        setVerificationUrl(data.verificationUrl);
        setVerificationId(data.identityVerificationId);
        setStatus('ready');
      } else if (data.identityVerificationId) {
        setVerificationId(data.identityVerificationId);
        const baseUrl = getApiUrl().replace('/api', '');
        const url = `${baseUrl}/identity-verification?id=${data.identityVerificationId}`;
        setVerificationUrl(url);
        setStatus('ready');
      } else {
        throw new Error('본인인증 URL을 받지 못했습니다');
      }
    } catch (error: any) {
      setStatus('failed');
      setErrorMessage(error.message || '본인인증 초기화에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyResult = async (id: string) => {
    try {
      setStatus('processing');
      const token = await AsyncStorage.getItem('auth_token');

      const response = await fetch(
        new URL('/api/auth/verify-identity', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            identityVerificationId: id,
          }),
        }
      );

      const result: VerificationResult = await response.json();

      if (result.success && result.verified) {
        setStatus('success');
        setTimeout(() => {
          if (Platform.OS !== 'web') {
            Alert.alert('본인인증 완료', '본인인증이 성공적으로 완료되었습니다.', [
              {
                text: '확인',
                onPress: () => {
                  if (returnScreen) {
                    navigation.navigate(returnScreen, { verified: true, customer: result.customer });
                  } else {
                    navigation.goBack();
                  }
                },
              },
            ]);
          } else {
            if (returnScreen) {
              navigation.navigate(returnScreen, { verified: true, customer: result.customer });
            } else {
              navigation.goBack();
            }
          }
        }, 1000);
      } else {
        setStatus('failed');
        setErrorMessage(result.message || '본인인증에 실패했습니다');
      }
    } catch (error: any) {
      setStatus('failed');
      setErrorMessage(error.message || '본인인증 확인에 실패했습니다');
    }
  };

  const handleNavigationChange = useCallback(
    (navState: WebViewNavigation) => {
      const { url } = navState;

      if (url.includes('/identity/success') || url.includes('verification_success=true')) {
        if (verificationId) {
          verifyResult(verificationId);
        }
        return false;
      }

      if (url.includes('/identity/fail') || url.includes('verification_fail=true')) {
        setStatus('failed');
        setErrorMessage('본인인증이 취소되었거나 실패했습니다');
        return false;
      }

      if (url.includes('/identity/cancel') || url.includes('verification_cancel=true')) {
        navigation.goBack();
        return false;
      }

      return true;
    },
    [navigation, verificationId]
  );

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === 'IDENTITY_VERIFICATION_SUCCESS') {
          const id = data.identityVerificationId || verificationId;
          if (id) {
            verifyResult(id);
          }
        } else if (data.type === 'IDENTITY_VERIFICATION_FAILED') {
          setStatus('failed');
          setErrorMessage(data.error || '본인인증에 실패했습니다');
        } else if (data.type === 'IDENTITY_VERIFICATION_CANCEL') {
          navigation.goBack();
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    },
    [navigation, verificationId]
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
          <Card variant="glass" padding="xl" style={styles.webCard}>
            <View style={[styles.iconContainer, { backgroundColor: BrandColors.helperLight }]}>
              <Icon name="shield-outline" size={48} color={BrandColors.helper} />
            </View>
            <ThemedText style={[styles.webTitle, { color: theme.text }]}>
              모바일 앱에서 인증해주세요
            </ThemedText>
            <ThemedText style={[styles.webSubtitle, { color: theme.tabIconDefault }]}>
              안전한 본인인증을 위해 Expo Go 앱에서{'\n'}인증을 진행해주세요.
            </ThemedText>
            <Pressable
              style={[styles.backButton, { backgroundColor: BrandColors.helper }]}
              onPress={() => navigation.goBack()}
            >
              <ThemedText style={styles.backButtonText}>돌아가기</ThemedText>
            </Pressable>
          </Card>
        </View>
      </View>
    );
  }

  if (isLoading || status === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.helper} />
          <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
            본인인증을 준비하는 중...
          </ThemedText>
        </View>
      </View>
    );
  }

  if (status === 'success') {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
          <Card variant="glass" padding="xl" style={styles.successCard}>
            <View style={[styles.iconContainer, { backgroundColor: BrandColors.requesterLight }]}>
              <Icon name="checkmark-circle-outline" size={48} color={BrandColors.requester} />
            </View>
            <ThemedText style={[styles.successTitle, { color: theme.text }]}>
              본인인증 완료
            </ThemedText>
            <ThemedText style={[styles.successMessage, { color: theme.tabIconDefault }]}>
              본인인증이 성공적으로 완료되었습니다.
            </ThemedText>
          </Card>
        </View>
      </View>
    );
  }

  if (status === 'failed' || !verificationUrl) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
          <Card variant="glass" padding="xl" style={styles.errorCard}>
            <View style={[styles.iconContainer, { backgroundColor: BrandColors.errorLight }]}>
              <Icon name="alert-circle-outline" size={48} color={BrandColors.error} />
            </View>
            <ThemedText style={[styles.errorTitle, { color: theme.text }]}>
              본인인증 실패
            </ThemedText>
            <ThemedText style={[styles.errorMessage, { color: theme.tabIconDefault }]}>
              {errorMessage || '본인인증을 시작할 수 없습니다'}
            </ThemedText>
            <Pressable
              style={[styles.retryButton, { backgroundColor: BrandColors.helper }]}
              onPress={() => {
                setStatus('loading');
                setErrorMessage('');
                setIsLoading(true);
                initVerification();
              }}
            >
              <ThemedText style={styles.retryButtonText}>다시 시도</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.cancelButton, { borderColor: theme.tabIconDefault }]}
              onPress={() => navigation.goBack()}
            >
              <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>취소</ThemedText>
            </Pressable>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <WebView
        ref={webViewRef}
        source={{ uri: verificationUrl }}
        style={styles.webview}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationChange}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['https://*', 'http://*']}
        mixedContentMode="compatibility"
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        onError={(syntheticEvent: any) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          setStatus('failed');
          setErrorMessage('인증 페이지를 불러올 수 없습니다');
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={BrandColors.helper} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundDefault,
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.lg,
  },
  webCard: {
    alignItems: 'center',
  },
  successCard: {
    alignItems: 'center',
  },
  errorCard: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  webTitle: {
    ...Typography.h3,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  webSubtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  successTitle: {
    ...Typography.h3,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  successMessage: {
    ...Typography.body,
    textAlign: 'center',
  },
  errorTitle: {
    ...Typography.h3,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  errorMessage: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  backButton: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  backButtonText: {
    color: Colors.light.buttonText,
    ...Typography.body,
    fontWeight: '600',
  },
  retryButton: {
    width: '100%',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  retryButtonText: {
    color: Colors.light.buttonText,
    ...Typography.body,
    fontWeight: '600',
  },
  cancelButton: {
    width: '100%',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
});
