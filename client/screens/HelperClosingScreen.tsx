import React, { useState, useCallback } from "react";
import { View, StyleSheet, Alert, Platform, TextInput, ScrollView, Pressable, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Icon } from "@/components/Icon";
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from "@/hooks/useTheme";
import { useResponsive } from "@/hooks/useResponsive";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { OrderCard } from "@/components/order/OrderCard";
import { adaptHelperMyOrder, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/query-client";
import { formatOrderNumber } from "@/lib/format-order-number";

type ClosingStackParamList = {
  HelperClosing: undefined;
  ClosingInput: { orderId: number };
};

type HelperClosingScreenProps = NativeStackScreenProps<ClosingStackParamList, 'HelperClosing'>;

interface UploadedImage {
  uri: string;
  type: 'DELIVERY_HISTORY' | 'ETC';
  uploading?: boolean;
  fileKey?: string;
}

type FilterTab = 'all' | 'in_progress' | 'closing_submitted' | 'closing_completed';

export default function HelperClosingScreen({ navigation }: HelperClosingScreenProps) {
  const { theme, isDark } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['/api/helper/my-orders'],
  });

  const inProgressOrders = React.useMemo(() => {
    return orders
      .filter(order => ['in_progress', 'scheduled', 'checked_in'].includes(order.status?.toLowerCase() || ''))
      .map(order => adaptHelperMyOrder(order));
  }, [orders]);

  const closingSubmittedOrders = React.useMemo(() => {
    return orders
      .filter(order => order.status?.toLowerCase() === 'closing_submitted')
      .map(order => adaptHelperMyOrder(order));
  }, [orders]);

  const closingCompletedOrders = React.useMemo(() => {
    return orders
      .filter(order => ['final_amount_confirmed', 'balance_paid', 'settlement_paid', 'closed', 'completed'].includes(order.status?.toLowerCase() || ''))
      .map(order => adaptHelperMyOrder(order));
  }, [orders]);

  const filteredSections = React.useMemo(() => {
    switch (activeFilter) {
      case 'in_progress':
        return { inProgress: inProgressOrders, submitted: [], completed: [] };
      case 'closing_submitted':
        return { inProgress: [], submitted: closingSubmittedOrders, completed: [] };
      case 'closing_completed':
        return { inProgress: [], submitted: [], completed: closingCompletedOrders };
      default:
        return { inProgress: inProgressOrders, submitted: closingSubmittedOrders, completed: closingCompletedOrders };
    }
  }, [activeFilter, inProgressOrders, closingSubmittedOrders, closingCompletedOrders]);

  const handleCloseOrder = useCallback((item: OrderCardDTO) => {
    navigation.navigate('ClosingInput', { orderId: Number(item.orderId) });
  }, [navigation]);

  const handleCardAction = useCallback((action: string, item: OrderCardDTO) => {
    if (action === 'CLOSE' || action === 'close' || action === 'SUBMIT_CLOSING') {
      handleCloseOrder(item);
    } else if (action === 'VIEW_DETAIL' || action === 'VIEW_CLOSING') {
      handleCloseOrder(item);
    }
  }, [handleCloseOrder]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.helper} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: showDesktopLayout ? Spacing.xl : tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: 1,
        ...(showDesktopLayout && {
          maxWidth: containerMaxWidth,
          alignSelf: 'center' as const,
          width: '100%' as any,
        }),
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.header}>
        <Card style={styles.summaryCard}>
          <View style={styles.filterRow}>
            <Pressable
              style={[
                styles.filterTab,
                activeFilter === 'all' && { backgroundColor: isDark ? '#2d3748' : '#EDF2F7' },
              ]}
              onPress={() => setActiveFilter('all')}
            >
              <ThemedText style={[
                styles.filterLabel,
                { color: activeFilter === 'all' ? theme.text : theme.tabIconDefault },
                activeFilter === 'all' && { fontWeight: '700' },
              ]}>
                전체
              </ThemedText>
              <ThemedText style={[
                styles.filterValue,
                { color: activeFilter === 'all' ? BrandColors.helper : theme.tabIconDefault },
              ]}>
                {inProgressOrders.length + closingSubmittedOrders.length + closingCompletedOrders.length}건
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.filterTab,
                activeFilter === 'in_progress' && { backgroundColor: isDark ? '#2d3320' : '#FFFBEB' },
              ]}
              onPress={() => setActiveFilter('in_progress')}
            >
              <ThemedText style={[
                styles.filterLabel,
                { color: activeFilter === 'in_progress' ? BrandColors.warning : theme.tabIconDefault },
                activeFilter === 'in_progress' && { fontWeight: '700' },
              ]}>
                업무중
              </ThemedText>
              <ThemedText style={[styles.filterValue, { color: BrandColors.warning }]}>
                {inProgressOrders.length}건
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.filterTab,
                activeFilter === 'closing_submitted' && { backgroundColor: isDark ? '#1a2940' : '#EBF5FF' },
              ]}
              onPress={() => setActiveFilter('closing_submitted')}
            >
              <ThemedText style={[
                styles.filterLabel,
                { color: activeFilter === 'closing_submitted' ? BrandColors.helper : theme.tabIconDefault },
                activeFilter === 'closing_submitted' && { fontWeight: '700' },
              ]}>
                마감 제출
              </ThemedText>
              <ThemedText style={[styles.filterValue, { color: BrandColors.helper }]}>
                {closingSubmittedOrders.length}건
              </ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.filterTab,
                activeFilter === 'closing_completed' && { backgroundColor: isDark ? '#1a2e1a' : '#F0FFF4' },
              ]}
              onPress={() => setActiveFilter('closing_completed')}
            >
              <ThemedText style={[
                styles.filterLabel,
                { color: activeFilter === 'closing_completed' ? BrandColors.success : theme.tabIconDefault },
                activeFilter === 'closing_completed' && { fontWeight: '700' },
              ]}>
                마감 완료
              </ThemedText>
              <ThemedText style={[styles.filterValue, { color: BrandColors.success }]}>
                {closingCompletedOrders.length}건
              </ThemedText>
            </Pressable>
          </View>
        </Card>
      </View>

      {filteredSections.inProgress.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={[styles.statusDot, { backgroundColor: BrandColors.warning }]} />
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              업무중 (마감 대기)
            </ThemedText>
          </View>
          {filteredSections.inProgress.map((order) => (
            <OrderCard
              key={order.orderId}
              data={order}
              context="helper_my_orders"
              onPress={() => handleCloseOrder(order)}
            />
          ))}
        </View>
      )}

      {filteredSections.submitted.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={[styles.statusDot, { backgroundColor: BrandColors.helper }]} />
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              마감 제출 (요청자 확인 대기)
            </ThemedText>
          </View>
          {filteredSections.submitted.map((order) => (
            <OrderCard
              key={order.orderId}
              data={order}
              context="helper_my_orders"
            />
          ))}
        </View>
      )}

      {filteredSections.completed.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={[styles.statusDot, { backgroundColor: BrandColors.success }]} />
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              마감 완료
            </ThemedText>
          </View>
          {filteredSections.completed.map((order) => (
            <OrderCard
              key={order.orderId}
              data={order}
              context="helper_my_orders"
            />
          ))}
        </View>
      )}

      {filteredSections.inProgress.length === 0 && filteredSections.submitted.length === 0 && filteredSections.completed.length === 0 && (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: BrandColors.helperLight }]}>
            <Icon name="checkmark-circle-outline" size={32} color={BrandColors.helper} />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
            {activeFilter === 'all' ? '마감할 오더가 없습니다' :
             activeFilter === 'in_progress' ? '업무중인 오더가 없습니다' :
             activeFilter === 'closing_submitted' ? '마감 제출한 오더가 없습니다' :
             '마감 완료된 오더가 없습니다'}
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
            {activeFilter === 'all' ? '진행 중인 오더가 완료되면 여기서 마감할 수 있습니다' :
             activeFilter === 'in_progress' ? '현재 진행 중인 오더가 없습니다' :
             activeFilter === 'closing_submitted' ? '마감 제출 대기 중인 오더가 없습니다' :
             '아직 마감 완료된 오더가 없습니다'}
          </ThemedText>
        </Card>
      )}
    </ScrollView>
  );
}

interface ClosingField {
  id: number;
  fieldName: string;
  fieldType: string;
  isRequired: boolean;
  placeholder: string | null;
  description: string | null;
  targetRole: string;
  sortOrder: number;
}

export function ClosingInputScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { showDesktopLayout, containerMaxWidth } = useResponsive();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const { orderId } = route.params;

  const [closingText, setClosingText] = useState('');
  const [deliveredCount, setDeliveredCount] = useState('');
  const [returnedCount, setReturnedCount] = useState('');
  const [etcCount, setEtcCount] = useState('');
  const [extraCosts, setExtraCosts] = useState<{ code: string; amount: number; memo: string }[]>([]);
  const [deliveryHistoryImages, setDeliveryHistoryImages] = useState<UploadedImage[]>([]);
  const [etcImages, setEtcImages] = useState<UploadedImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dynamicFieldValues, setDynamicFieldValues] = useState<Record<string, string>>({});

  const { data: orderDetail } = useQuery<any>({
    queryKey: [`/api/orders/${orderId}`],
  });

  const { data: closingFields = [] } = useQuery<ClosingField[]>({
    queryKey: ['/api/closing-fields'],
  });

  const { data: courierSettings } = useQuery<Array<{
    id: number;
    label: string;
    etcPricePerBox: number;
  }>>({
    queryKey: ['/api/meta/couriers'],
  });
  
  const etcPricePerUnit = (() => {
    if (!orderDetail?.companyName || !courierSettings) return 0;
    const courier = courierSettings.find(c => c.label === orderDetail.companyName);
    return courier?.etcPricePerBox || 0;
  })();

  const pickImage = async (type: 'DELIVERY_HISTORY' | 'ETC', source: 'library' | 'camera') => {
    try {
      let result;
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('권한 필요', '카메라 사용 권한이 필요합니다.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: false,
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          quality: 0.8,
          selectionLimit: 5,
        });
      }

      if (!result.canceled && result.assets.length > 0) {
        const newImages: UploadedImage[] = result.assets.map(asset => ({
          uri: asset.uri,
          type,
          uploading: false,
        }));

        if (type === 'DELIVERY_HISTORY') {
          setDeliveryHistoryImages(prev => [...prev, ...newImages]);
        } else {
          setEtcImages(prev => [...prev, ...newImages]);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('오류', '이미지를 불러오는데 실패했습니다.');
    }
  };

  const removeImage = (type: 'DELIVERY_HISTORY' | 'ETC', index: number) => {
    if (type === 'DELIVERY_HISTORY') {
      setDeliveryHistoryImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setEtcImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  // 추가비용 관련 함수
  const addExtraCost = () => {
    setExtraCosts(prev => [...prev, { code: '', amount: 0, memo: '' }]);
  };

  const updateExtraCost = (index: number, field: 'code' | 'amount' | 'memo', value: string | number) => {
    const updated = [...extraCosts];
    if (field === 'amount') {
      updated[index][field] = Number(value) || 0;
    } else {
      updated[index][field] = value as string;
    }
    setExtraCosts(updated);
  };

  const removeExtraCost = (index: number) => {
    setExtraCosts(prev => prev.filter((_, i) => i !== index));
  };

  // 예상 정산금액 계산 (공급가 + 부가세)
  const estimatedSupply = (() => {
    const unitPrice = orderDetail?.pricePerUnit || 0;
    const delivered = parseInt(deliveredCount) || 0;
    const returned = parseInt(returnedCount) || 0;
    const etc = parseInt(etcCount) || 0;
    const extraTotal = extraCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
    const deliveryReturnAmt = (delivered + returned) * unitPrice;
    const etcAmt = etc * etcPricePerUnit;
    return deliveryReturnAmt + etcAmt + extraTotal;
  })();
  const estimatedVat = Math.round(estimatedSupply * 0.1);
  const estimatedAmount = estimatedSupply + estimatedVat;

  const uploadImages = async (images: UploadedImage[]): Promise<string[]> => {
    const fileKeys: string[] = [];
    const token = await getAuthToken();
    
    for (const img of images) {
      try {
        const formData = new FormData();
        const filename = img.uri.split('/').pop() || 'image.jpg';
        const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        
        if (Platform.OS === 'web') {
          const response = await fetch(img.uri);
          const blob = await response.blob();
          formData.append('file', blob, filename);
        } else {
          formData.append('file', {
            uri: img.uri,
            name: filename,
            type: mimeType,
          } as any);
        }
        
        formData.append('imageType', img.type);
        
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const uploadRes = await fetch(new URL('/api/upload/closing-image', getApiUrl()).toString(), {
          method: 'POST',
          body: formData,
          headers,
          credentials: 'include',
        });
        
        if (uploadRes.ok) {
          const data = await uploadRes.json();
          fileKeys.push(data.fileKey);
        } else {
          const errorText = await uploadRes.text();
          console.error('Upload failed:', uploadRes.status, errorText);
        }
      } catch (err) {
        console.error('Upload error:', err);
      }
    }
    
    return fileKeys;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      
      const deliveryHistoryFileKeys = await uploadImages(deliveryHistoryImages);
      const etcFileKeys = await uploadImages(etcImages);
      
      const res = await apiRequest('POST', `/api/orders/${orderId}/close`, {
        text: closingText,
        deliveredCount: parseInt(deliveredCount) || 0,
        returnedCount: parseInt(returnedCount) || 0,
        etcCount: parseInt(etcCount) || 0,
        extraCosts: extraCosts.filter(c => c.code && c.amount > 0),
        deliveryHistoryImages: deliveryHistoryFileKeys,
        etcImages: etcFileKeys,
        dynamicFields: dynamicFieldValues,
      });
      return res.json();
    },
    onSuccess: () => {
      setIsUploading(false);
      queryClient.invalidateQueries({ queryKey: ['/api/helper/my-orders'] });
      if (Platform.OS === 'web') {
        alert('마감이 제출되었습니다.');
      } else {
        Alert.alert('완료', '마감이 제출되었습니다. 요청자 확인 후 정산이 진행됩니다.');
      }
      navigation.goBack();
    },
    onError: (err: any) => {
      setIsUploading(false);
      if (Platform.OS === 'web') {
        alert(err.message || '마감 제출에 실패했습니다.');
      } else {
        Alert.alert('오류', err.message || '마감 제출에 실패했습니다.');
      }
    },
  });

  const handleSubmit = () => {
    if (!deliveredCount || parseInt(deliveredCount) < 0) {
      if (Platform.OS === 'web') {
        alert('배송 수량을 입력해주세요.');
      } else {
        Alert.alert('입력 오류', '배송 수량을 입력해주세요.');
      }
      return;
    }

    if (deliveryHistoryImages.length === 0) {
      if (Platform.OS === 'web') {
        alert('집배송 이력 화면 캡쳐 또는 사진이 반드시 필요합니다.\n분쟁 방지를 위한 필수 자료입니다.');
      } else {
        Alert.alert('필수 자료 누락', '집배송 이력 화면 캡쳐 또는 사진이 반드시 필요합니다.\n분쟁 방지를 위한 필수 자료입니다.');
      }
      return;
    }

    const requiredFields = closingFields.filter(f => f.isRequired);
    for (const field of requiredFields) {
      if (!dynamicFieldValues[field.fieldName]?.trim()) {
        const msg = `"${field.fieldName}" 필드는 필수 입력입니다.`;
        if (Platform.OS === 'web') {
          alert(msg);
        } else {
          Alert.alert('입력 오류', msg);
        }
        return;
      }
    }

    if (Platform.OS === 'web') {
      if (confirm('마감을 제출하시겠습니까?')) {
        submitMutation.mutate();
      }
    } else {
      Alert.alert(
        '마감 제출',
        '마감을 제출하시겠습니까? 제출 후에는 수정할 수 없습니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '제출', onPress: () => submitMutation.mutate() },
        ]
      );
    }
  };

  const requiredFieldsValid = closingFields
    .filter(f => f.isRequired)
    .every(f => !!dynamicFieldValues[f.fieldName]?.trim());
  const isValid = parseInt(deliveredCount) >= 0 && deliveryHistoryImages.length > 0 && requiredFieldsValid;
  const isPending = submitMutation.isPending || isUploading;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + 100,
        paddingHorizontal: Spacing.lg,
        ...(showDesktopLayout && {
          maxWidth: containerMaxWidth,
          alignSelf: 'center' as const,
          width: '100%' as any,
        }),
      }}
    >
      <Card style={styles.orderSummary}>
        <ThemedText style={[styles.orderTitle, { color: theme.text }]}>
          {formatOrderNumber(orderDetail?.orderNumber, orderId)}
        </ThemedText>
      </Card>

      <Card style={styles.warningCard}>
        <View style={styles.warningHeader}>
          <Icon name="warning-outline" size={20} color={BrandColors.warning} />
          <ThemedText style={[styles.warningTitle, { color: BrandColors.warning }]}>
            분쟁 방지 필수 안내
          </ThemedText>
        </View>
        <ThemedText style={[styles.warningText, { color: theme.text }]}>
          집배송 이력이 표시된 화면 캡쳐 또는 사진 업로드는 필수입니다.{'\n'}
          이력이 확인되지 않을 경우 마감 및 정산이 제한될 수 있습니다.
        </ThemedText>
      </Card>

      <Card style={styles.inputCard}>
        <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
          배송/반품 수량 (필수)
        </ThemedText>
        <ThemedText style={[styles.inputHint, { color: theme.tabIconDefault }]}>
          당일 배송 완료 및 반품 수량을 입력해주세요.
        </ThemedText>
        <View style={styles.countInputRow}>
          <View style={styles.countInputGroup}>
            <ThemedText style={[styles.countLabel, { color: theme.text }]}>배송 완료</ThemedText>
            <View style={[styles.countInputWrapper, { backgroundColor: theme.backgroundDefault, borderColor: deliveredCount ? BrandColors.helper : theme.tabIconDefault }]}>
              <TextInput
                style={[styles.countInput, { color: theme.text }]}
                placeholder="0"
                placeholderTextColor={theme.tabIconDefault}
                keyboardType="number-pad"
                value={deliveredCount}
                onChangeText={setDeliveredCount}
                maxLength={5}
              />
              <ThemedText style={[styles.countUnit, { color: theme.tabIconDefault }]}>건</ThemedText>
            </View>
          </View>
          <View style={styles.countInputGroup}>
            <ThemedText style={[styles.countLabel, { color: theme.text }]}>반품</ThemedText>
            <View style={[styles.countInputWrapper, { backgroundColor: theme.backgroundDefault, borderColor: returnedCount ? BrandColors.helper : theme.tabIconDefault }]}>
              <TextInput
                style={[styles.countInput, { color: theme.text }]}
                placeholder="0"
                placeholderTextColor={theme.tabIconDefault}
                keyboardType="number-pad"
                value={returnedCount}
                onChangeText={setReturnedCount}
                maxLength={5}
              />
              <ThemedText style={[styles.countUnit, { color: theme.tabIconDefault }]}>건</ThemedText>
            </View>
          </View>
          <View style={styles.countInputGroup}>
            <ThemedText style={[styles.countLabel, { color: theme.text, fontSize: 12 }]}>기타({etcPricePerUnit.toLocaleString()}원)</ThemedText>
            <View style={[styles.countInputWrapper, { backgroundColor: theme.backgroundDefault, borderColor: etcCount ? BrandColors.helper : theme.tabIconDefault }]}>
              <TextInput
                style={[styles.countInput, { color: theme.text }]}
                placeholder="0"
                placeholderTextColor={theme.tabIconDefault}
                keyboardType="number-pad"
                value={etcCount}
                onChangeText={setEtcCount}
                maxLength={5}
              />
              <ThemedText style={[styles.countUnit, { color: theme.tabIconDefault }]}>건</ThemedText>
            </View>
          </View>
        </View>
      </Card>

      <Card style={styles.inputCard}>
        <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
          특이사항 (선택)
        </ThemedText>
        <ThemedText style={[styles.inputHint, { color: theme.tabIconDefault }]}>
          배송 결과, 특이사항 등을 자유롭게 기록해주세요.
        </ThemedText>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: theme.tabIconDefault,
            },
          ]}
          placeholder="예: 특이사항 없음. 일부 박스 파손 발견됨..."
          placeholderTextColor={theme.tabIconDefault}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          value={closingText}
          onChangeText={setClosingText}
          maxLength={2000}
        />
        <View style={styles.charCount}>
          <ThemedText style={[styles.charCountText, { color: theme.tabIconDefault }]}>
            {closingText.length}/2000자
          </ThemedText>
        </View>
      </Card>

      {/* 추가비용 (선택) */}
      <Card style={styles.inputCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ThemedText style={[styles.inputLabel, { color: theme.text, marginBottom: 0 }]}>
                추가비용 (선택)
              </ThemedText>
              <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 }}>
                <ThemedText style={{ fontSize: 9, fontWeight: '600', color: '#92400E' }}>VAT별도</ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.inputHint, { color: theme.tabIconDefault }]}>
              공급가액(VAT별도)으로 입력. 부가세 10%는 자동 계산됩니다.
            </ThemedText>
          </View>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: BrandColors.helper,
            }}
            onPress={addExtraCost}
          >
            <Icon name="add-outline" size={16} color={BrandColors.helper} />
            <ThemedText style={{ color: BrandColors.helper, fontSize: 13, marginLeft: 4, fontWeight: '600' }}>추가</ThemedText>
          </Pressable>
        </View>

        {extraCosts.length === 0 ? (
          <ThemedText style={{ color: theme.tabIconDefault, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
            추가비용이 없습니다
          </ThemedText>
        ) : (
          extraCosts.map((cost, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={[styles.countInputWrapper, { backgroundColor: theme.backgroundDefault, borderColor: theme.tabIconDefault, flex: 1 }]}>
                <TextInput
                  style={[styles.countInput, { color: theme.text, flex: 1 }]}
                  value={cost.code}
                  onChangeText={(v) => updateExtraCost(index, 'code', v)}
                  placeholder="항목명"
                  placeholderTextColor={theme.tabIconDefault}
                />
              </View>
              <View style={[styles.countInputWrapper, { backgroundColor: theme.backgroundDefault, borderColor: theme.tabIconDefault, flex: 1 }]}>
                <TextInput
                  style={[styles.countInput, { color: theme.text, flex: 1 }]}
                  value={cost.amount ? String(cost.amount) : ''}
                  onChangeText={(v) => updateExtraCost(index, 'amount', v)}
                  keyboardType="number-pad"
                  placeholder="금액"
                  placeholderTextColor={theme.tabIconDefault}
                />
                <ThemedText style={[styles.countUnit, { color: theme.tabIconDefault }]}>원</ThemedText>
              </View>
              <Pressable onPress={() => removeExtraCost(index)} style={{ padding: 4 }}>
                <Icon name="close-circle-outline" size={22} color={BrandColors.error} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      {/* 예상 정산금액 미리보기 */}
      {(parseInt(deliveredCount) > 0 || parseInt(returnedCount) > 0) && (
        <Card style={[styles.inputCard, { backgroundColor: theme.backgroundSecondary || '#F8F9FA' }]}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
            예상 정산금액
          </ThemedText>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <ThemedText style={{ color: theme.tabIconDefault, fontSize: 13 }}>
                배송+반품 ({parseInt(deliveredCount) || 0}+{parseInt(returnedCount) || 0}) × {(orderDetail?.pricePerUnit || 0).toLocaleString()}원
              </ThemedText>
              <ThemedText style={{ color: theme.text, fontSize: 13 }}>
                {(((parseInt(deliveredCount) || 0) + (parseInt(returnedCount) || 0)) * (orderDetail?.pricePerUnit || 0)).toLocaleString()}원
              </ThemedText>
            </View>
            {(parseInt(etcCount) || 0) > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <ThemedText style={{ color: theme.tabIconDefault, fontSize: 13 }}>
                  기타 ({parseInt(etcCount) || 0}) × {etcPricePerUnit.toLocaleString()}원
                </ThemedText>
                <ThemedText style={{ color: theme.text, fontSize: 13 }}>
                  {((parseInt(etcCount) || 0) * etcPricePerUnit).toLocaleString()}원
                </ThemedText>
              </View>
            )}
            {extraCosts.filter(c => c.amount > 0).length > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <ThemedText style={{ color: theme.tabIconDefault, fontSize: 13 }}>추가비용</ThemedText>
                <ThemedText style={{ color: theme.text, fontSize: 13 }}>
                  {extraCosts.reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString()}원
                </ThemedText>
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.tabIconDefault + '33', paddingTop: 8, marginTop: 4 }}>
              <ThemedText style={{ color: theme.text, fontSize: 13 }}>공급가액</ThemedText>
              <ThemedText style={{ color: theme.text, fontSize: 13 }}>
                {estimatedSupply.toLocaleString()}원
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
              <ThemedText style={{ color: theme.tabIconDefault, fontSize: 13 }}>부가세 (10%)</ThemedText>
              <ThemedText style={{ color: theme.tabIconDefault, fontSize: 13 }}>
                {estimatedVat.toLocaleString()}원
              </ThemedText>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <ThemedText style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>예상 합계 (VAT 포함)</ThemedText>
              <ThemedText style={{ color: BrandColors.helper, fontSize: 17, fontWeight: '700' }}>
                {estimatedAmount.toLocaleString()}원
              </ThemedText>
            </View>
          </View>
        </Card>
      )}

      {closingFields.length > 0 && (
        <Card style={styles.inputCard}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
            추가 정보
          </ThemedText>
          <ThemedText style={[styles.inputHint, { color: theme.tabIconDefault }]}>
            관리자가 설정한 추가 입력 필드입니다.
          </ThemedText>
          {closingFields.map((field) => (
            <View key={field.id} style={styles.dynamicFieldContainer}>
              <View style={styles.dynamicFieldLabelRow}>
                <ThemedText style={[styles.dynamicFieldLabel, { color: theme.text }]}>
                  {field.fieldName}
                </ThemedText>
                {field.isRequired && (
                  <View style={[styles.requiredBadge, { backgroundColor: BrandColors.error }]}>
                    <ThemedText style={styles.requiredBadgeText}>필수</ThemedText>
                  </View>
                )}
              </View>
              {field.description && (
                <ThemedText style={[styles.inputHint, { color: theme.tabIconDefault, marginTop: 2 }]}>
                  {field.description}
                </ThemedText>
              )}
              {field.fieldType === 'textarea' ? (
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: theme.tabIconDefault,
                      minHeight: 100,
                    },
                  ]}
                  placeholder={field.placeholder || '입력해주세요'}
                  placeholderTextColor={theme.tabIconDefault}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={dynamicFieldValues[field.fieldName] || ''}
                  onChangeText={(text) => setDynamicFieldValues(prev => ({ ...prev, [field.fieldName]: text }))}
                />
              ) : (
                <View style={[styles.countInputWrapper, { backgroundColor: theme.backgroundDefault, borderColor: theme.tabIconDefault }]}>
                  <TextInput
                    style={[styles.countInput, { color: theme.text, flex: 1 }]}
                    placeholder={field.placeholder || (field.fieldType === 'number' ? '0' : '입력')}
                    placeholderTextColor={theme.tabIconDefault}
                    keyboardType={field.fieldType === 'number' ? 'number-pad' : 'default'}
                    value={dynamicFieldValues[field.fieldName] || ''}
                    onChangeText={(text) => setDynamicFieldValues(prev => ({ ...prev, [field.fieldName]: text }))}
                  />
                </View>
              )}
            </View>
          ))}
        </Card>
      )}

      <Card style={styles.imageCard}>
        <View style={styles.imageLabelRow}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
            집배송 이력 이미지 (필수)
          </ThemedText>
          <View style={[styles.requiredBadge, { backgroundColor: BrandColors.error }]}>
            <ThemedText style={styles.requiredBadgeText}>필수</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.inputHint, { color: theme.tabIconDefault }]}>
          배송완료/반품/미배송 등 이력이 표시된 화면을 캡쳐하거나 촬영해주세요.
        </ThemedText>

        <View style={styles.imageButtonRow}>
          <Pressable
            style={[styles.imageButton, { backgroundColor: BrandColors.helper }]}
            onPress={() => pickImage('DELIVERY_HISTORY', 'library')}
          >
            <Icon name="image-outline" size={18} color="#FFFFFF" />
            <ThemedText style={styles.imageButtonText}>집배송 이력 캡쳐 업로드</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.imageButton, { backgroundColor: BrandColors.helper }]}
            onPress={() => pickImage('DELIVERY_HISTORY', 'camera')}
          >
            <Icon name="camera-outline" size={18} color="#FFFFFF" />
            <ThemedText style={styles.imageButtonText}>집배송 이력 사진 촬영</ThemedText>
          </Pressable>
        </View>

        {deliveryHistoryImages.length > 0 ? (
          <View style={styles.imageGrid}>
            {deliveryHistoryImages.map((img, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri: img.uri }} style={styles.thumbnail} />
                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeImage('DELIVERY_HISTORY', index)}
                >
                  <Icon name="close-outline" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.noImagePlaceholder, { borderColor: theme.tabIconDefault }]}>
            <Icon name="document-text-outline" size={32} color={theme.tabIconDefault} />
            <ThemedText style={[styles.noImageText, { color: theme.tabIconDefault }]}>
              집배송 이력 이미지를 업로드해주세요
            </ThemedText>
          </View>
        )}
      </Card>

      <Card style={styles.imageCard}>
        <View style={styles.imageLabelRow}>
          <ThemedText style={[styles.inputLabel, { color: theme.text }]}>
            추가 참고 이미지 (선택)
          </ThemedText>
          <View style={[styles.optionalBadge, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText style={[styles.optionalBadgeText, { color: theme.tabIconDefault }]}>선택</ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.inputHint, { color: theme.tabIconDefault }]}>
          추가 증빙이 필요한 경우 업로드하세요.
        </ThemedText>

        <View style={styles.imageButtonRow}>
          <Pressable
            style={[styles.imageButtonSecondary, { borderColor: theme.tabIconDefault }]}
            onPress={() => pickImage('ETC', 'library')}
          >
            <Icon name="image-outline" size={18} color={theme.text} />
            <ThemedText style={[styles.imageButtonTextSecondary, { color: theme.text }]}>갤러리</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.imageButtonSecondary, { borderColor: theme.tabIconDefault }]}
            onPress={() => pickImage('ETC', 'camera')}
          >
            <Icon name="camera-outline" size={18} color={theme.text} />
            <ThemedText style={[styles.imageButtonTextSecondary, { color: theme.text }]}>카메라</ThemedText>
          </Pressable>
        </View>

        {etcImages.length > 0 ? (
          <View style={styles.imageGrid}>
            {etcImages.map((img, index) => (
              <View key={index} style={styles.imageContainer}>
                <Image source={{ uri: img.uri }} style={styles.thumbnail} />
                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeImage('ETC', index)}
                >
                  <Icon name="close-outline" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Pressable
        style={[
          styles.submitButton,
          {
            backgroundColor: isValid ? BrandColors.helper : theme.tabIconDefault,
            opacity: isPending ? 0.7 : 1,
          },
        ]}
        onPress={handleSubmit}
        disabled={isPending || !isValid}
      >
        {isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ThemedText style={styles.submitButtonText}>마감 제출</ThemedText>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    padding: Spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  filterLabel: {
    ...Typography.small,
    fontSize: 11,
    marginBottom: 2,
  },
  filterValue: {
    ...Typography.body,
    fontWeight: '700',
    fontSize: 16,
  },
  emptyCard: {
    padding: Spacing['3xl'],
    alignItems: 'center',
    marginTop: Spacing['4xl'],
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    ...Typography.small,
    textAlign: 'center',
  },
  orderSummary: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  orderLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  orderTitle: {
    ...Typography.h4,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  orderPeriod: {
    ...Typography.small,
  },
  warningCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  warningTitle: {
    ...Typography.body,
    fontWeight: '700',
  },
  warningText: {
    ...Typography.small,
    lineHeight: 20,
  },
  inputCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  inputHint: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  textInput: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Typography.body,
  },
  charCount: {
    alignItems: 'flex-end',
    marginTop: Spacing.xs,
  },
  charCountText: {
    ...Typography.small,
  },
  imageCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  imageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  requiredBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  requiredBadgeText: {
    ...Typography.small,
    fontWeight: '600',
    color: '#FFFFFF',
    fontSize: 10,
  },
  optionalBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  optionalBadgeText: {
    ...Typography.small,
    fontWeight: '500',
    fontSize: 10,
  },
  imageButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  imageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  imageButtonText: {
    ...Typography.small,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  imageButtonTextSecondary: {
    ...Typography.small,
    fontWeight: '500',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  imageContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImagePlaceholder: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.sm,
  },
  noImageText: {
    ...Typography.small,
    textAlign: 'center',
  },
  submitButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  countInputRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  countInputGroup: {
    flex: 1,
  },
  countLabel: {
    ...Typography.small,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  countInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  countInput: {
    flex: 1,
    ...Typography.h4,
    fontWeight: '600',
    textAlign: 'center',
  },
  countUnit: {
    ...Typography.body,
    marginLeft: Spacing.xs,
  },
  dynamicFieldContainer: {
    marginTop: Spacing.md,
  },
  dynamicFieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  dynamicFieldLabel: {
    ...Typography.body,
    fontWeight: '600',
  },
  sectionContainer: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
