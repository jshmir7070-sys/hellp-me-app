import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform, Linking, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { getToken } from '@/utils/secure-token-storage';

import { useQueryClient } from '@tanstack/react-query';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useCameraScanner, ScanResult } from '@/lib/camera-scanner';
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

type QRScannerScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route?: {
    params?: {
      contractId?: string;
      orderId?: string;
      type?: 'checkin' | 'checkout' | 'start_work' | 'helper_checkin';
    };
  };
};

export default function QRScannerScreen({ navigation, route }: QRScannerScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const contractId = route?.params?.contractId;
  const orderId = route?.params?.orderId;
  const scanType = route?.params?.type || 'checkin';

  const [scanStatus, setScanStatus] = useState<'scanning' | 'success' | 'error'>('scanning');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(setAuthToken);
  }, []);

  const handleScan = useCallback(async (result: ScanResult) => {
    if (isProcessing || !authToken) return;
    
    setIsProcessing(true);
    
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    try {
      let apiUrl: string;
      let requestBody: any;

      if (scanType === 'helper_checkin') {
        // 요청자가 헬퍼 개인코드 QR 스캔
        const qrData = result.data.trim().toUpperCase();
        
        // QR 데이터가 12자리 영숫자 코드인지 확인
        if (!/^[A-Z0-9]{12}$/.test(qrData)) {
          setScanStatus('error');
          setStatusMessage('유효하지 않은 헬퍼 코드입니다');
          setTimeout(() => {
            setScanStatus('scanning');
            setIsProcessing(false);
          }, 3000);
          return;
        }
        
        apiUrl = new URL('/api/checkin/verify-helper-code', getApiUrl()).toString();
        requestBody = {
          helperCode: qrData,
        };
      } else if (scanType === 'start_work') {
        // Parse QR data to extract orderId and token
        // Format: hellpme://order/{orderId}/start?token={token}
        const qrData = result.data;
        let extractedOrderId = orderId;
        let token = '';
        
        // Try to parse the hellpme:// URL format
        const startMatch = qrData.match(/hellpme:\/\/order\/(\d+)\/start\?token=(.+)/);
        if (startMatch) {
          extractedOrderId = startMatch[1];
          token = startMatch[2];
        } else {
          // Fallback: if QR is just a token, use the passed orderId
          token = qrData;
        }
        
        if (!extractedOrderId) {
          setScanStatus('error');
          setStatusMessage('유효하지 않은 QR 코드입니다');
          setTimeout(() => {
            setScanStatus('scanning');
            setIsProcessing(false);
          }, 3000);
          return;
        }
        
        apiUrl = new URL(`/api/orders/${extractedOrderId}/qr/start/verify`, getApiUrl()).toString();
        requestBody = {
          token,
        };
      } else {
        // 스캔된 데이터가 12자리 영숫자 개인코드인지 확인
        const scannedData = result.data.trim().toUpperCase();
        if (/^[A-Z0-9]{12}$/.test(scannedData)) {
          // 12자리 개인코드 → by-code 엔드포인트로 라우팅
          apiUrl = new URL('/api/checkin/by-code', getApiUrl()).toString();
          requestBody = {
            requesterCode: scannedData,
          };
        } else {
          // JSON QR 데이터 → qr 엔드포인트로 라우팅
          apiUrl = new URL('/api/checkin/qr', getApiUrl()).toString();
          requestBody = {
            qrData: result.data,
            contractId,
            type: scanType,
            timestamp: result.timestamp,
          };
        }
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        // Invalidate queries to refresh order lists
        queryClient.invalidateQueries({ queryKey: ['/api/orders/scheduled'] });
        queryClient.invalidateQueries({ queryKey: ['/api/helper/work-history'] });
        queryClient.invalidateQueries({ queryKey: ['/api/requester/orders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
        
        setScanStatus('success');
        let successMessage = '체크인 완료!';
        if (scanType === 'start_work') {
          successMessage = '업무가 시작되었습니다!';
        } else if (scanType === 'helper_checkin') {
          successMessage = `${data.helperName || '헬퍼'}님 출근 확인 완료!`;
        } else if (scanType === 'checkin') {
          successMessage = '출근 체크인 완료!';
        } else {
          successMessage = '퇴근 체크아웃 완료!';
        }
        setStatusMessage(data.message || successMessage);
        
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        setScanStatus('error');
        // Handle specific error codes from T-17 API
        let errorMessage = data.message || '체크인에 실패했습니다';
        if (data.code === 'TOKEN_EXPIRED') {
          errorMessage = '만료된 QR입니다. 새 QR을 요청해주세요.';
        } else if (data.code === 'TOKEN_USED') {
          errorMessage = '이미 사용된 QR입니다.';
        } else if (data.code === 'NOT_ASSIGNED') {
          errorMessage = '배정된 기사만 시작할 수 있습니다.';
        } else if (data.code === 'ALREADY_STARTED') {
          errorMessage = '이미 업무중 처리된 오더입니다.';
        }
        setStatusMessage(errorMessage);
        
        setTimeout(() => {
          setScanStatus('scanning');
          setIsProcessing(false);
        }, 3000);
      }
    } catch (error) {
      setScanStatus('error');
      setStatusMessage('서버 연결에 실패했습니다');
      
      setTimeout(() => {
        setScanStatus('scanning');
        setIsProcessing(false);
      }, 3000);
    }
  }, [isProcessing, authToken, contractId, orderId, scanType, navigation, queryClient]);

  const {
    permission,
    requestPermission,
    handleBarCodeScanned,
    hasPermission,
    canAskAgain,
  } = useCameraScanner({
    onScan: handleScan,
    debounceMs: 3000,
    enabled: scanStatus === 'scanning' && !isProcessing && !!authToken,
  });

  const openSettings = useCallback(async () => {
    if (Platform.OS !== 'web') {
      try {
        await Linking.openSettings();
      } catch (error) {
        console.error('Failed to open settings:', error);
      }
    }
  }, []);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
          <Card style={styles.webCard}>
            <View style={[styles.iconContainer, { backgroundColor: BrandColors.helperLight }]}>
              <Icon name="cellphone" size={48} color={BrandColors.helper} />
            </View>
            <ThemedText style={[styles.webTitle, { color: theme.text }]}>
              모바일 앱에서 사용해주세요
            </ThemedText>
            <ThemedText style={[styles.webSubtitle, { color: theme.tabIconDefault }]}>
              QR 코드 스캔은 Expo Go 앱에서만 사용할 수 있습니다.
              {'\n'}휴대폰에서 Expo Go 앱을 실행해주세요.
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

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
          <Card style={styles.permissionCard}>
            <View style={[styles.iconContainer, { backgroundColor: BrandColors.errorLight }]}>
              <Icon name="camera-off-outline" size={48} color={BrandColors.error} />
            </View>
            <ThemedText style={[styles.permissionTitle, { color: theme.text }]}>
              카메라 권한이 필요합니다
            </ThemedText>
            <ThemedText style={[styles.permissionSubtitle, { color: theme.tabIconDefault }]}>
              QR 코드를 스캔하려면 카메라 권한이 필요합니다
            </ThemedText>
            
            {canAskAgain ? (
              <Pressable
                style={[styles.permissionButton, { backgroundColor: BrandColors.helper }]}
                onPress={requestPermission}
              >
                <ThemedText style={styles.permissionButtonText}>권한 허용</ThemedText>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.permissionButton, { backgroundColor: BrandColors.helper }]}
                onPress={openSettings}
              >
                <ThemedText style={styles.permissionButtonText}>설정으로 이동</ThemedText>
              </Pressable>
            )}
            
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
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanStatus === 'scanning' && !isProcessing ? handleBarCodeScanned : undefined}
      />

      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Icon name="close-outline" size={24} color="#FFFFFF" />
          </Pressable>
          <ThemedText style={styles.headerTitle}>
            {scanType === 'start_work' ? '출근 체크인' : scanType === 'checkin' ? '출근 체크인' : '퇴근 체크아웃'}
          </ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.scanAreaContainer}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          {scanStatus === 'scanning' ? (
            <>
              <ThemedText style={styles.footerText}>
                QR 코드를 사각형 안에 맞춰주세요
              </ThemedText>
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" style={styles.processingIndicator} />
              ) : null}
            </>
          ) : scanStatus === 'success' ? (
            <View style={styles.statusContainer}>
              <View style={[styles.statusIcon, { backgroundColor: BrandColors.successLight }]}>
                <Icon name="checkmark-outline" size={32} color={BrandColors.success} />
              </View>
              <ThemedText style={styles.statusText}>{statusMessage}</ThemedText>
            </View>
          ) : (
            <View style={styles.statusContainer}>
              <View style={[styles.statusIcon, { backgroundColor: BrandColors.errorLight }]}>
                <Icon name="close-outline" size={32} color={BrandColors.error} />
              </View>
              <ThemedText style={styles.statusText}>{statusMessage}</ThemedText>
            </View>
          )}
        </View>
      </View>
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
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    ...Typography.h4,
  },
  headerSpacer: {
    width: 44,
  },
  scanAreaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFFFFF',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    color: '#FFFFFF',
    ...Typography.body,
    textAlign: 'center',
  },
  processingIndicator: {
    marginTop: Spacing.lg,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  statusText: {
    color: '#FFFFFF',
    ...Typography.body,
    textAlign: 'center',
  },
  webCard: {
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
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  webSubtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  backButton: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  backButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
  permissionCard: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  permissionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  permissionSubtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  permissionButton: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    width: '100%',
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
});
