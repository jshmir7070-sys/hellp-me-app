import React, { useState, useRef, useEffect } from "react";
import { 
  View, 
  ScrollView, 
  TextInput, 
  Pressable, 
  StyleSheet, 
  Alert, 
  Platform, 
  ActivityIndicator,
  Modal,
  FlatList,
  Switch,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { Icon } from "@/components/Icon";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { AddressInput } from "@/components/AddressInput";
import { WebCalendar } from "@/components/WebCalendar";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { 
  regionData, 
  courierCompanies, 
  vehicleTypes, 
  coldTruckCompanies,
  quantityOptions,
  generatePriceOptions,
  formatPhoneNumber,
} from "@/constants/regionData";

const formatDateInput = (value: string): string => {
  const numbers = value.replace(/[^\d]/g, '');
  if (numbers.length <= 4) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
  return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
};

const getTodayDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type CategoryTab = "택배사" | "기타택배" | "냉탑전용";

type CreateJobScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

interface CourierFormData {
  company: string;
  avgQuantity: string;
  unitPrice: string;
  requestDate: string;
  requestDateEnd: string;
  managerContact: string;
  vehicleType: string;
  regionLarge: string;
  regionMedium: string;
  regionSmall: string;
  campAddress: string;
  campAddressDetail: string;
  deliveryGuide: string;
  isUrgent: boolean;
  agreeToSubmit: boolean;
}

interface OtherCourierFormData {
  companyName: string;
  boxCount: string;
  unitPrice: string;
  isDayDelivery: boolean;
  isNightDelivery: boolean;
  isPerBox: boolean;
  isPerDrop: boolean;
  requestDate: string;
  requestDateEnd: string;
  vehicleType: string;
  campAddress: string;
  campAddressDetail: string;
  contact: string;
  deliveryGuide: string;
  isUrgent: boolean;
  agreeToSubmit: boolean;
  regionLarge: string;
  regionMedium: string;
  regionSmall: string;
}

interface ColdTruckFormData {
  company: string;
  hasTachometer: boolean;
  hasPartition: boolean;
  requestDate: string;
  requestDateEnd: string;
  vehicleType: string;
  contact: string;
  loadingPoint: string;
  loadingPointDetail: string;
  waypoints: string[];
  freight: string;
  recommendedFee: string;
  deliveryGuide: string;
  isUrgent: boolean;
  agreeToSubmit: boolean;
}

export default function CreateJobScreen({ navigation }: CreateJobScreenProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<CategoryTab>("택배사");
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [selectModalType, setSelectModalType] = useState<string>("");
  const [selectModalOptions, setSelectModalOptions] = useState<string[]>([]);
  const [selectModalCallback, setSelectModalCallback] = useState<((value: string) => void) | null>(null);

  const [courierForm, setCourierForm] = useState<CourierFormData>({
    company: "",
    avgQuantity: "",
    unitPrice: "",
    requestDate: "",
    requestDateEnd: "",
    managerContact: "",
    vehicleType: "",
    regionLarge: "",
    regionMedium: "",
    regionSmall: "",
    campAddress: "",
    campAddressDetail: "",
    deliveryGuide: "",
    isUrgent: false,
    agreeToSubmit: false,
  });

  const [otherCourierForm, setOtherCourierForm] = useState<OtherCourierFormData>({
    companyName: "",
    boxCount: "",
    unitPrice: "",
    isDayDelivery: false,
    isNightDelivery: false,
    isPerBox: false,
    isPerDrop: false,
    requestDate: "",
    requestDateEnd: "",
    vehicleType: "",
    campAddress: "",
    campAddressDetail: "",
    contact: "",
    deliveryGuide: "",
    isUrgent: false,
    agreeToSubmit: false,
    regionLarge: "",
    regionMedium: "",
    regionSmall: "",
  });

  const [coldTruckForm, setColdTruckForm] = useState<ColdTruckFormData>({
    company: "",
    hasTachometer: false,
    hasPartition: false,
    requestDate: "",
    requestDateEnd: "",
    vehicleType: "",
    contact: "",
    loadingPoint: "",
    loadingPointDetail: "",
    waypoints: [""],
    freight: "",
    recommendedFee: "200000",
    deliveryGuide: "",
    isUrgent: false,
    agreeToSubmit: false,
  });

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  const [datePickerTarget, setDatePickerTarget] = useState<'courier' | 'other' | 'cold'>('courier');
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    setImageUri(null);
  };

  const { data: couriers } = useQuery({
    queryKey: ['/api/meta/couriers'],
  });

  const { data: categoryPricing } = useQuery({
    queryKey: ['/api/meta/category-pricing'],
  });

  const { data: tieredPricing } = useQuery({
    queryKey: ['/api/meta/couriers', courierForm.company, 'tiered-pricing'],
    enabled: !!courierForm.company,
  });

  const getMinDeliveryFee = (courierName: string): number => {
    if (couriers && Array.isArray(couriers)) {
      const courier = couriers.find((c: any) => c.label === courierName);
      return courier?.minDeliveryFee || 1000;
    }
    return 1000;
  };

  // 택배사별 전체 정책 조회
  const getCourierPolicy = (courierName: string) => {
    if (couriers && Array.isArray(couriers)) {
      const courier = couriers.find((c: any) => c.label === courierName);
      return {
        basePricePerBox: courier?.basePricePerBox || 0,
        minTotal: courier?.minTotal || 0,
        urgentSurchargeRate: courier?.urgentSurchargeRate || 0,
        urgentCommissionRate: courier?.urgentCommissionRate || 0,
        commissionRate: courier?.commissionRate || 0,
      };
    }
    return { basePricePerBox: 0, minTotal: 0, urgentSurchargeRate: 0, urgentCommissionRate: 0, commissionRate: 0 };
  };

  // 택배사별 최저운임 총액 조회 (레거시 호환)
  const getMinTotal = (courierName: string): number => {
    return getCourierPolicy(courierName).minTotal;
  };

  // 긴급 할증 + 최저운임 적용 박스단가 계산
  const calcFinalPricePerBox = (basePricePerBox: number, boxCount: number, minTotal: number, urgentSurchargeRate: number, isUrgent: boolean) => {
    if (boxCount <= 0) {
      return { finalPricePerBox: basePricePerBox, minApplied: false, urgentApplied: false, message: null };
    }
    
    // 1. 긴급 할증 먼저 적용
    const urgentApplied = isUrgent && urgentSurchargeRate > 0;
    const baseAfterUrgent = urgentApplied 
      ? Math.ceil(basePricePerBox * (1 + urgentSurchargeRate / 100))
      : basePricePerBox;
    
    // 2. 기본 총액
    const rawTotal = baseAfterUrgent * boxCount;
    
    // 3. 최저운임 미달 시 박스단가 자동 상승
    if (minTotal > 0 && rawTotal < minTotal) {
      const requiredPerBox = Math.ceil(minTotal / boxCount);
      const finalPricePerBox = Math.max(baseAfterUrgent, requiredPerBox);
      
      let message: string;
      if (urgentApplied) {
        message = `긴급 할증(${urgentSurchargeRate}%) 및 최저운임(${minTotal.toLocaleString()}원) 적용으로 박스단가가 ${basePricePerBox.toLocaleString()}원 → ${finalPricePerBox.toLocaleString()}원으로 조정됩니다.`;
      } else {
        message = `최저운임(${minTotal.toLocaleString()}원) 적용으로 박스단가가 ${basePricePerBox.toLocaleString()}원 → ${finalPricePerBox.toLocaleString()}원으로 조정됩니다.`;
      }
      
      return { finalPricePerBox, minApplied: true, urgentApplied, message };
    }
    
    // 최저운임 적용 안됨
    let message: string | null = null;
    if (urgentApplied) {
      message = `긴급 할증(${urgentSurchargeRate}%) 적용으로 박스단가가 ${basePricePerBox.toLocaleString()}원 → ${baseAfterUrgent.toLocaleString()}원으로 조정됩니다.`;
    }
    
    return { finalPricePerBox: baseAfterUrgent, minApplied: false, urgentApplied, message };
  };

  // 택배사 목록: DB에서 가져온 목록 사용 (parcel 카테고리만, fallback: 하드코딩 리스트)
  const courierOptions = (couriers && Array.isArray(couriers) && couriers.length > 0)
    ? couriers.filter((c: any) => c.category === 'parcel').map((c: any) => c.label)
    : courierCompanies;

  const calculateAdjustedPrice = (boxCount: number, basePrice: number): number => {
    if (!tieredPricing || !Array.isArray(tieredPricing) || tieredPricing.length === 0) {
      return basePrice;
    }
    
    const tier = tieredPricing.find((t: any) => 
      boxCount >= t.minBoxCount && (!t.maxBoxCount || boxCount <= t.maxBoxCount)
    );
    
    if (!tier) return basePrice;
    
    const totalWithBase = boxCount * tier.pricePerBox;
    if (tier.minTotalVatInclusive && totalWithBase < tier.minTotalVatInclusive) {
      return tier.pricePerBox + (tier.belowMinIncrementPerBox || 100);
    }
    
    return tier.pricePerBox;
  };

  const selectedCourierMinFee = getMinDeliveryFee(courierForm.company);
  const selectedCourierMinTotal = getMinTotal(courierForm.company);
  const boxCount = parseInt(courierForm.avgQuantity) || 0;
  
  // 정책 조회 및 가격 계산
  const selectedCourierPolicy = getCourierPolicy(courierForm.company);
  const basePrice = selectedCourierPolicy.basePricePerBox || 1000;
  const selectedUnitPrice = parseInt(courierForm.unitPrice) || basePrice;
  const minTotalCalcResult = calcFinalPricePerBox(
    selectedUnitPrice, 
    boxCount, 
    selectedCourierMinTotal, 
    selectedCourierPolicy.urgentSurchargeRate,
    courierForm.isUrgent
  );
  const priceOptions = generatePriceOptions(Math.max(basePrice, 1000));

  useEffect(() => {
    if (minTotalCalcResult.minApplied && minTotalCalcResult.finalPricePerBox > 0) {
      const currentPrice = parseInt(courierForm.unitPrice) || 0;
      if (currentPrice !== minTotalCalcResult.finalPricePerBox) {
        setCourierForm(prev => ({ ...prev, unitPrice: minTotalCalcResult.finalPricePerBox.toString() }));
      }
    }
  }, [minTotalCalcResult.minApplied, minTotalCalcResult.finalPricePerBox, courierForm.avgQuantity]);

  const createJobMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const res = await apiRequest('POST', '/api/orders', orderData);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      if (data && data.id) {
        navigation.replace('CreateContract', { orderId: data.id });
      } else {
        navigation.goBack();
      }
    },
    onError: (err: Error) => {
      const message = err.message || '등록에 실패했습니다.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('오류', message);
      }
    },
  });

  const validateDates = (startDate: string, endDate: string): { valid: boolean; message?: string } => {
    if (!startDate) {
      return { valid: false, message: "시작일을 선택해주세요" };
    }
    if (!endDate) {
      return { valid: true };
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return { valid: false, message: "마감일이 시작일보다 빠를 수 없습니다" };
    }
    return { valid: true };
  };

  const showError = (message: string) => {
    if (Platform.OS === 'web') {
      alert(message);
    } else {
      Alert.alert('입력 오류', message);
    }
  };

  const handleSubmit = () => {
    let orderData: any = {};
    
    if (activeTab === "택배사") {
      if (!courierForm.company) {
        showError("택배사를 선택해주세요");
        return;
      }
      if (!courierForm.avgQuantity) {
        showError("평균수량을 선택해주세요");
        return;
      }
      if (!courierForm.unitPrice) {
        showError("단가를 선택해주세요");
        return;
      }
      if (!courierForm.requestDate) {
        showError("시작일을 선택해주세요");
        return;
      }
      if (!courierForm.vehicleType) {
        showError("차종을 선택해주세요");
        return;
      }
      if (!courierForm.regionLarge || !courierForm.regionMedium || !courierForm.regionSmall) {
        showError("배송지역을 모두 선택해주세요 (대분류/중분류/소분류)");
        return;
      }
      if (!courierForm.campAddress) {
        showError("캠프주소를 입력해주세요");
        return;
      }
      if (!courierForm.managerContact) {
        showError("담당자 연락처를 입력해주세요");
        return;
      }
      const dateValidation = validateDates(courierForm.requestDate, courierForm.requestDateEnd);
      if (!dateValidation.valid) {
        showError(dateValidation.message || "날짜 오류");
        return;
      }

      orderData = {
        companyName: courierForm.company,
        pricePerUnit: minTotalCalcResult.finalPricePerBox || parseInt(courierForm.unitPrice) || basePrice,
        averageQuantity: courierForm.avgQuantity,
        deliveryArea: `${courierForm.regionLarge} ${courierForm.regionMedium} ${courierForm.regionSmall}`.trim(),
        scheduledDate: courierForm.requestDate,
        endDate: courierForm.requestDateEnd || courierForm.requestDate,
        vehicleType: courierForm.vehicleType,
        pickupAddress: courierForm.campAddressDetail 
          ? `${courierForm.campAddress} ${courierForm.campAddressDetail}`.trim() 
          : courierForm.campAddress,
        contactInfo: courierForm.managerContact,
        description: courierForm.deliveryGuide,
        isUrgent: courierForm.isUrgent,
        category: "택배사",
      };
    } else if (activeTab === "기타택배") {
      if (!otherCourierForm.isPerBox && !otherCourierForm.isPerDrop) {
        showError("박스당 또는 착지당을 선택해주세요");
        return;
      }
      if (!otherCourierForm.boxCount) {
        showError(otherCourierForm.isPerBox ? "평균 수량(박스)을 입력해주세요" : "평균 착수(착지)를 입력해주세요");
        return;
      }
      if (!otherCourierForm.unitPrice) {
        showError("단가를 선택해주세요");
        return;
      }
      if (!otherCourierForm.requestDate) {
        showError("시작일을 선택해주세요");
        return;
      }
      if (!otherCourierForm.vehicleType) {
        showError("차종을 선택해주세요");
        return;
      }
      if (!otherCourierForm.regionLarge) {
        showError("배송지역 대분류를 선택해주세요");
        return;
      }
      if (!otherCourierForm.campAddress) {
        showError("캠프주소를 입력해주세요");
        return;
      }
      if (!otherCourierForm.contact) {
        showError("담당자 연락처를 입력해주세요");
        return;
      }
      const dateValidation = validateDates(otherCourierForm.requestDate, otherCourierForm.requestDateEnd);
      if (!dateValidation.valid) {
        showError(dateValidation.message || "날짜 오류");
        return;
      }

      const otherPricing = (categoryPricing as any)?.other || {};
      const otherDefaultPrice = otherPricing.boxPrice || 1500;
      orderData = {
        companyName: otherCourierForm.companyName || "기타택배",
        pricePerUnit: parseInt(otherCourierForm.unitPrice) || otherDefaultPrice,
        averageQuantity: otherCourierForm.boxCount,
        scheduledDate: otherCourierForm.requestDate,
        endDate: otherCourierForm.requestDateEnd || otherCourierForm.requestDate,
        vehicleType: otherCourierForm.vehicleType,
        pickupAddress: otherCourierForm.campAddressDetail 
          ? `${otherCourierForm.campAddress} ${otherCourierForm.campAddressDetail}`.trim() 
          : otherCourierForm.campAddress,
        contactInfo: otherCourierForm.contact,
        description: otherCourierForm.deliveryGuide,
        isUrgent: otherCourierForm.isUrgent,
        category: "기타택배",
        deliveryArea: `${otherCourierForm.regionLarge} ${otherCourierForm.regionMedium} ${otherCourierForm.regionSmall}`.trim(),
      };
    } else if (activeTab === "냉탑전용") {
      if (!coldTruckForm.requestDate) {
        showError("시작일을 선택해주세요");
        return;
      }
      if (!coldTruckForm.vehicleType) {
        showError("차종을 선택해주세요");
        return;
      }
      if (!coldTruckForm.loadingPoint) {
        showError("상차지를 입력해주세요");
        return;
      }
      if (!coldTruckForm.contact) {
        showError("담당자 연락처를 입력해주세요");
        return;
      }
      if (!coldTruckForm.freight) {
        showError("운임을 입력해주세요");
        return;
      }
      const dateValidation = validateDates(coldTruckForm.requestDate, coldTruckForm.requestDateEnd);
      if (!dateValidation.valid) {
        showError(dateValidation.message || "날짜 오류");
        return;
      }

      const filteredWaypoints = coldTruckForm.waypoints.filter(w => w.trim());
      const coldPricing = (categoryPricing as any)?.cold || {};
      const coldDefaultPrice = coldPricing.minDailyFee || 100000;
      orderData = {
        companyName: coldTruckForm.company || "냉탑전용",
        pricePerUnit: parseInt(coldTruckForm.recommendedFee) || coldDefaultPrice,
        averageQuantity: "1",
        scheduledDate: coldTruckForm.requestDate,
        endDate: coldTruckForm.requestDateEnd || coldTruckForm.requestDate,
        vehicleType: coldTruckForm.vehicleType,
        pickupAddress: coldTruckForm.loadingPointDetail 
          ? `${coldTruckForm.loadingPoint} ${coldTruckForm.loadingPointDetail}`.trim() 
          : coldTruckForm.loadingPoint,
        contactInfo: coldTruckForm.contact,
        description: filteredWaypoints.length > 0 
          ? `${coldTruckForm.deliveryGuide}\n경유지: ${filteredWaypoints.join(', ')}\n운임: ${coldTruckForm.freight}`
          : `${coldTruckForm.deliveryGuide}\n운임: ${coldTruckForm.freight}`,
        isUrgent: coldTruckForm.isUrgent,
        category: "냉탑전용",
        deliveryArea: "",
      };
    }

    if (imageUri) {
      (orderData as any).referenceImageUri = imageUri;
    }

    createJobMutation.mutate(orderData);
  };

  const openSelectModal = (type: string, options: string[], callback: (value: string) => void) => {
    setSelectModalType(type);
    setSelectModalOptions(options);
    setSelectModalCallback(() => callback);
    setShowSelectModal(true);
  };

  const handleSelectOption = (value: string) => {
    if (selectModalCallback) {
      selectModalCallback(value);
    }
    setShowSelectModal(false);
  };

  const addWaypoint = () => {
    if (coldTruckForm.waypoints.length < 20) {
      setColdTruckForm({
        ...coldTruckForm,
        waypoints: [...coldTruckForm.waypoints, ""]
      });
    }
  };

  const updateWaypoint = (index: number, value: string) => {
    const newWaypoints = [...coldTruckForm.waypoints];
    newWaypoints[index] = value;
    setColdTruckForm({ ...coldTruckForm, waypoints: newWaypoints });
  };

  const removeWaypoint = (index: number) => {
    if (coldTruckForm.waypoints.length > 1) {
      const newWaypoints = coldTruckForm.waypoints.filter((_, i) => i !== index);
      setColdTruckForm({ ...coldTruckForm, waypoints: newWaypoints });
    }
  };

  const renderSelectButton = (
    label: string, 
    value: string, 
    placeholder: string, 
    options: string[], 
    onSelect: (value: string) => void,
    required: boolean = false,
    testID?: string
  ) => (
    <View style={styles.section}>
      <ThemedText style={[styles.label, { color: theme.text }]}>
        {label} {required ? <ThemedText style={{ color: BrandColors.error }}>*</ThemedText> : null}
      </ThemedText>
      <Pressable
        testID={testID}
        style={[
          styles.selectButton,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
          },
        ]}
        onPress={() => openSelectModal(label, options, onSelect)}
      >
        <ThemedText style={[
          styles.selectButtonText,
          { color: value ? theme.text : Colors.light.tabIconDefault }
        ]}>
          {value || placeholder}
        </ThemedText>
        <Icon name="chevron-down-outline" size={20} color={Colors.light.tabIconDefault} />
      </Pressable>
    </View>
  );

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    required: boolean = false,
    keyboardType: 'default' | 'number-pad' | 'phone-pad' = 'default',
    testID?: string,
    maxLength?: number
  ) => (
    <View style={styles.section}>
      <ThemedText style={[styles.label, { color: theme.text }]}>
        {label} {required ? <ThemedText style={{ color: BrandColors.error }}>*</ThemedText> : null}
      </ThemedText>
      <TextInput
        testID={testID}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundDefault,
            color: theme.text,
            borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={Colors.light.tabIconDefault}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </View>
  );

  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseStringToDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date();
  };

  const openDatePicker = (mode: 'start' | 'end', target: 'courier' | 'other' | 'cold', currentValue: string) => {
    setDatePickerMode(mode);
    setDatePickerTarget(target);
    setTempDate(currentValue ? parseStringToDate(currentValue) : new Date());
    setShowDatePicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setTempDate(selectedDate);
      const dateStr = formatDateToString(selectedDate);
      if (datePickerTarget === 'courier') {
        if (datePickerMode === 'start') {
          setCourierForm({ ...courierForm, requestDate: dateStr });
        } else {
          setCourierForm({ ...courierForm, requestDateEnd: dateStr });
        }
      } else if (datePickerTarget === 'other') {
        if (datePickerMode === 'start') {
          setOtherCourierForm({ ...otherCourierForm, requestDate: dateStr });
        } else {
          setOtherCourierForm({ ...otherCourierForm, requestDateEnd: dateStr });
        }
      } else if (datePickerTarget === 'cold') {
        if (datePickerMode === 'start') {
          setColdTruckForm({ ...coldTruckForm, requestDate: dateStr });
        } else {
          setColdTruckForm({ ...coldTruckForm, requestDateEnd: dateStr });
        }
      }
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  };

  const renderDateInput = (
    label: string,
    startValue: string,
    endValue: string,
    target: 'courier' | 'other' | 'cold',
    required: boolean = false
  ) => (
    <View style={styles.section}>
      <ThemedText style={[styles.label, { color: theme.text }]}>
        {label} {required ? <ThemedText style={{ color: BrandColors.error }}>*</ThemedText> : null}
      </ThemedText>
      <View style={styles.dateRow}>
        <Pressable
          testID="input-date-start"
          style={[
            styles.dateInput,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
              justifyContent: 'center',
            },
          ]}
          onPress={() => openDatePicker('start', target, startValue)}
        >
          <View style={styles.dateButtonContent}>
            <Icon name="calendar-outline" size={18} color={startValue ? theme.text : Colors.light.tabIconDefault} />
            <ThemedText style={{ color: startValue ? theme.text : Colors.light.tabIconDefault, marginLeft: Spacing.xs }}>
              {startValue || "시작일"}
            </ThemedText>
          </View>
        </Pressable>
        <ThemedText style={{ color: theme.text, marginHorizontal: Spacing.xs }}>~</ThemedText>
        <Pressable
          testID="input-date-end"
          style={[
            styles.dateInput,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
              justifyContent: 'center',
            },
          ]}
          onPress={() => openDatePicker('end', target, endValue)}
        >
          <View style={styles.dateButtonContent}>
            <Icon name="calendar-outline" size={18} color={endValue ? theme.text : Colors.light.tabIconDefault} />
            <ThemedText style={{ color: endValue ? theme.text : Colors.light.tabIconDefault, marginLeft: Spacing.xs }}>
              {endValue || "종료일"}
            </ThemedText>
          </View>
        </Pressable>
      </View>
      <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>
        시작일 종료일 설정 (같은날짜 선택시 1일근무)
      </ThemedText>
    </View>
  );

  const renderImageUpload = () => (
    <View style={styles.section}>
      <ThemedText style={[styles.label, { color: theme.text }]}>배송지 이미지업로드</ThemedText>
      {imageUri ? (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
          <Pressable style={styles.removeImageButton} onPress={removeImage}>
            <Icon name="close-circle-outline" size={24} color={BrandColors.error} />
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[
            styles.imageUploadButton,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
            },
          ]}
          onPress={pickImage}
        >
          <Icon name="camera-outline" size={24} color={Colors.light.tabIconDefault} />
          <ThemedText style={[styles.imageUploadText, { color: Colors.light.tabIconDefault }]}>
            이미지 및 사진촬영
          </ThemedText>
        </Pressable>
      )}
    </View>
  );

  const renderUrgentCheckbox = (checked: boolean, onChange: (value: boolean) => void) => (
    <View style={[styles.urgentBox, { backgroundColor: isDark ? '#4C0519' : '#FEE2E2', borderColor: isDark ? '#9F1239' : '#FECACA' }]}>
      <Switch
        value={checked}
        onValueChange={onChange}
        trackColor={{ false: '#D1D5DB', true: BrandColors.error }}
        thumbColor={checked ? '#FFFFFF' : '#F3F4F6'}
      />
      <View style={styles.urgentTextContainer}>
        <Icon name="warning-outline" size={16} color={BrandColors.error} />
        <ThemedText style={[styles.urgentText, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
          긴급 오더로 등록 (추가 요금 발생)
        </ThemedText>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      {(["택배사", "기타택배", "냉탑전용"] as CategoryTab[]).map((tab) => (
        <Pressable
          key={tab}
          testID={`tab-${tab}`}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === tab ? BrandColors.requester : theme.backgroundDefault,
              borderColor: activeTab === tab ? BrandColors.requester : '#E0E0E0',
            },
          ]}
          onPress={() => setActiveTab(tab)}
        >
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === tab ? '#FFFFFF' : theme.text },
            ]}
          >
            {tab}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );

  const renderCourierForm = () => {
    const regionLargeOptions = Object.keys(regionData);
    const regionMediumOptions = courierForm.regionLarge ? Object.keys(regionData[courierForm.regionLarge] || {}) : [];
    const regionSmallOptions = courierForm.regionLarge && courierForm.regionMedium 
      ? (regionData[courierForm.regionLarge]?.[courierForm.regionMedium] || [])
      : [];

    const currentQuantity = parseInt(courierForm.avgQuantity) || 0;
    const currentUnitPrice = parseInt(courierForm.unitPrice) || 0;

    return (
      <>
        {renderSelectButton(
          "택배사",
          courierForm.company,
          "택배사 선택",
          courierOptions,
          (v) => {
            const policy = getCourierPolicy(v);
            const startPrice = policy.basePricePerBox || 1000;
            setCourierForm({ ...courierForm, company: v, unitPrice: startPrice.toString() });
          },
          true,
          "select-company"
        )}

        <View style={styles.row}>
          <View style={styles.halfSection}>
            {renderSelectButton(
              "평균수량",
              courierForm.avgQuantity ? `${courierForm.avgQuantity}` : "",
              "선택",
              quantityOptions.map(n => n.toString()),
              (v) => {
                setCourierForm({ ...courierForm, avgQuantity: v });
              },
              true,
              "select-quantity"
            )}
          </View>
          <View style={styles.halfSection}>
            {renderSelectButton(
              "단가 (VAT별도)",
              courierForm.unitPrice ? `${parseInt(courierForm.unitPrice).toLocaleString()}원` : "",
              "단가 선택",
              priceOptions.map(p => p.toString()),
              (v) => setCourierForm({ ...courierForm, unitPrice: v }),
              true,
              "select-unit-price"
            )}
          </View>
        </View>

        {selectedCourierMinFee > 0 && currentUnitPrice > 0 && currentUnitPrice < selectedCourierMinFee ? (
          <View style={[styles.noticeBox, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <ThemedText style={{ color: '#92400E', fontSize: 12 }}>
              최저단가({selectedCourierMinFee.toLocaleString()}원) 미만입니다. 확인해주세요.
            </ThemedText>
          </View>
        ) : null}

        {minTotalCalcResult.minApplied && currentQuantity > 0 ? (
          <View style={[styles.noticeBox, { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' }]}>
            <ThemedText style={{ color: '#1E40AF', fontSize: 12 }}>
              {minTotalCalcResult.message}
            </ThemedText>
          </View>
        ) : null}

        {currentQuantity > 0 && currentUnitPrice > 0 ? (
          <View style={[styles.priceBox, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : '#F3F4F6' }]}>
            <View style={styles.priceRow}>
              <ThemedText style={[styles.priceLabel, { color: Colors.light.tabIconDefault }]}>
                예상 합계 (VAT별도)
              </ThemedText>
              <ThemedText style={[styles.priceValue, { color: theme.text }]}>
                {(currentQuantity * minTotalCalcResult.finalPricePerBox).toLocaleString()}원
              </ThemedText>
            </View>
            <View style={styles.priceRow}>
              <ThemedText style={[styles.priceLabel, { color: Colors.light.tabIconDefault }]}>
                예상 합계 (VAT포함)
              </ThemedText>
              <ThemedText style={[styles.priceValue, { color: BrandColors.requester, fontWeight: '600' }]}>
                {Math.round(currentQuantity * minTotalCalcResult.finalPricePerBox * 1.1).toLocaleString()}원
              </ThemedText>
            </View>
            {minTotalCalcResult.minApplied ? (
              <ThemedText style={{ color: '#6B7280', fontSize: 11, marginTop: 4 }}>
                (최저운임 적용: 단가 {currentUnitPrice.toLocaleString()}원 → {minTotalCalcResult.finalPricePerBox.toLocaleString()}원)
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {renderUrgentCheckbox(courierForm.isUrgent, (v) => setCourierForm({ ...courierForm, isUrgent: v }))}

        {renderDateInput(
          "업무요청일",
          courierForm.requestDate,
          courierForm.requestDateEnd,
          'courier',
          true
        )}

        {renderInput(
          "담당자 연락처",
          courierForm.managerContact,
          (v) => setCourierForm({ ...courierForm, managerContact: formatPhoneNumber(v) }),
          "010-0000-0000",
          true,
          "phone-pad",
          "input-contact",
          13
        )}

        {renderSelectButton(
          "차종",
          courierForm.vehicleType,
          "차종 선택",
          vehicleTypes,
          (v) => setCourierForm({ ...courierForm, vehicleType: v }),
          true,
          "select-vehicle"
        )}

        <View style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            배송지역 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
          </ThemedText>
          <View style={styles.regionRow}>
            <Pressable
              testID="select-region-large"
              style={[styles.regionButton, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}
              onPress={() => openSelectModal("대분류", regionLargeOptions, (v) => setCourierForm({ ...courierForm, regionLarge: v, regionMedium: "", regionSmall: "" }))}
            >
              <ThemedText style={[styles.regionButtonText, { color: courierForm.regionLarge ? theme.text : Colors.light.tabIconDefault }]}>
                {courierForm.regionLarge || "대분류"}
              </ThemedText>
            </Pressable>
            <Pressable
              testID="select-region-medium"
              style={[styles.regionButton, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0', opacity: courierForm.regionLarge ? 1 : 0.5 }]}
              onPress={() => courierForm.regionLarge && openSelectModal("중분류", regionMediumOptions, (v) => setCourierForm({ ...courierForm, regionMedium: v, regionSmall: "" }))}
              disabled={!courierForm.regionLarge}
            >
              <ThemedText style={[styles.regionButtonText, { color: courierForm.regionMedium ? theme.text : Colors.light.tabIconDefault }]}>
                {courierForm.regionMedium || "중분류"}
              </ThemedText>
            </Pressable>
            <Pressable
              testID="select-region-small"
              style={[styles.regionButton, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0', opacity: courierForm.regionMedium ? 1 : 0.5 }]}
              onPress={() => courierForm.regionMedium && openSelectModal("소분류", regionSmallOptions, (v) => setCourierForm({ ...courierForm, regionSmall: v }))}
              disabled={!courierForm.regionMedium}
            >
              <ThemedText style={[styles.regionButtonText, { color: courierForm.regionSmall ? theme.text : Colors.light.tabIconDefault }]}>
                {courierForm.regionSmall || "소분류"}
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>
            예: 경기도 성남시 분당구
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>
            캠프 및 터미널주소 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
          </ThemedText>
          <AddressInput
            value={courierForm.campAddress}
            onChangeAddress={(v) => setCourierForm({ ...courierForm, campAddress: v })}
            placeholder="주소를 검색해주세요"
          />
        </View>

        {renderInput(
          "상세주소",
          courierForm.campAddressDetail,
          (v) => setCourierForm({ ...courierForm, campAddressDetail: v }),
          "상세 주소 입력 (선택)",
          false,
          "default",
          "input-camp-address-detail"
        )}

        {renderImageUpload()}

        <View style={styles.section}>
          <ThemedText style={[styles.label, { color: theme.text }]}>배송가이드</ThemedText>
          <TextInput
            testID="input-delivery-guide"
            style={[
              styles.textArea,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
              },
            ]}
            placeholder="배송 가이드 입력"
            placeholderTextColor={Colors.light.tabIconDefault}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={courierForm.deliveryGuide}
            onChangeText={(v) => setCourierForm({ ...courierForm, deliveryGuide: v })}
          />
        </View>

        <View style={styles.consentSection}>
          <Pressable 
            style={styles.consentRow}
            onPress={() => setCourierForm({ ...courierForm, agreeToSubmit: !courierForm.agreeToSubmit })}
          >
            <View style={[
              styles.checkbox,
              { 
                backgroundColor: courierForm.agreeToSubmit ? BrandColors.requester : 'transparent',
                borderColor: courierForm.agreeToSubmit ? BrandColors.requester : '#D1D5DB',
              }
            ]}>
              {courierForm.agreeToSubmit ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
            </View>
            <ThemedText style={[styles.consentText, { color: theme.text }]}>
              오더를 등록하시겠습니까? (동의 시 체크) <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
            </ThemedText>
          </Pressable>
        </View>
      </>
    );
  };

  const renderCheckbox = (
    checked: boolean, 
    onPress: () => void, 
    label: string
  ) => (
    <Pressable 
      style={styles.checkboxItem} 
      onPress={onPress}
    >
      <View style={[
        styles.checkbox,
        { 
          backgroundColor: checked ? BrandColors.requester : 'transparent',
          borderColor: checked ? BrandColors.requester : '#D1D5DB',
        }
      ]}>
        {checked ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
      </View>
      <ThemedText style={[styles.checkboxLabel, { color: theme.text }]}>{label}</ThemedText>
    </Pressable>
  );

  const renderOtherCourierForm = () => (
    <>
      {renderInput(
        "기타 택배 택배사/운송사 이름",
        otherCourierForm.companyName,
        (v) => setOtherCourierForm({ ...otherCourierForm, companyName: v }),
        "택배사/운송사명 입력",
        true,
        "default",
        "input-company-name"
      )}

      <View style={styles.section}>
        <View style={styles.checkboxRow}>
          {renderCheckbox(
            otherCourierForm.isDayDelivery,
            () => setOtherCourierForm({ ...otherCourierForm, isDayDelivery: !otherCourierForm.isDayDelivery }),
            "당일택배"
          )}
          {renderCheckbox(
            otherCourierForm.isNightDelivery,
            () => setOtherCourierForm({ ...otherCourierForm, isNightDelivery: !otherCourierForm.isNightDelivery }),
            "야간"
          )}
        </View>
        <View style={[styles.checkboxRow, { marginTop: Spacing.sm }]}>
          {renderCheckbox(
            otherCourierForm.isPerBox,
            () => setOtherCourierForm({ 
              ...otherCourierForm, 
              isPerBox: !otherCourierForm.isPerBox,
              isPerDrop: otherCourierForm.isPerBox ? otherCourierForm.isPerDrop : false, // 박스당 활성화 시 착지당 비활성화
              boxCount: "" // 수량 초기화
            }),
            "박스당"
          )}
          {renderCheckbox(
            otherCourierForm.isPerDrop,
            () => setOtherCourierForm({ 
              ...otherCourierForm, 
              isPerDrop: !otherCourierForm.isPerDrop,
              isPerBox: otherCourierForm.isPerDrop ? otherCourierForm.isPerBox : false, // 착지당 활성화 시 박스당 비활성화
              boxCount: "" // 수량 초기화
            }),
            "착지당"
          )}
        </View>
      </View>

      {otherCourierForm.isPerBox ? (
        // 박스당 선택 시: 10단위 스크롤 (10, 20, 30, ..., 200)
        renderSelectButton(
          "평균 수량 (박스)",
          otherCourierForm.boxCount ? otherCourierForm.boxCount : "",
          "선택",
          Array.from({length: 20}, (_, i) => ((i + 1) * 10).toString()),
          (v) => setOtherCourierForm({ ...otherCourierForm, boxCount: v }),
          true,
          "select-box-count"
        )
      ) : otherCourierForm.isPerDrop ? (
        // 착지당 선택 시: 5단위 스크롤 (5, 10, 15, ..., 100)
        renderSelectButton(
          "평균 착수 (착지)",
          otherCourierForm.boxCount ? otherCourierForm.boxCount : "",
          "선택",
          Array.from({length: 20}, (_, i) => ((i + 1) * 5).toString()),
          (v) => setOtherCourierForm({ ...otherCourierForm, boxCount: v }),
          true,
          "select-drop-count"
        )
      ) : (
        // 둘 다 선택 안 된 경우 안내
        <View style={[styles.section, { paddingVertical: Spacing.md, backgroundColor: isDark ? Colors.dark.backgroundSecondary : '#FFF7ED', borderRadius: BorderRadius.sm }]}>
          <ThemedText style={[styles.hint, { color: '#C2410C', textAlign: 'center' }]}>
            박스당 또는 착지당을 먼저 선택해주세요
          </ThemedText>
        </View>
      )}

      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.text }]}>
          단가 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
        </ThemedText>
        {otherCourierForm.isPerBox || otherCourierForm.isPerDrop ? (
          <View style={[styles.priceDisplayBox, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : '#F9FAFB' }]}>
            <ThemedText style={[styles.priceDisplayText, { color: theme.text }]}>
              {otherCourierForm.isPerBox && (
                otherCourierForm.isDayDelivery 
                  ? `당일: 박스당 ${categoryPricing?.other?.boxPrice?.toLocaleString() || '1,500'}원`
                  : otherCourierForm.isNightDelivery
                    ? `야간: 박스당 3,000원`
                    : `박스당 ${categoryPricing?.other?.boxPrice?.toLocaleString() || '1,500'}원`
              )}
              {otherCourierForm.isPerDrop && (
                otherCourierForm.isDayDelivery 
                  ? `당일: 착지당 ${categoryPricing?.other?.destinationPrice?.toLocaleString() || '1,800'}원`
                  : otherCourierForm.isNightDelivery
                    ? `야간: 착지당 4,500원`
                    : `착지당 ${categoryPricing?.other?.destinationPrice?.toLocaleString() || '1,800'}원`
              )}
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.priceDisplayBox, { backgroundColor: isDark ? Colors.dark.backgroundSecondary : '#FFF7ED', borderColor: '#F97316' }]}>
            <ThemedText style={[styles.priceDisplayText, { color: '#C2410C', textAlign: 'center' }]}>
              박스당 또는 착지당을 선택하면 단가가 표시됩니다
            </ThemedText>
          </View>
        )}
        <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>
          {otherCourierForm.isPerBox 
            ? '당일: 박스당 2,500원 / 야간: 박스당 3,000원 (관리자 설정 기준)'
            : otherCourierForm.isPerDrop
            ? '당일: 착지당 4,000원 / 야간: 착지당 4,500원 (관리자 설정 기준)'
            : '박스당 또는 착지당을 선택해주세요'}
        </ThemedText>
      </View>

      {renderUrgentCheckbox(otherCourierForm.isUrgent, (v) => setOtherCourierForm({ ...otherCourierForm, isUrgent: v }))}

      {renderDateInput(
        "업무요청일",
        otherCourierForm.requestDate,
        otherCourierForm.requestDateEnd,
        'other',
        true
      )}

      {renderSelectButton(
        "차종",
        otherCourierForm.vehicleType,
        "차종 선택",
        vehicleTypes,
        (v) => setOtherCourierForm({ ...otherCourierForm, vehicleType: v }),
        true,
        "select-vehicle-other"
      )}

      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.text }]}>
          배송지역 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
        </ThemedText>
        <View style={styles.regionRow}>
          <Pressable
            testID="select-region-large-other"
            style={[styles.regionButton, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}
            onPress={() => {
              const options = Object.keys(regionData);
              openSelectModal("대분류", options, (v) => setOtherCourierForm({ ...otherCourierForm, regionLarge: v, regionMedium: "", regionSmall: "" }));
            }}
          >
            <ThemedText style={[styles.regionButtonText, { color: otherCourierForm.regionLarge ? theme.text : Colors.light.tabIconDefault }]}>
              {otherCourierForm.regionLarge || "대분류"}
            </ThemedText>
            <Icon name="chevron-down-outline" size={16} color={Colors.light.tabIconDefault} />
          </Pressable>
          <Pressable
            testID="select-region-medium-other"
            style={[styles.regionButton, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}
            onPress={() => {
              if (!otherCourierForm.regionLarge) {
                showError("대분류를 먼저 선택해주세요");
                return;
              }
              const options = Object.keys(regionData[otherCourierForm.regionLarge] || {});
              openSelectModal("중분류", options, (v) => setOtherCourierForm({ ...otherCourierForm, regionMedium: v, regionSmall: "" }));
            }}
          >
            <ThemedText style={[styles.regionButtonText, { color: otherCourierForm.regionMedium ? theme.text : Colors.light.tabIconDefault }]}>
              {otherCourierForm.regionMedium || "중분류"}
            </ThemedText>
            <Icon name="chevron-down-outline" size={16} color={Colors.light.tabIconDefault} />
          </Pressable>
          <Pressable
            testID="select-region-small-other"
            style={[styles.regionButton, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}
            onPress={() => {
              if (!otherCourierForm.regionMedium) {
                showError("중분류를 먼저 선택해주세요");
                return;
              }
              const options = regionData[otherCourierForm.regionLarge]?.[otherCourierForm.regionMedium] || [];
              openSelectModal("소분류", options, (v) => setOtherCourierForm({ ...otherCourierForm, regionSmall: v }));
            }}
          >
            <ThemedText style={[styles.regionButtonText, { color: otherCourierForm.regionSmall ? theme.text : Colors.light.tabIconDefault }]}>
              {otherCourierForm.regionSmall || "소분류"}
            </ThemedText>
            <Icon name="chevron-down-outline" size={16} color={Colors.light.tabIconDefault} />
          </Pressable>
        </View>
      </View>

      {renderInput(
        "연락처",
        otherCourierForm.contact,
        (v) => setOtherCourierForm({ ...otherCourierForm, contact: formatPhoneNumber(v) }),
        "010-0000-0000",
        true,
        "phone-pad",
        "input-contact-other",
        13
      )}

      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.text }]}>캠프및 터미널</ThemedText>
        <AddressInput
          value={otherCourierForm.campAddress}
          onChangeAddress={(v) => setOtherCourierForm({ ...otherCourierForm, campAddress: v })}
          placeholder="주소를 검색해주세요"
        />
      </View>

      {renderInput(
        "",
        otherCourierForm.campAddressDetail,
        (v) => setOtherCourierForm({ ...otherCourierForm, campAddressDetail: v }),
        "상세주소 입력 (동/호수 등)",
        false,
        "default"
      )}

      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.text }]}>배송가이드</ThemedText>
        <TextInput
          testID="input-delivery-guide-other"
          style={[
            styles.textArea,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
            },
          ]}
          placeholder="배송 가이드 입력"
          placeholderTextColor={Colors.light.tabIconDefault}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={otherCourierForm.deliveryGuide}
          onChangeText={(v) => setOtherCourierForm({ ...otherCourierForm, deliveryGuide: v })}
        />
      </View>

      <View style={styles.consentSection}>
        <Pressable 
          style={styles.consentRow}
          onPress={() => setOtherCourierForm({ ...otherCourierForm, agreeToSubmit: !otherCourierForm.agreeToSubmit })}
        >
          <View style={[
            styles.checkbox,
            { 
              backgroundColor: otherCourierForm.agreeToSubmit ? BrandColors.requester : 'transparent',
              borderColor: otherCourierForm.agreeToSubmit ? BrandColors.requester : '#D1D5DB',
            }
          ]}>
            {otherCourierForm.agreeToSubmit ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
          </View>
          <ThemedText style={[styles.consentText, { color: theme.text }]}>
            오더를 등록하시겠습니까? (동의 시 체크) <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
          </ThemedText>
        </Pressable>
      </View>
    </>
  );

  const renderColdTruckForm = () => (
    <>
      {renderInput(
        "운송사",
        coldTruckForm.company,
        (v) => setColdTruckForm({ ...coldTruckForm, company: v }),
        "운송사 입력",
        true,
        "default",
        "input-company-cold"
      )}

      <View style={styles.section}>
        <View style={styles.checkboxRow}>
          {renderCheckbox(
            coldTruckForm.hasTachometer,
            () => setColdTruckForm({ ...coldTruckForm, hasTachometer: !coldTruckForm.hasTachometer }),
            "타코메타"
          )}
          {renderCheckbox(
            coldTruckForm.hasPartition,
            () => setColdTruckForm({ ...coldTruckForm, hasPartition: !coldTruckForm.hasPartition }),
            "칸막이"
          )}
        </View>
      </View>

      {renderDateInput(
        "업무요청일",
        coldTruckForm.requestDate,
        coldTruckForm.requestDateEnd,
        'cold',
        true
      )}

      {renderSelectButton(
        "차종",
        coldTruckForm.vehicleType,
        "차종 선택",
        vehicleTypes,
        (v) => setColdTruckForm({ ...coldTruckForm, vehicleType: v }),
        true,
        "select-vehicle-cold"
      )}

      {renderInput(
        "담당자 연락처",
        coldTruckForm.contact,
        (v) => setColdTruckForm({ ...coldTruckForm, contact: formatPhoneNumber(v) }),
        "010-0000-0000",
        true,
        "phone-pad",
        "input-contact-cold",
        13
      )}

      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.text }]}>
          상차지 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
        </ThemedText>
        <AddressInput
          value={coldTruckForm.loadingPoint}
          onChangeAddress={(v) => setColdTruckForm({ ...coldTruckForm, loadingPoint: v })}
          placeholder="주소를 검색해주세요"
        />
      </View>

      {renderInput(
        "",
        coldTruckForm.loadingPointDetail,
        (v) => setColdTruckForm({ ...coldTruckForm, loadingPointDetail: v }),
        "상세주소 입력 (동/호수 등)",
        false,
        "default"
      )}

      <View style={styles.section}>
        <View style={styles.waypointHeader}>
          <ThemedText style={[styles.label, { color: theme.text }]}>경유지</ThemedText>
          <Pressable onPress={addWaypoint} style={styles.addWaypointButtonBordered}>
            <Icon name="add-outline" size={14} color={theme.text} />
            <ThemedText style={[styles.addWaypointText, { color: theme.text }]}>추가</ThemedText>
          </Pressable>
        </View>
        {coldTruckForm.waypoints.map((waypoint, index) => (
          <View key={index} style={styles.waypointRow}>
            <TextInput
              style={[
                styles.waypointInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              placeholder={`경유지 ${index + 1}`}
              placeholderTextColor={Colors.light.tabIconDefault}
              value={waypoint}
              onChangeText={(v) => updateWaypoint(index, v)}
            />
            {coldTruckForm.waypoints.length > 1 ? (
              <Pressable onPress={() => removeWaypoint(index)} style={styles.removeWaypointButton}>
                <Icon name="close-outline" size={20} color={BrandColors.error} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <ThemedText style={[styles.hint, { color: Colors.light.tabIconDefault }]}>
          최대 20개까지 추가 가능
        </ThemedText>
      </View>

      <View style={styles.section}>
        <View style={styles.freightRow}>
          <View style={styles.freightInputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              운임 입력 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
            </ThemedText>
            <TextInput
              testID="input-freight"
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              placeholder="운임"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={coldTruckForm.freight}
              onChangeText={(v) => setColdTruckForm({ ...coldTruckForm, freight: v.replace(/[^\d]/g, '') })}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.freightInputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>추천요금</ThemedText>
            <TextInput
              testID="input-recommended-fee"
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                },
              ]}
              placeholder="200000"
              placeholderTextColor={Colors.light.tabIconDefault}
              value={coldTruckForm.recommendedFee}
              onChangeText={(v) => setColdTruckForm({ ...coldTruckForm, recommendedFee: v.replace(/[^\d]/g, '') })}
              keyboardType="number-pad"
            />
          </View>
        </View>
      </View>

      {renderUrgentCheckbox(coldTruckForm.isUrgent, (v) => setColdTruckForm({ ...coldTruckForm, isUrgent: v }))}

      <View style={styles.section}>
        <ThemedText style={[styles.label, { color: theme.text }]}>배송가이드</ThemedText>
        <TextInput
          testID="input-delivery-guide-cold"
          style={[
            styles.textArea,
            {
              backgroundColor: theme.backgroundDefault,
              color: theme.text,
              borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
            },
          ]}
          placeholder="배송 가이드 입력"
          placeholderTextColor={Colors.light.tabIconDefault}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          value={coldTruckForm.deliveryGuide}
          onChangeText={(v) => setColdTruckForm({ ...coldTruckForm, deliveryGuide: v })}
        />
      </View>

      <View style={styles.consentSection}>
        <Pressable 
          style={styles.consentRow}
          onPress={() => setColdTruckForm({ ...coldTruckForm, agreeToSubmit: !coldTruckForm.agreeToSubmit })}
        >
          <View style={[
            styles.checkbox,
            { 
              backgroundColor: coldTruckForm.agreeToSubmit ? BrandColors.requester : 'transparent',
              borderColor: coldTruckForm.agreeToSubmit ? BrandColors.requester : '#D1D5DB',
            }
          ]}>
            {coldTruckForm.agreeToSubmit ? <Icon name="checkmark-outline" size={14} color="#FFFFFF" /> : null}
          </View>
          <ThemedText style={[styles.consentText, { color: theme.text }]}>
            오더를 등록하시겠습니까? (동의 시 체크) <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
          </ThemedText>
        </Pressable>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* 단계 안내 배너 */}
      <View style={[styles.stepBanner, { backgroundColor: isDark ? '#1a365d' : '#EBF8FF', borderBottomColor: isDark ? '#2c5282' : '#BEE3F8' }]}>
        <View style={styles.stepBannerContent}>
          <View style={[styles.stepBadge, { backgroundColor: BrandColors.requester }]}>
            <ThemedText style={styles.stepBadgeText}>1/4</ThemedText>
          </View>
          <View style={styles.stepBannerTextContainer}>
            <ThemedText style={[styles.stepBannerTitle, { color: BrandColors.requester }]}>
              오더 등록
            </ThemedText>
            <ThemedText style={[styles.stepBannerSubtitle, { color: Colors.light.tabIconDefault }]}>
              등록 후 계약서 작성 → 서명 → 본인인증이 진행됩니다
            </ThemedText>
          </View>
        </View>
      </View>

      <View style={{ paddingTop: Spacing.md, paddingHorizontal: Spacing.lg }}>
        {renderTabs()}
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: tabBarHeight + 120,
          paddingHorizontal: Spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "택배사" ? renderCourierForm() : null}
        {activeTab === "기타택배" ? renderOtherCourierForm() : null}
        {activeTab === "냉탑전용" ? renderColdTruckForm() : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: tabBarHeight, backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.footerButtonRow}>
          <Pressable
            testID="button-submit"
            style={[
              styles.submitButtonHalf,
              { 
                backgroundColor: BrandColors.requester, 
                opacity: createJobMutation.isPending || 
                  (activeTab === "택배사" && !courierForm.agreeToSubmit) ||
                  (activeTab === "기타택배" && !otherCourierForm.agreeToSubmit) ||
                  (activeTab === "냉탑전용" && !coldTruckForm.agreeToSubmit) ? 0.6 : 1 
              },
            ]}
            onPress={handleSubmit}
            disabled={createJobMutation.isPending || 
              (activeTab === "택배사" && !courierForm.agreeToSubmit) ||
              (activeTab === "기타택배" && !otherCourierForm.agreeToSubmit) ||
              (activeTab === "냉탑전용" && !coldTruckForm.agreeToSubmit)}
          >
            {createJobMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={styles.submitButtonText}>요 청</ThemedText>
            )}
          </Pressable>
          <Pressable
            testID="button-cancel"
            style={[
              styles.cancelButton,
              { borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' },
            ]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>닫 기</ThemedText>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={showSelectModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSelectModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowSelectModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>{selectModalType}</ThemedText>
              <Pressable onPress={() => setShowSelectModal(false)}>
                <Icon name="close-outline" size={24} color={theme.text} />
              </Pressable>
            </View>
            <FlatList
              data={selectModalOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.modalOption, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}
                  onPress={() => handleSelectOption(item)}
                >
                  <ThemedText style={[styles.modalOptionText, { color: theme.text }]}>
                    {selectModalType === "단가 (VAT별도)" ? `${parseInt(item).toLocaleString()}원` : item}
                  </ThemedText>
                </Pressable>
              )}
              style={{ maxHeight: 400 }}
            />
          </View>
        </Pressable>
      </Modal>

      {Platform.OS === 'web' && showDatePicker ? (
        <WebCalendar
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSelect={(date) => handleDateChange(null, date)}
          selectedDate={tempDate}
          title={datePickerMode === 'start' ? '시작일 선택' : '종료일 선택'}
        />
      ) : null}

      {Platform.OS !== 'web' && showDatePicker ? (
        Platform.OS === 'ios' ? (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <Pressable 
              style={styles.datePickerOverlay} 
              onPress={() => setShowDatePicker(false)}
            >
              <View style={[styles.datePickerContainer, { backgroundColor: theme.backgroundRoot }]}>
                <View style={styles.datePickerHeader}>
                  <ThemedText style={[styles.datePickerTitle, { color: theme.text }]}>
                    {datePickerMode === 'start' ? '시작일 선택' : '종료일 선택'}
                  </ThemedText>
                  <Pressable onPress={() => setShowDatePicker(false)}>
                    <ThemedText style={{ color: BrandColors.requester, fontWeight: '600' }}>완료</ThemedText>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  locale="ko"
                />
              </View>
            </Pressable>
          </Modal>
        ) : (
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepBanner: {
    borderBottomWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  stepBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stepBannerTextContainer: {
    flex: 1,
  },
  stepBannerTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepBannerSubtitle: {
    fontSize: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    alignItems: 'center',
  },
  tabText: {
    ...Typography.small,
    fontWeight: '600',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfSection: {
    flex: 1,
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
  textArea: {
    minHeight: 100,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    ...Typography.body,
  },
  selectButton: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectButtonText: {
    ...Typography.body,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInput: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    ...Typography.body,
  },
  dateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hint: {
    ...Typography.small,
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  regionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  regionButton: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  regionButtonText: {
    ...Typography.small,
  },
  priceBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.lg,
  },
  noticeBox: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  priceLabel: {
    ...Typography.small,
  },
  priceValue: {
    ...Typography.body,
    fontWeight: '500',
  },
  urgentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  urgentTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  urgentText: {
    ...Typography.small,
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  switchLabel: {
    ...Typography.body,
  },
  waypointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  addWaypointButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addWaypointText: {
    ...Typography.small,
    fontWeight: '500',
  },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  waypointInput: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    ...Typography.body,
  },
  removeWaypointButton: {
    padding: Spacing.sm,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    height: 52,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    ...Typography.body,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    ...Typography.h4,
    fontWeight: '600',
  },
  modalOption: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalOptionText: {
    ...Typography.body,
  },
  imageUploadButton: {
    height: 100,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  imageUploadText: {
    ...Typography.small,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 2,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerContainer: {
    width: '90%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  datePickerTitle: {
    ...Typography.body,
    fontWeight: '600',
  },
  webDateInput: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    ...Typography.body,
    textAlign: 'center',
  },
  quickDateButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  quickDateButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xs,
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
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
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    ...Typography.body,
  },
  priceDisplayBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.xs,
  },
  priceDisplayText: {
    ...Typography.body,
  },
  freightRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  freightInputContainer: {
    flex: 1,
  },
  addWaypointButtonBordered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.xs,
  },
  consentSection: {
    marginBottom: Spacing.lg,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  consentText: {
    ...Typography.body,
    flex: 1,
  },
  footerButtonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  submitButtonHalf: {
    flex: 1,
    height: 52,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
  },
  cancelButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
});
