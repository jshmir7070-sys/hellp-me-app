import React, { useState, useCallback } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator, Share, Platform, Alert, TextInput as TextInputRN } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, Typography, BrandColors, Colors } from "@/constants/theme";

type QRCheckinScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface RequesterQRData {
  type: string;
  requesterId: string;
  requesterName: string;
  requesterPhone: string;
  token: string;
}

interface PersonalCodeResponse {
  personalCode: string;
  name?: string;
}

export default function QRCheckinScreen({ navigation }: QRCheckinScreenProps) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isHelper = user?.role === 'helper';
  const primaryColor = isHelper ? BrandColors.helper : BrandColors.requester;

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg + 94,
        paddingBottom: insets.bottom + 120,
        paddingHorizontal: Spacing.lg,
      }}
    >
      {isHelper ? (
        <HelperScanView
          queryClient={queryClient} 
          theme={theme} 
          primaryColor={primaryColor}
          navigation={navigation}
        />
      ) : (
        <RequesterQRView 
          theme={theme} 
          primaryColor={primaryColor}
        />
      )}
    </KeyboardAwareScrollViewCompat>
  );
}

function HelperScanView({ 
  theme, 
  primaryColor,
  navigation,
  queryClient,
}: { 
  theme: any; 
  primaryColor: string;
  navigation: NativeStackNavigationProp<any>;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [manualCode, setManualCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleScanQR = () => {
    navigation.navigate('QRScanner', { type: 'checkin' });
  };

  const handleVerifyCode = async () => {
    const trimmedCode = manualCode.trim().toUpperCase();
    if (trimmedCode.length !== 12) {
      Alert.alert('입력 오류', '12자리 코드를 정확히 입력해주세요.');
      return;
    }
    
    setIsVerifying(true);
    try {
      const token = await import('@react-native-async-storage/async-storage').then(m => m.default.getItem('auth_token'));
      const { getApiUrl } = await import('@/lib/query-client');
      
      const response = await fetch(new URL('/api/checkin/by-code', getApiUrl()).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          requesterCode: trimmedCode,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Invalidate queries to refresh order lists
        queryClient.invalidateQueries({ queryKey: ['/api/orders/scheduled'] });
        queryClient.invalidateQueries({ queryKey: ['/api/helper/work-history'] });
        queryClient.invalidateQueries({ queryKey: ['/api/requester/orders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
        
        Alert.alert('출근 완료', `${data.requesterName || '요청자'}님에게 출근 체크가 완료되었습니다.\n오더가 업무중으로 변경되었습니다.`);
        setManualCode('');
        navigation.goBack();
      } else {
        Alert.alert('오류', data.message || '출근 체크에 실패했습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '서버 연결에 실패했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePaste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setManualCode(text.slice(0, 12).toUpperCase());
    }
  };

  return (
    <>
      <Card variant="glass" padding="lg" style={styles.scanCard}>
        <View style={[styles.iconContainer, { backgroundColor: BrandColors.helperLight }]}>
          <Icon name="camera-outline" size={32} color={primaryColor} />
        </View>
        <ThemedText style={[styles.scanTitle, { color: theme.text }]}>요청자 QR 스캔</ThemedText>
        <ThemedText style={[styles.scanSubtitle, { color: theme.tabIconDefault }]}>
          요청자의 QR 코드를 스캔하여{'\n'}출근을 기록하세요
        </ThemedText>

        <Pressable 
          style={[styles.scanButton, { backgroundColor: primaryColor }]}
          onPress={handleScanQR}
        >
          <Icon name="crop-free" size={24} color={Colors.light.buttonText} />
          <ThemedText style={styles.scanButtonText}>QR 스캔하기</ThemedText>
        </Pressable>
      </Card>

      <View style={styles.dividerContainer}>
        <View style={[styles.dividerLine, { backgroundColor: theme.tabIconDefault }]} />
        <ThemedText style={[styles.dividerText, { color: theme.tabIconDefault }]}>또는</ThemedText>
        <View style={[styles.dividerLine, { backgroundColor: theme.tabIconDefault }]} />
      </View>

      <Card variant="glass" padding="md" style={styles.manualInputCard}>
        <ThemedText style={[styles.inputLabel, { color: theme.text }]}>12자리 코드 직접 입력</ThemedText>
        
        <View style={styles.inputRow}>
          <View style={[styles.codeInput, { 
            backgroundColor: theme.backgroundDefault, 
            borderColor: theme.tabIconDefault,
          }]}>
            <Icon name="camera-outline" size={20} color={theme.tabIconDefault} style={{ marginRight: Spacing.sm }} />
            <View style={{ flex: 1 }}>
              <TextInputRN
                style={{ 
                  color: theme.text,
                  fontSize: 16,
                  fontWeight: '600',
                  letterSpacing: 1,
                }}
                value={manualCode}
                onChangeText={(text) => setManualCode(text.toUpperCase().slice(0, 12))}
                placeholder="XXXXXXXXXXXX"
                placeholderTextColor={theme.tabIconDefault}
                maxLength={12}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
          </View>
          <Pressable 
            style={[styles.pasteButton, { backgroundColor: theme.backgroundDefault }]}
            onPress={handlePaste}
          >
            <Icon name="clipboard-outline" size={20} color={theme.text} />
          </Pressable>
        </View>

        <ThemedText style={[styles.codeHint, { color: theme.tabIconDefault }]}>
          요청자의 QR 번호 12자리를 입력하세요
        </ThemedText>

        <Pressable 
          style={[
            styles.verifyButton, 
            { backgroundColor: manualCode.length === 12 ? primaryColor : theme.tabIconDefault }
          ]}
          onPress={handleVerifyCode}
          disabled={manualCode.length !== 12 || isVerifying}
        >
          {isVerifying ? (
            <ActivityIndicator size="small" color={Colors.light.buttonText} />
          ) : (
            <>
              <Icon name="checkmark-circle-outline" size={20} color={Colors.light.buttonText} />
              <ThemedText style={styles.verifyButtonText}>출근 확인</ThemedText>
            </>
          )}
        </Pressable>
      </Card>

      <Card variant="outline" padding="md" style={styles.infoCard}>
        <Icon name="information-circle-outline" size={20} color={theme.tabIconDefault} />
        <ThemedText style={[styles.infoText, { color: theme.tabIconDefault }]}>
          요청자가 보여주는 QR 코드를 스캔하거나 12자리 코드를 입력하면 출근이 기록됩니다.
        </ThemedText>
      </Card>
    </>
  );
}

function RequesterQRView({ 
  theme, 
  primaryColor,
}: { 
  theme: any; 
  primaryColor: string;
}) {
  const { user } = useAuth();
  
  const { data: qrData, isLoading } = useQuery<RequesterQRData>({
    queryKey: ['/api/checkin/qr-data'],
  });

  const { data: personalData } = useQuery<PersonalCodeResponse>({
    queryKey: ['/api/requesters/me/personal-code'],
  });

  const qrCode = personalData?.personalCode || '';
  const requesterName = qrData?.requesterName || user?.name || '-';
  const requesterPhone = qrData?.requesterPhone || user?.phoneNumber || '-';

  const handleCopy = async () => {
    if (qrCode) {
      await Clipboard.setStringAsync(qrCode);
      if (Platform.OS !== 'web') {
        Alert.alert('복사됨', 'QR 코드가 클립보드에 복사되었습니다.');
      }
    }
  };

  const handleShare = async () => {
    if (!qrCode) return;
    
    try {
      await Share.share({
        message: `Hellp Me 출근용 QR\n코드: ${qrCode}\n이름: ${requesterName}\n전화번호: ${requesterPhone}`,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          QR 코드를 불러오는 중...
        </ThemedText>
      </View>
    );
  }

  return (
    <>
      <Card variant="glass" padding="xl" style={styles.qrCard}>
        <View style={[styles.iconContainer, { backgroundColor: BrandColors.requesterLight }]}>
          <Icon name="camera-outline" size={32} color={primaryColor} />
        </View>
        <ThemedText style={[styles.qrTitle, { color: theme.text }]}>내 QR 보기</ThemedText>
        <ThemedText style={[styles.qrSubtitle, { color: theme.tabIconDefault }]}>
          헬퍼에게 이 QR을 보여주세요
        </ThemedText>

        <View style={[styles.qrCodeContainer, { backgroundColor: theme.backgroundDefault }]}>
          {qrCode ? (
            <QRCode
              value={qrCode}
              size={160}
              color="Colors.dark.text"
              backgroundColor={Colors.light.buttonText}
            />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Icon name="camera-outline" size={140} color={primaryColor} />
            </View>
          )}
        </View>

        <View style={[styles.infoContainer, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>QR 번호</ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>{qrCode || '-'}</ThemedText>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: theme.tabIconDefault }]} />
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>이름</ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>{requesterName}</ThemedText>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: theme.tabIconDefault }]} />
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.tabIconDefault }]}>전화번호</ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>{requesterPhone}</ThemedText>
          </View>
        </View>

        <View style={styles.qrActions}>
          <Pressable 
            style={[styles.qrActionButton, { backgroundColor: primaryColor }]}
            onPress={handleCopy}
          >
            <Icon name="copy-outline" size={20} color={Colors.light.buttonText} />
            <ThemedText style={styles.qrActionButtonText}>코드 복사</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.qrActionButton, { backgroundColor: theme.backgroundDefault, borderWidth: 1, borderColor: Colors.light.backgroundTertiary }]}
            onPress={handleShare}
          >
            <Icon name="share-outline" size={20} color={theme.text} />
            <ThemedText style={[styles.qrActionButtonText, { color: theme.text }]}>공유하기</ThemedText>
          </Pressable>
        </View>
      </Card>

      <Card variant="outline" padding="md" style={styles.infoCard}>
        <Icon name="information-circle-outline" size={20} color={theme.tabIconDefault} />
        <ThemedText style={[styles.infoText, { color: theme.tabIconDefault }]}>
          헬퍼가 이 QR 코드를 스캔하면 출근이 자동으로 기록됩니다.
        </ThemedText>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  qrCard: {
    padding: Spacing['2xl'],
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  qrTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  qrSubtitle: {
    ...Typography.body,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  qrCodeContainer: {
    width: 200,
    height: 200,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  qrPlaceholder: {
    alignItems: 'center',
  },
  infoContainer: {
    width: '100%',
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    ...Typography.body,
  },
  infoValue: {
    ...Typography.body,
    fontWeight: '600',
  },
  infoDivider: {
    height: 1,
    opacity: 0.2,
  },
  qrActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  qrActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  qrActionButtonText: {
    color: Colors.light.buttonText,
    ...Typography.small,
    fontWeight: '600',
  },
  scanCard: {
    padding: Spacing['2xl'],
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  scanTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  scanSubtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  scanButtonText: {
    color: Colors.light.buttonText,
    ...Typography.body,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  infoText: {
    ...Typography.small,
    flex: 1,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    opacity: 0.3,
  },
  dividerText: {
    ...Typography.small,
    marginHorizontal: Spacing.md,
  },
  manualInputCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  codeInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pasteButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeHint: {
    ...Typography.small,
    marginBottom: Spacing.lg,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    width: '100%',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  verifyButtonText: {
    color: Colors.light.buttonText,
    ...Typography.body,
    fontWeight: '600',
  },
});
