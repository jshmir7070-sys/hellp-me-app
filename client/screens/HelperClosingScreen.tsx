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
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { OrderCard } from "@/components/order/OrderCard";
import { adaptHelperMyOrder, type OrderCardDTO } from "@/adapters/orderCardAdapter";
import { Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/query-client";

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

export default function HelperClosingScreen({ navigation }: HelperClosingScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, refetch, isRefetching } = useQuery<any[]>({
    queryKey: ['/api/helper/my-orders'],
  });

  const inProgressOrders = React.useMemo(() => {
    return orders
      .filter(order => ['in_progress', 'scheduled'].includes(order.status?.toLowerCase() || ''))
      .map(order => adaptHelperMyOrder(order));
  }, [orders]);

  const closingSubmittedOrders = React.useMemo(() => {
    return orders
      .filter(order => order.status?.toLowerCase() === 'closing_submitted')
      .map(order => adaptHelperMyOrder(order));
  }, [orders]);

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
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
        flexGrow: 1,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.header}>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>
                업무중
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { color: BrandColors.warning }]}>
                {inProgressOrders.length}건
              </ThemedText>
            </View>
            <View style={styles.summaryItem}>
              <ThemedText style={[styles.summaryLabel, { color: theme.tabIconDefault }]}>
                마감 완료
              </ThemedText>
              <ThemedText style={[styles.summaryValue, { color: BrandColors.success }]}>
                {closingSubmittedOrders.length}건
              </ThemedText>
            </View>
          </View>
        </Card>
      </View>

      {inProgressOrders.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={[styles.statusDot, { backgroundColor: BrandColors.warning }]} />
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              업무중 (마감 대기)
            </ThemedText>
          </View>
          {inProgressOrders.map((order) => (
            <OrderCard
              key={order.orderId}
              data={order}
              context="helper_my_orders"
              onPress={() => handleCloseOrder(order)}
            />
          ))}
        </View>
      )}

      {closingSubmittedOrders.length > 0 && (
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <View style={[styles.statusDot, { backgroundColor: BrandColors.success }]} />
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              마감 (요청자 확인 대기)
            </ThemedText>
          </View>
          {closingSubmittedOrders.map((order) => (
            <OrderCard
              key={order.orderId}
              data={{ ...order, statusLabel: '마감', statusColor: BrandColors.success }}
              context="helper_my_orders"
            />
          ))}
        </View>
      )}

      {inProgressOrders.length === 0 && closingSubmittedOrders.length === 0 && (
        <Card style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: BrandColors.helperLight }]}>
            <Icon name="checkmark-circle-outline" size={32} color={BrandColors.helper} />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
            마감할 오더가 없습니다
          </ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.tabIconDefault }]}>
            진행 중인 오더가 완료되면 여기서 마감할 수 있습니다
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
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const { orderId } = route.params;

  const [closingText, setClosingText] = useState('');
  const [deliveredCount, setDeliveredCount] = useState('');
  const [returnedCount, setReturnedCount] = useState('');
  const [etcCount, setEtcCount] = useState('');
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
      }}
    >
      <Card style={styles.orderSummary}>
        <ThemedText style={[styles.orderTitle, { color: theme.text }]}>
          오더 #{orderId}
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
    padding: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
  },
  summaryLabel: {
    ...Typography.small,
    marginBottom: 4,
  },
  summaryValue: {
    ...Typography.h4,
    fontWeight: '700',
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
