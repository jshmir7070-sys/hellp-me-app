import React, { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert, Platform, Modal, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SignatureScreen from 'react-native-signature-canvas';

import { ThemedText } from '@/components/ThemedText';
import { Icon } from '@/components/Icon';
import { SafeScrollView } from '@/components/SafeScrollView';
import { Card } from '@/components/Card';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, BrandColors, Colors } from '@/constants/theme';
import { getApiUrl } from '@/lib/query-client';

type DocPlatformContractScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

const CONTRACT_CLAUSES = [
  {
    id: 1,
    title: '제1조 (목적)',
    content: '본 계약은 헬프미 플랫폼을 통한 운송 서비스 제공에 관한 회사와 헬퍼 간의 권리와 의무를 명확히 하는 것을 목적으로 합니다.',
  },
  {
    id: 2,
    title: '제2조 (용역 제공)',
    content: '헬퍼는 회사가 제공하는 플랫폼을 통해 의뢰된 운송 업무를 성실히 수행하며, 고객에게 양질의 서비스를 제공할 의무가 있습니다.',
  },
  {
    id: 3,
    title: '제3조 (수수료 및 정산)',
    content: '회사는 헬퍼가 수행한 업무에 대해 합의된 수수료율을 적용하여 정산하며, 정산은 매월 말일 기준으로 익월 5일 이내에 지급됩니다.',
  },
  {
    id: 4,
    title: '제4조 (손해배상)',
    content: '헬퍼는 업무 수행 중 발생한 화물 파손, 분실 등에 대해 책임을 지며, 고의 또는 중대한 과실이 있는 경우 손해를 배상해야 합니다.',
  },
  {
    id: 5,
    title: '제5조 (개인정보 보호)',
    content: '양 당사자는 업무 수행 중 취득한 상대방 및 고객의 개인정보를 관련 법령에 따라 보호하며, 업무 목적 외 사용을 금지합니다.',
  },
  {
    id: 6,
    title: '제6조 (계약 해지)',
    content: '일방 당사자가 본 계약을 위반하거나 중대한 사유가 발생한 경우, 상대방은 7일의 시정 기간을 부여한 후 계약을 해지할 수 있습니다.',
  },
  {
    id: 7,
    title: '제7조 (분쟁 해결)',
    content: '본 계약과 관련된 분쟁은 상호 협의를 통해 해결하며, 협의가 이루어지지 않을 경우 회사 소재지 관할 법원을 전속 관할로 합니다.',
  },
];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DocPlatformContractScreen({ navigation }: DocPlatformContractScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const signatureRef = useRef<any>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [agreements, setAgreements] = useState<Record<number, boolean>>({
    1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false,
  });
  const [signature, setSignature] = useState<string | null>(null);

  const allAgreed = Object.values(agreements).every(agreed => agreed);
  const canSubmit = () => allAgreed && !!signature;

  const toggleAgreement = (id: number) => {
    setAgreements(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllAgreements = () => {
    const newValue = !allAgreed;
    setAgreements({
      1: newValue, 2: newValue, 3: newValue, 4: newValue,
      5: newValue, 6: newValue, 7: newValue,
    });
  };

  const handleSignature = (sig: string) => {
    setSignature(sig);
    setShowSignatureModal(false);
  };

  const handleClearSignature = () => {
    setSignature(null);
  };

  const handleOpenSignature = () => {
    setShowSignatureModal(true);
  };

  const handleCloseSignatureModal = () => {
    setShowSignatureModal(false);
  };

  const handleSave = async () => {
    if (!canSubmit()) {
      const missing: string[] = [];
      if (!allAgreed) missing.push('모든 약관 동의');
      if (!signature) missing.push('서명');

      const message = `다음 항목을 확인해주세요:\n${missing.join(', ')}`;
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('필수 항목 누락', message);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');

      const response = await fetch(
        new URL('/api/helpers/me/contract', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            agreedClauses: Object.keys(agreements).map(Number),
            signatureData: signature,
            signedAt: new Date().toISOString(),
          }),
        }
      );

      if (response.ok) {
        if (Platform.OS === 'web') {
          alert('운송 계약서가 저장되었습니다');
        } else {
          Alert.alert('저장 완료', '운송 계약서가 저장되었습니다', [
            { text: '확인', onPress: () => navigation.goBack() }
          ]);
        }
      } else {
        throw new Error('운송 계약서 저장 실패');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      if (Platform.OS === 'web') {
        alert('저장 실패: ' + (error.message || '다시 시도해주세요.'));
      } else {
        Alert.alert('저장 실패', error.message || '다시 시도해주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const signatureStyle = `.m-signature-pad {box-shadow: none; border: none; margin: 0;}
    .m-signature-pad--body {border: none; margin: 0; padding: 0;}
    .m-signature-pad--footer {display: none;}
    body,html {width: 100%; height: 100%; margin: 0; padding: 0;}
    canvas {touch-action: none;}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <SafeScrollView
        contentContainerStyle={styles.content}
        bottomButtonHeight={80}
        includeHeaderHeight={true}
        topPadding={Spacing.xl}
      >
        <View style={styles.headerSection}>
          <ThemedText style={[styles.title, { color: theme.text }]}>운송 계약서</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
            회사와 헬퍼 간의 운송 서비스 제공 계약
          </ThemedText>
        </View>

        {/* All Agreement Toggle */}
        <Card variant="glass" padding="md" style={styles.allAgreementCard}>
          <Pressable
            style={styles.agreementRow}
            onPress={toggleAllAgreements}
          >
            <View style={[
              styles.checkbox,
              {
                backgroundColor: allAgreed ? BrandColors.helper : 'transparent',
                borderColor: allAgreed ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary),
              }
            ]}>
              {allAgreed && <Icon name="checkmark-outline" size={16} color={Colors.light.buttonText} />}
            </View>
            <ThemedText style={[styles.agreementText, { color: theme.text, fontWeight: '600' }]}>
              전체 동의
            </ThemedText>
          </Pressable>
        </Card>

        {/* Contract Clauses */}
        {CONTRACT_CLAUSES.map((clause) => (
          <Card key={clause.id} variant="glass" padding="md" style={styles.clauseCard}>
            <Pressable
              style={styles.agreementRow}
              onPress={() => toggleAgreement(clause.id)}
            >
              <View style={[
                styles.checkbox,
                {
                  backgroundColor: agreements[clause.id] ? BrandColors.helper : 'transparent',
                  borderColor: agreements[clause.id] ? BrandColors.helper : (isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary),
                }
              ]}>
                {agreements[clause.id] && <Icon name="checkmark-outline" size={16} color={Colors.light.buttonText} />}
              </View>
              <View style={styles.clauseContent}>
                <ThemedText style={[styles.clauseTitle, { color: theme.text }]}>
                  {clause.title}
                </ThemedText>
                <ThemedText style={[styles.clauseText, { color: theme.tabIconDefault }]}>
                  {clause.content}
                </ThemedText>
              </View>
            </Pressable>
          </Card>
        ))}

        {/* Signature Section */}
        <Card variant="glass" padding="md" style={styles.signatureCard}>
          <View style={styles.signatureHeader}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              전자서명 <ThemedText style={styles.required}>*</ThemedText>
            </ThemedText>
            {signature && (
              <Pressable onPress={handleClearSignature}>
                <ThemedText style={[styles.clearButton, { color: BrandColors.helper }]}>
                  다시 서명
                </ThemedText>
              </Pressable>
            )}
          </View>
          <ThemedText style={[styles.signatureDescription, { color: theme.tabIconDefault }]}>
            아래 버튼을 눌러 서명해주세요
          </ThemedText>

          {signature ? (
            <View style={[
              styles.signaturePreview,
              {
                backgroundColor: isDark ? Colors.dark.backgroundDefault : Colors.light.backgroundDefault,
                borderColor: BrandColors.success,
              }
            ]}>
              <Icon name="checkmark-circle" size={32} color={BrandColors.success} />
              <ThemedText style={[styles.signedText, { color: BrandColors.success }]}>
                서명 완료
              </ThemedText>
            </View>
          ) : (
            <Pressable
              style={[styles.signatureButton, { borderColor: BrandColors.helper }]}
              onPress={handleOpenSignature}
            >
              <Icon name="create-outline" size={24} color={BrandColors.helper} />
              <ThemedText style={[styles.signatureButtonText, { color: BrandColors.helper }]}>
                서명하기
              </ThemedText>
            </Pressable>
          )}
        </Card>
      </SafeScrollView>

      {/* Signature Modal */}
      <Modal
        visible={showSignatureModal}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseSignatureModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable onPress={handleCloseSignatureModal} style={styles.modalCloseButton}>
              <Icon name="close-outline" size={28} color={theme.text} />
            </Pressable>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>전자서명</ThemedText>
            <View style={{ width: 28 }} />
          </View>

          <View style={styles.modalContent}>
            <ThemedText style={[styles.modalInstruction, { color: theme.tabIconDefault }]}>
              아래 영역에 서명해주세요
            </ThemedText>
            <View style={[
              styles.modalSignatureContainer,
              {
                backgroundColor: isDark ? Colors.dark.backgroundDefault : '#FFFFFF',
                borderColor: isDark ? Colors.dark.backgroundSecondary : Colors.light.backgroundTertiary,
              }
            ]}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignature}
                onEmpty={() => Alert.alert('알림', '서명을 입력해주세요')}
                webStyle={signatureStyle}
                autoClear={false}
                descriptionText=""
                penColor={isDark ? '#FFFFFF' : '#000000'}
                minWidth={1.5}
                maxWidth={3}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonClear, { borderColor: theme.textSecondary }]}
                onPress={() => signatureRef.current?.clearSignature()}
              >
                <Icon name="trash-outline" size={20} color={theme.textSecondary} />
                <ThemedText style={[styles.modalButtonText, { color: theme.textSecondary }]}>
                  지우기
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: BrandColors.helper }]}
                onPress={() => signatureRef.current?.readSignature()}
              >
                <Icon name="checkmark-outline" size={20} color={Colors.light.buttonText} />
                <ThemedText style={[styles.modalButtonText, { color: Colors.light.buttonText }]}>
                  완료
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.bottomBar, {
        paddingBottom: insets.bottom + Spacing.md,
        backgroundColor: theme.backgroundRoot
      }]}>
        <Pressable
          style={[
            styles.saveButton,
            {
              backgroundColor: canSubmit() ? BrandColors.helper : Colors.light.textTertiary,
              opacity: isSubmitting ? 0.7 : 1,
            }
          ]}
          onPress={handleSave}
          disabled={isSubmitting || !canSubmit()}
        >
          <Icon name="checkmark-outline" size={20} color={Colors.light.buttonText} />
          <ThemedText style={styles.saveButtonText}>저장</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  headerSection: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  allAgreementCard: {
    marginBottom: Spacing.md,
  },
  clauseCard: {
    marginBottom: Spacing.sm,
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  agreementText: {
    fontSize: 15,
    flex: 1,
  },
  clauseContent: {
    flex: 1,
  },
  clauseTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  clauseText: {
    fontSize: 13,
    lineHeight: 20,
  },
  signatureCard: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  required: {
    color: BrandColors.error,
  },
  clearButton: {
    fontSize: 13,
    fontWeight: '500',
  },
  signatureDescription: {
    fontSize: 12,
    marginBottom: Spacing.md,
  },
  signatureButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  signatureButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  signaturePreview: {
    borderWidth: 2,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  signedText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundTertiary,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  saveButtonText: {
    color: Colors.light.buttonText,
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.backgroundTertiary,
  },
  modalCloseButton: {
    padding: Spacing.xs,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  modalInstruction: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  modalSignatureContainer: {
    flex: 1,
    borderWidth: 2,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  modalButtonClear: {
    borderWidth: 1,
  },
  modalButtonConfirm: {
    // backgroundColor set inline
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
