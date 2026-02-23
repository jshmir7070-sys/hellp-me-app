import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import * as ImagePicker from 'expo-image-picker';
import { Colors, BrandColors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuthImage } from '@/hooks/useAuthImage';
import { apiRequest, getApiUrl, getAuthToken } from '@/lib/query-client';
import { formatOrderNumber } from '@/lib/format-order-number';

interface Evidence {
  id: number;
  fileUrl: string;
  evidenceType: string;
  description: string | null;
}

interface IncidentDetail {
  id: number;
  orderId: number;
  incidentType: string;
  incidentDate: string;
  description: string;
  status: string;
  helperStatus: string | null;
  helperActionAt: string | null;
  helperNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  trackingNumber: string | null;
  deliveryAddress: string | null;
  customerName: string | null;
  customerPhone: string | null;
  damageAmount: number | null;
  order: {
    id: number;
    campAddress: string | null;
    deliveryArea: string;
    scheduledDate: string;
    courierCompany: string | null;
    averageQuantity: string | null;
  } | null;
  requester: {
    name: string;
    phone: string;
  } | null;
  evidence: Evidence[];
}

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  damage: '파손',
  loss: '분실',
  lost: '분실',
  misdelivery: '오배송',
  wrong_delivery: '오배송',
  delay: '지연',
  other: '기타',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  submitted: { label: '접수됨', color: BrandColors.warning },
  investigating: { label: '조사중', color: BrandColors.info },
  resolved: { label: '해결됨', color: BrandColors.success },
  closed: { label: '종료', color: BrandColors.neutral },
};

// 대응 카테고리 정의
interface ResponseCategory {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  description: string;
  requiresPhoto: boolean;
  actions: Array<{
    key: string;
    label: string;
    icon: keyof typeof Feather.glyphMap;
  }>;
}

const RESPONSE_CATEGORIES: ResponseCategory[] = [
  {
    key: 'correction_delivery',
    label: '정정배송',
    icon: 'truck',
    color: '#2196F3',
    description: '오배송된 물건을 올바른 주소로 재배송합니다',
    requiresPhoto: true,
    actions: [
      { key: 'redelivered', label: '재배송 완료', icon: 'check-circle' },
      { key: 'redelivery_in_progress', label: '재배송 진행중', icon: 'clock' },
    ],
  },
  {
    key: 'return_sendback',
    label: '반납 및 반송',
    icon: 'rotate-ccw',
    color: '#FF9800',
    description: '물건을 회수하여 반납 또는 반송 처리합니다',
    requiresPhoto: true,
    actions: [
      { key: 'recovered', label: '회수 완료', icon: 'check-circle' },
      { key: 'return_in_progress', label: '반납 진행중', icon: 'clock' },
      { key: 'item_found', label: '물건 찾음', icon: 'search' },
    ],
  },
  {
    key: 'accident_request',
    label: '사고처리요청',
    icon: 'alert-circle',
    color: '#F44336',
    description: '사고 처리를 요청하거나 이의를 제기합니다',
    requiresPhoto: false,
    actions: [
      { key: 'damage_confirmed', label: '파손 확인', icon: 'alert-triangle' },
      { key: 'request_handling', label: '처리 요망', icon: 'alert-circle' },
      { key: 'confirmed', label: '확인 완료', icon: 'check' },
      { key: 'dispute', label: '이의 제기', icon: 'message-circle' },
    ],
  },
];

// 기존 HELPER_ACTIONS (이전 응답 표시용)
const HELPER_ACTION_LABELS: Record<string, string> = {
  item_found: '물건찾음',
  recovered: '회수완료',
  redelivered: '재배송완료',
  redelivery_in_progress: '재배송진행중',
  return_in_progress: '반납진행중',
  damage_confirmed: '파손확인',
  request_handling: '처리요망',
  confirmed: '확인완료',
  dispute: '이의제기',
};

export default function HelperIncidentDetailScreen() {
  const { theme, isDark } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const { getImageUrl: getEvidenceImageUrl } = useAuthImage();
  const colors = theme;
  const route = useRoute<RouteProp<{ params: { incidentId: number } }, 'params'>>();
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const { incidentId } = route.params;

  const [showResponseSection, setShowResponseSection] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: incident, isLoading } = useQuery<IncidentDetail>({
    queryKey: ['/api/helper/incidents', incidentId],
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, note, category }: { action: string; note: string; category: string }) => {
      return apiRequest('POST', `/api/helper/incidents/${incidentId}/action`, { action, note, category });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/helper/incidents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/helper/incidents', incidentId] });
      Alert.alert('완료', '대응이 전송되었습니다');
      setNote('');
      setSelectedAction(null);
      setSelectedCategory(null);
      setShowResponseSection(false);
      setEvidencePhotos([]);
    },
    onError: (error: any) => {
      Alert.alert('오류', error.message || '대응 전송에 실패했습니다');
    },
  });

  const evidenceUploadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/helper/incidents/${incidentId}/evidence`, {
        imageUrls: evidencePhotos,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/helper/incidents', incidentId] });
    },
    onError: (error: any) => {
      console.error('Evidence upload error:', error);
    },
  });

  const pickImage = async () => {
    if (evidencePhotos.length >= 5) {
      Alert.alert('알림', '사진은 최대 5장까지 첨부할 수 있습니다.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      try {
        const formData = new FormData();
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop() || 'photo.jpg';
        formData.append('file', { uri, name: filename, type: 'image/jpeg' } as any);

        const token = await getAuthToken();
        const response = await fetch(`${getApiUrl().replace(/\/$/, '')}/api/upload/evidence`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setEvidencePhotos(prev => [...prev, data.url]);
        } else {
          Alert.alert('오류', '사진 업로드에 실패했습니다.');
        }
      } catch (err) {
        console.error('Upload error:', err);
        Alert.alert('오류', '사진 업로드 중 오류가 발생했습니다.');
      } finally {
        setUploading(false);
      }
    }
  };

  const removePhoto = (index: number) => {
    setEvidencePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleCategorySelect = (categoryKey: string) => {
    if (selectedCategory === categoryKey) {
      setSelectedCategory(null);
      setSelectedAction(null);
    } else {
      setSelectedCategory(categoryKey);
      setSelectedAction(null);
      setEvidencePhotos([]);
    }
  };

  const handleSubmit = () => {
    if (!selectedCategory || !selectedAction) {
      Alert.alert('알림', '대응 유형을 선택해주세요.');
      return;
    }

    const category = RESPONSE_CATEGORIES.find(c => c.key === selectedCategory);
    if (category?.requiresPhoto && evidencePhotos.length === 0) {
      Alert.alert('알림', `${category.label}은(는) 사진 첨부가 필수입니다.\n증빙 사진을 1장 이상 첨부해주세요.`);
      return;
    }

    if (!note.trim()) {
      Alert.alert('알림', '내용을 입력해주세요.');
      return;
    }

    // 사진이 있으면 먼저 업로드
    if (evidencePhotos.length > 0) {
      evidenceUploadMutation.mutate();
    }
    actionMutation.mutate({ action: selectedAction, note: note.trim(), category: selectedCategory });
  };

  const currentCategory = RESPONSE_CATEGORIES.find(c => c.key === selectedCategory);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.backgroundRoot }]}>
        <Text style={{ color: colors.text }}>사고를 찾을 수 없습니다</Text>
      </View>
    );
  }

  const statusInfo = STATUS_LABELS[incident.status] || { label: incident.status, color: BrandColors.neutral };
  const typeLabel = INCIDENT_TYPE_LABELS[incident.incidentType] || incident.incidentType;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.backgroundRoot }]}
      contentContainerStyle={[styles.content, {
        paddingTop: headerHeight + Spacing.md,
        ...(showDesktopLayout && {
          maxWidth: containerMaxWidth,
          alignSelf: 'center' as const,
          width: '100%' as any,
        }),
      }]}
    >
      {/* 사고 기본 정보 카드 */}
      <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={styles.header}>
          <View style={styles.typeContainer}>
            <Feather name="alert-triangle" size={20} color={BrandColors.warning} />
            <Text style={[styles.typeText, { color: colors.text }]}>
              {typeLabel}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Feather name="calendar" size={14} color={colors.tabIconDefault} />
          <Text style={[styles.dateText, { color: colors.tabIconDefault }]}>
            배송일: {(() => {
              const dateStr = incident.order?.scheduledDate;
              if (!dateStr) return '-';
              const date = new Date(dateStr);
              return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('ko-KR');
            })()}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          사고 내용
        </Text>
        <Text style={[styles.description, { color: colors.tabIconDefault }]}>
          {incident.description}
        </Text>

        {incident.trackingNumber ? (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              송장번호
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.trackingNumber}
            </Text>
          </View>
        ) : null}

        {incident.deliveryAddress ? (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              배송지 주소
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.deliveryAddress}
            </Text>
          </View>
        ) : null}

        {incident.customerName ? (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              수하인
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.customerName}{incident.customerPhone ? ` (${incident.customerPhone})` : ''}
            </Text>
          </View>
        ) : null}

        {incident.damageAmount ? (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              피해금액
            </Text>
            <Text style={[styles.infoValue, { color: BrandColors.error }]}>
              {incident.damageAmount.toLocaleString()}원
            </Text>
          </View>
        ) : null}
      </View>

      {/* 오더 정보 */}
      {incident.order ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            오더 정보
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              운송사
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.order.courierCompany || '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              배송지역
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.order.deliveryArea || '-'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              오더번호
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {formatOrderNumber(incident.order.orderNumber, incident.order.id)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              배송일
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {new Date(incident.order.scheduledDate).toLocaleDateString('ko-KR')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              수행헬퍼
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {(incident.order as any).helperName || '-'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 요청자 정보 */}
      {incident.requester ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            요청자 정보
          </Text>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              이름
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.requester.name}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.tabIconDefault }]}>
              연락처
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {incident.requester.phone}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 증빙 자료 */}
      {incident.evidence && incident.evidence.length > 0 ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            증빙 자료 ({incident.evidence.length}건)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {incident.evidence.map((ev) => (
              <View key={ev.id} style={styles.evidenceItem}>
                <Image source={{ uri: getEvidenceImageUrl(ev.fileUrl) }} style={styles.evidenceImage} />
                {ev.description ? (
                  <Text style={[styles.evidenceDesc, { color: colors.tabIconDefault }]}>
                    {ev.description}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* 이전 응답 표시 */}
      {incident.helperStatus ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            내 응답
          </Text>
          <View style={[styles.myResponseBadge, { backgroundColor: BrandColors.helper + '20' }]}>
            <Text style={[styles.myResponseText, { color: BrandColors.helper }]}>
              {HELPER_ACTION_LABELS[incident.helperStatus] || incident.helperStatus}
            </Text>
          </View>
          {incident.helperNote ? (
            <Text style={[styles.helperNoteText, { color: colors.tabIconDefault }]}>
              {incident.helperNote}
            </Text>
          ) : null}
          <Text style={[styles.responseTime, { color: colors.tabIconDefault }]}>
            {incident.helperActionAt ? new Date(incident.helperActionAt).toLocaleString('ko-KR') : ''}
          </Text>
        </View>
      ) : null}

      {/* 대응하기 버튼 (응답 미완료 시) */}
      {!incident.helperStatus && !showResponseSection ? (
        <Pressable
          style={[styles.responseOpenButton]}
          onPress={() => setShowResponseSection(true)}
        >
          <Feather name="edit-3" size={20} color="#fff" />
          <Text style={styles.responseOpenButtonText}>대응하기</Text>
        </Pressable>
      ) : null}

      {/* ===== 대응 섹션 (스크롤 형식 카테고리) ===== */}
      {showResponseSection && !incident.helperStatus ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.responseSectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
              사고 대응
            </Text>
            <Pressable onPress={() => { setShowResponseSection(false); setSelectedCategory(null); setSelectedAction(null); setEvidencePhotos([]); }}>
              <Feather name="x" size={20} color={colors.tabIconDefault} />
            </Pressable>
          </View>
          <Text style={[styles.actionHint, { color: colors.tabIconDefault }]}>
            대응 유형을 선택하고 내용을 작성해주세요
          </Text>

          {/* 카테고리 가로 스크롤 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryScrollContent}
          >
            {RESPONSE_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: isSelected ? cat.color + '15' : colors.backgroundRoot,
                      borderColor: isSelected ? cat.color : colors.backgroundTertiary || '#ddd',
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleCategorySelect(cat.key)}
                >
                  <View style={[styles.categoryIconCircle, { backgroundColor: cat.color + '20' }]}>
                    <Feather name={cat.icon} size={24} color={cat.color} />
                  </View>
                  <Text style={[styles.categoryLabel, { color: isSelected ? cat.color : colors.text }]}>
                    {cat.label}
                  </Text>
                  {cat.requiresPhoto ? (
                    <View style={[styles.requiredBadge, { backgroundColor: BrandColors.error + '20' }]}>
                      <Feather name="camera" size={10} color={BrandColors.error} />
                      <Text style={[styles.requiredBadgeText, { color: BrandColors.error }]}>필수</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* 선택된 카테고리 세부 액션 */}
          {currentCategory ? (
            <View style={styles.actionSection}>
              <Text style={[styles.categoryDescription, { color: colors.tabIconDefault }]}>
                {currentCategory.description}
              </Text>

              {/* 세부 액션 선택 */}
              <Text style={[styles.subLabel, { color: colors.text }]}>
                세부 대응 선택
              </Text>
              <View style={styles.subActionGrid}>
                {currentCategory.actions.map((action) => {
                  const isSelected = selectedAction === action.key;
                  return (
                    <Pressable
                      key={action.key}
                      style={[
                        styles.subActionButton,
                        {
                          backgroundColor: isSelected ? currentCategory.color + '15' : colors.backgroundRoot,
                          borderColor: isSelected ? currentCategory.color : colors.backgroundTertiary || '#ddd',
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                      onPress={() => setSelectedAction(action.key)}
                    >
                      <Feather
                        name={action.icon}
                        size={16}
                        color={isSelected ? currentCategory.color : colors.tabIconDefault}
                      />
                      <Text
                        style={[
                          styles.subActionText,
                          { color: isSelected ? currentCategory.color : colors.text },
                        ]}
                      >
                        {action.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 사진 업로드 (필수/선택) */}
              <View style={styles.photoSection}>
                <Text style={[styles.subLabel, { color: colors.text }]}>
                  증빙 사진 {currentCategory.requiresPhoto ? (
                    <Text style={{ color: BrandColors.error, fontWeight: '700' }}>(필수)</Text>
                  ) : '(선택)'}
                  <Text style={[styles.photoCountText, { color: colors.tabIconDefault }]}> 최대 5장</Text>
                </Text>
                <View style={styles.photoGrid}>
                  {evidencePhotos.map((url, index) => (
                    <View key={index} style={styles.photoContainer}>
                      <Image source={{ uri: getEvidenceImageUrl(url) }} style={styles.photoThumbnail} />
                      <Pressable style={styles.removePhotoButton} onPress={() => removePhoto(index)}>
                        <Feather name="x-circle" size={20} color="#ff4444" />
                      </Pressable>
                    </View>
                  ))}
                  {evidencePhotos.length < 5 ? (
                    <Pressable
                      style={[styles.addPhotoButton, {
                        borderColor: currentCategory.requiresPhoto && evidencePhotos.length === 0
                          ? BrandColors.error
                          : colors.tabIconDefault,
                      }]}
                      onPress={pickImage}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color={currentCategory.color} />
                      ) : (
                        <>
                          <Feather
                            name="camera"
                            size={22}
                            color={currentCategory.requiresPhoto && evidencePhotos.length === 0
                              ? BrandColors.error
                              : colors.tabIconDefault}
                          />
                          <Text style={[styles.addPhotoText, {
                            color: currentCategory.requiresPhoto && evidencePhotos.length === 0
                              ? BrandColors.error
                              : colors.tabIconDefault,
                          }]}>
                            {currentCategory.requiresPhoto && evidencePhotos.length === 0 ? '필수' : '추가'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* 내용 작성 */}
              <Text style={[styles.subLabel, { color: colors.text }]}>
                내용 작성 <Text style={{ color: BrandColors.error, fontWeight: '700' }}>(필수)</Text>
              </Text>
              <TextInput
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: colors.backgroundRoot,
                    color: colors.text,
                    borderColor: !note.trim() ? BrandColors.error + '60' : colors.backgroundTertiary,
                  },
                ]}
                placeholder="상세한 대응 내용을 입력하세요..."
                placeholderTextColor={colors.tabIconDefault}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* 전송 버튼 */}
              <Pressable
                style={[
                  styles.submitButton,
                  { backgroundColor: currentCategory.color },
                  (actionMutation.isPending || evidenceUploadMutation.isPending) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={actionMutation.isPending || evidenceUploadMutation.isPending}
              >
                {actionMutation.isPending || evidenceUploadMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={styles.submitButtonContent}>
                    <Feather name="send" size={18} color="#fff" />
                    <Text style={styles.submitButtonText}>대응 전송</Text>
                  </View>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing['5xl'],
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  typeText: {
    ...Typography.h4,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    ...Typography.small,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  dateText: {
    ...Typography.small,
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  description: {
    ...Typography.small,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  infoLabel: {
    width: 60,
    ...Typography.small,
  },
  infoValue: {
    flex: 1,
    ...Typography.small,
  },
  evidenceItem: {
    marginRight: Spacing.sm,
  },
  evidenceImage: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
  },
  evidenceDesc: {
    fontSize: 12,
    marginTop: Spacing.xs,
    maxWidth: 100,
  },
  myResponseBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  myResponseText: {
    ...Typography.body,
    fontWeight: '600',
  },
  helperNoteText: {
    ...Typography.small,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  responseTime: {
    fontSize: 12,
  },
  actionHint: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  // 대응하기 열기 버튼
  responseOpenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: BrandColors.helper,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  responseOpenButtonText: {
    color: '#fff',
    ...Typography.body,
    fontWeight: '700',
  },
  // 대응 섹션 헤더
  responseSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  // 카테고리 가로 스크롤
  categoryScroll: {
    marginHorizontal: -Spacing.md,
    marginBottom: Spacing.md,
  },
  categoryScrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  categoryCard: {
    width: 110,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  categoryIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  categoryLabel: {
    ...Typography.small,
    fontWeight: '700',
    textAlign: 'center',
  },
  requiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  requiredBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  // 세부 액션 섹션
  actionSection: {
    marginTop: Spacing.xs,
  },
  categoryDescription: {
    ...Typography.small,
    lineHeight: 20,
    marginBottom: Spacing.md,
    fontStyle: 'italic',
  },
  subLabel: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  subActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  subActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  subActionText: {
    ...Typography.small,
    fontWeight: '500',
  },
  // 사진 섹션
  photoSection: {
    marginBottom: Spacing.md,
  },
  photoCountText: {
    fontWeight: '400',
    fontSize: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  photoContainer: {
    position: 'relative',
  },
  photoThumbnail: {
    width: 70,
    height: 70,
    borderRadius: BorderRadius.sm,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addPhotoButton: {
    width: 70,
    height: 70,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 11,
    marginTop: 2,
  },
  // 메모 입력
  noteInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  // 전송 버튼
  submitButton: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  submitButtonText: {
    color: '#fff',
    ...Typography.body,
    fontWeight: '700',
  },
});
