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
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from '@/constants/theme';
import { getApiUrl, isApiConfigured, getApiConfigError } from '@/lib/query-client';

type PaymentScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route?: {
    params?: {
      orderId?: string;
      contractId?: string;
      amount?: number;
      paymentType?: 'deposit' | 'balance';
      orderTitle?: string;
    };
  };
};

interface VerifyResult {
  verified: boolean;
  status: string;
  amount?: number;
  paymentType?: string;
  paidAt?: string;
  message?: string;
  isTestMode?: boolean;
}

export default function PaymentScreen({ navigation, route }: PaymentScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const webViewRef = useRef<WebView>(null);

  const orderId = route?.params?.orderId || '';
  const contractId = route?.params?.contractId || '';
  const amount = route?.params?.amount || 0;
  const paymentType = route?.params?.paymentType || 'deposit';
  const orderTitle = route?.params?.orderTitle || '헬프미 서비스 결제';

  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'ready' | 'processing' | 'verifying' | 'success' | 'failed'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    initPayment();
  }, []);

  const initPayment = async () => {
    try {
      if (!isApiConfigured()) {
        const configError = getApiConfigError();
        setPaymentStatus('failed');
        setErrorMessage(configError || '서버에 연결할 수 없습니다');
        setIsLoading(false);
        return;
      }

      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setPaymentStatus('failed');
        setErrorMessage('로그인이 필요합니다');
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        new URL('/api/payments/intent', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId,
            contractId,
            amount,
            paymentType,
            orderTitle,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '결제 초기화에 실패했습니다');
      }

      const data = await response.json();
      if (data.paymentUrl && data.paymentId) {
        setPaymentUrl(data.paymentUrl);
        setPaymentId(data.paymentId);
        setPaymentStatus('ready');
      } else {
        throw new Error('결제 URL을 받지 못했습니다');
      }
    } catch (error: any) {
      setPaymentStatus('failed');
      setErrorMessage(error.message || '결제 초기화에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPaymentWithServer = async (currentPaymentId: string): Promise<VerifyResult> => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        return { verified: false, status: 'error', message: '로그인이 필요합니다' };
      }

      const response = await fetch(
        new URL(`/api/payments/${currentPaymentId}/verify`, getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      return data as VerifyResult;
    } catch (error: any) {
      console.error('[PaymentScreen] Verify error:', error);
      return { verified: false, status: 'error', message: '결제 검증에 실패했습니다' };
    }
  };

  const handlePaymentSuccess = useCallback(async () => {
    if (!paymentId) {
      setPaymentStatus('failed');
      setErrorMessage('결제 정보가 없습니다');
      return;
    }

    setPaymentStatus('verifying');

    const result = await verifyPaymentWithServer(paymentId);

    if (result.verified) {
      setPaymentStatus('success');
      setTimeout(() => {
        if (Platform.OS !== 'web') {
          Alert.alert('결제 완료', '결제가 성공적으로 완료되었습니다.', [
            { text: '확인', onPress: () => navigation.goBack() }
          ]);
        } else {
          navigation.goBack();
        }
      }, 1500);
    } else {
      setPaymentStatus('failed');
      setErrorMessage(result.message || '결제 검증에 실패했습니다');
    }
  }, [paymentId, navigation]);

  const handleNavigationChange = useCallback((navState: WebViewNavigation) => {
    const { url } = navState;

    const isSuccess = 
      url.includes('/payment/success') || 
      url.includes('payment_success=true') ||
      url.includes('/payment/callback?status=success') ||
      url.includes('status=success');

    const isFail = 
      url.includes('/payment/fail') || 
      url.includes('payment_fail=true') ||
      url.includes('/payment/callback?status=fail') ||
      url.includes('status=fail');

    const isCancel = 
      url.includes('/payment/cancel') || 
      url.includes('payment_cancel=true') ||
      url.includes('/payment/callback?status=cancel') ||
      url.includes('status=cancel');

    if (isSuccess) {
      handlePaymentSuccess();
      return false;
    }

    if (isFail) {
      setPaymentStatus('failed');
      setErrorMessage('결제가 취소되었거나 실패했습니다');
      return false;
    }

    if (isCancel) {
      navigation.goBack();
      return false;
    }

    return true;
  }, [navigation, handlePaymentSuccess]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'PAYMENT_SUCCESS') {
        handlePaymentSuccess();
      } else if (data.type === 'PAYMENT_FAILED') {
        setPaymentStatus('failed');
        setErrorMessage(data.error || '결제에 실패했습니다');
      } else if (data.type === 'PAYMENT_CANCEL') {
        navigation.goBack();
      }
    } catch (error) {
      // Ignore non-JSON messages
    }
  }, [navigation, handlePaymentSuccess]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
          <Card variant="glass" padding="md" style={styles.webCard}>
            <View style={[styles.iconContainer, { backgroundColor: BrandColors.requesterLight }]}>
              <Icon name="card-outline" size={48} color={BrandColors.requester} />
            </View>
            <ThemedText style={[styles.webTitle, { color: theme.text }]}>
              모바일 앱에서 결제해주세요
            </ThemedText>
            <ThemedText style={[styles.webSubtitle, { color: theme.tabIconDefault }]}>
              안전한 결제를 위해 Expo Go 앱에서{'\n'}결제를 진행해주세요.
            </ThemedText>
            <Pressable
              style={[styles.backButton, { backgroundColor: BrandColors.requester }]}
              onPress={() => navigation.goBack()}
            >
              <ThemedText style={styles.backButtonText}>돌아가기</ThemedText>
            </Pressable>
          </Card>
        </View>
      </View>
    );
  }

  if (isLoading || paymentStatus === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.requester} />
          <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
            결제를 준비하는 중...
          </ThemedText>
        </View>
      </View>
    );
  }

  if (paymentStatus === 'verifying') {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.requester} />
          <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
            결제를 확인하는 중...
          </ThemedText>
        </View>
      </View>
    );
  }

  if (paymentStatus === 'success') {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
          <Card variant="glass" padding="xl" style={styles.successCard}>
            <View style={[styles.iconContainer, { backgroundColor: BrandColors.successLight }]}>
              <Icon name="checkmark-circle-outline" size={48} color={BrandColors.success} />
            </View>
            <ThemedText style={[styles.successTitle, { color: theme.text }]}>
              결제 완료
            </ThemedText>
            <ThemedText style={[styles.successMessage, { color: theme.tabIconDefault }]}>
              결제가 성공적으로 완료되었습니다.
            </ThemedText>
          </Card>
        </View>
      </View>
    );
  }

  if (paymentStatus === 'failed' || !paymentUrl) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
          <Card variant="glass" padding="xl" style={styles.errorCard}>
            <View style={[styles.iconContainer, { backgroundColor: BrandColors.errorLight }]}>
              <Icon name="alert-circle-outline" size={48} color={BrandColors.error} />
            </View>
            <ThemedText style={[styles.errorTitle, { color: theme.text }]}>
              결제 실패
            </ThemedText>
            <ThemedText style={[styles.errorMessage, { color: theme.tabIconDefault }]}>
              {errorMessage || '결제를 시작할 수 없습니다'}
            </ThemedText>
            <Pressable
              style={[styles.retryButton, { backgroundColor: BrandColors.requester }]}
              onPress={() => {
                setPaymentStatus('loading');
                setErrorMessage('');
                setIsLoading(true);
                initPayment();
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
        source={{ uri: paymentUrl }}
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
          setPaymentStatus('failed');
          setErrorMessage('결제 페이지를 불러올 수 없습니다');
        }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={BrandColors.requester} />
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
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  errorCard: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  successCard: {
    padding: Spacing['3xl'],
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
  successTitle: {
    ...Typography.h3,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  successMessage: {
    ...Typography.body,
    textAlign: 'center',
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
