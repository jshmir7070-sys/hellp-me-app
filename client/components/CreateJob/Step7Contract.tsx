import React, { useState, useRef } from "react";
import { View, Pressable, StyleSheet, ScrollView, Alert, Modal, TextInput, Platform, KeyboardAvoidingView } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Icon } from "@/components/Icon";
import { Colors, Spacing, BorderRadius, Typography, BrandColors } from "@/constants/theme";
import { Step7Props } from "./types";
import { useAuth } from "@/contexts/AuthContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import { WebCalendar } from "@/components/WebCalendar";

export default function Step7Contract({
  activeTab,
  courierForm,
  otherCourierForm,
  coldTruckForm,
  onNext,
  onBack,
  onSubmit,
  isSubmitting,
  theme,
  isDark,
  bottomPadding,
  contractSettings,
}: Step7Props) {
  const depositRate = contractSettings?.depositRate ?? 10;
  const { user } = useAuth();
  const [hasReadContract, setHasReadContract] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [verificationPhone, setVerificationPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [agreePayment, setAgreePayment] = useState(false);
  const [agreeCredit, setAgreeCredit] = useState(false);
  const [agreePrivate, setAgreePrivate] = useState(false);
  const [agreePaymentDate, setAgreePaymentDate] = useState(false);
  const [paymentDueDate, setPaymentDueDate] = useState<string>("");
  const [showPaymentDatePicker, setShowPaymentDatePicker] = useState(false);

  const getCompanyName = () => {
    if (activeTab === "택배사") return courierForm.company;
    if (activeTab === "기타택배") return otherCourierForm.companyName;
    return coldTruckForm.company;
  };

  const getDeliveryArea = () => {
    if (activeTab === "택배사") {
      const parts = [courierForm.regionLarge, courierForm.regionMedium, courierForm.regionSmall].filter(Boolean);
      return parts.join(' ');
    }
    if (activeTab === "기타택배") {
      const parts = [otherCourierForm.regionLarge, otherCourierForm.regionMedium, otherCourierForm.regionSmall].filter(Boolean);
      return parts.join(' ');
    }
    return coldTruckForm.loadingPoint;
  };

  const getVehicleType = () => {
    if (activeTab === "택배사") return courierForm.vehicleType;
    if (activeTab === "기타택배") return otherCourierForm.vehicleType;
    return coldTruckForm.vehicleType;
  };

  const getSchedule = () => {
    if (activeTab === "택배사") return `${courierForm.requestDate} ~ ${courierForm.requestDateEnd}`;
    if (activeTab === "기타택배") return `${otherCourierForm.requestDate} ~ ${otherCourierForm.requestDateEnd}`;
    return `${coldTruckForm.requestDate} ~ ${coldTruckForm.requestDateEnd}`;
  };

  const getTodayFormatted = () => {
    const today = new Date();
    return `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  };

  const handleOpenContract = () => {
    setShowContractModal(true);
  };

  const handleConfirmContract = () => {
    if (!agreePayment || !agreeCredit || !agreePrivate || !agreePaymentDate) {
      Alert.alert("알림", "계약서 내 필수 동의사항을 모두 체크해주세요.");
      return;
    }
    if (!paymentDueDate) {
      Alert.alert("알림", "잔금 입금 예정일을 선택해주세요.");
      return;
    }
    setHasReadContract(true);
    setShowContractModal(false);
  };

  const handleSignatureComplete = () => {
    if (!signatureName.trim()) {
      Alert.alert("알림", "서명자 성명을 입력해주세요.");
      return;
    }
    setSignatureData(signatureName.trim());
    setShowSignature(false);
  };

  const handleOpenVerification = () => {
    setShowVerificationModal(true);
    setCodeSent(false);
    setVerificationCode("");
  };

  const handleSendCode = () => {
    if (!verificationPhone.trim() || verificationPhone.replace(/[^0-9]/g, '').length < 10) {
      Alert.alert("알림", "올바른 전화번호를 입력해주세요.");
      return;
    }
    setCodeSent(true);
    Alert.alert("인증번호 발송", `${verificationPhone}로 인증번호가 발송되었습니다.\n\n(테스트 인증번호: 123456)`);
  };

  const handleVerifyCode = () => {
    if (verificationCode === "123456") {
      setIsVerified(true);
      setShowVerificationModal(false);
      Alert.alert("인증 완료", "본인인증이 완료되었습니다.");
    } else {
      Alert.alert("인증 실패", "인증번호가 일치하지 않습니다.\n(테스트 인증번호: 123456)");
    }
  };

  const formatPhone = (value: string): string => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleNext = () => {
    if (!hasReadContract) {
      Alert.alert("알림", "계약서를 확인하고 동의사항을 체크해주세요.");
      return;
    }
    if (!signatureData) {
      Alert.alert("알림", "서명을 완료해주세요.");
      return;
    }
    if (!isVerified) {
      Alert.alert("알림", "본인인증을 완료해주세요.");
      return;
    }
    onSubmit({
      balancePaymentDueDate: paymentDueDate,
      signatureName: signatureData || "",
      verificationPhone: verificationPhone,
    });
  };

  const allAgreedInContract = agreePayment && agreeCredit && agreePrivate && agreePaymentDate && !!paymentDueDate;
  const isAllComplete = hasReadContract && !!signatureData && isVerified;

  const getQuantityInfo = () => {
    if (activeTab === "택배사") return courierForm.avgQuantity ? `평균 ${courierForm.avgQuantity}건` : "-";
    if (activeTab === "기타택배") return otherCourierForm.boxCount ? `평균 ${otherCourierForm.boxCount}박스` : "-";
    return coldTruckForm.freight ? `운임 ${parseInt(coldTruckForm.freight).toLocaleString()}원` : "-";
  };

  const formatDateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseStringToDate = (str: string): Date => {
    const parts = str.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date();
  };

  const getDefaultPaymentDueDate = (): Date => {
    // 운송 종료일 + 7일을 기본 잔금 입금 예정일로 설정
    let endDateStr = "";
    if (activeTab === "택배사") endDateStr = courierForm.requestDateEnd;
    else if (activeTab === "기타택배") endDateStr = otherCourierForm.requestDateEnd;
    else endDateStr = coldTruckForm.requestDateEnd;

    if (endDateStr) {
      const endDate = parseStringToDate(endDateStr);
      endDate.setDate(endDate.getDate() + 7);
      return endDate;
    }
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d;
  };

  const handlePaymentDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPaymentDatePicker(false);
    }
    if (selectedDate) {
      setPaymentDueDate(formatDateToString(selectedDate));
      if (Platform.OS === 'ios') {
        setShowPaymentDatePicker(false);
      }
    }
  };

  const renderContractContent = () => (
    <ScrollView style={styles.contractScroll}>
      <ThemedText style={[styles.contractTitle, { color: theme.text }]}>
        운송주선 계약서
      </ThemedText>

      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        본 계약은 「화물자동차 운수사업법」 및 관련 법령에 따라 아래 당사자 간에 운송주선에 관한 사항을 정하기 위하여 체결합니다. 본 플랫폼은 운송 주선 중개 서비스를 제공하며, "갑"과 운송인(헬퍼) 간의 운송 계약은 개인 간 거래로서 플랫폼은 거래의 당사자가 아님을 확인합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제1조 (계약 당사자 및 플랫폼의 지위)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 위탁자(이하 "갑"): {user?.name || user?.username || "(요청자)"}{"\n"}
        2. 플랫폼 운영자(이하 "을"): 헬프미 주식회사{"\n"}
        3. 운송사: {getCompanyName() || "(미정)"}{"\n"}
        4. "을"은 "갑"과 운송인(헬퍼) 간 운송 거래를 중개하는 플랫폼 운영자로서, 운송 용역의 직접적인 당사자가 아닙니다.{"\n"}
        5. "갑"과 운송인(헬퍼) 간의 운송 계약은 개인 간 거래이며, 운송 용역의 이행에 관한 권리·의무는 "갑"과 운송인(헬퍼) 사이에 직접 발생합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제2조 (계약 목적)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        "을"은 "갑"의 의뢰에 따라 적합한 운송인(헬퍼)을 매칭하여 화물 운송을 주선하며, "갑"은 이에 대한 대가를 지급합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제3조 (운송 내용)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 운송 구간: {getDeliveryArea() || "-"}{"\n"}
        2. 차량 종류: {getVehicleType() || "-"}{"\n"}
        3. 운송 기간: {getSchedule()}{"\n"}
        4. 운송 유형: {activeTab}{"\n"}
        5. 예상 물량: {getQuantityInfo()} (본 수량은 평균 예상치이며, 확정 수량이 아닙니다)
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제4조 (운임 산정 및 대금 지급)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 오더 등록 시 기재되는 수량은 평균 예상치로서, 실제 운송 수량과 차이가 발생할 수 있습니다.{"\n"}
        2. "갑"은 오더 등록 시 예상 운임의 {depositRate}%를 계약금으로 선납합니다.{"\n"}
        3. 최종 운임은 운송인(헬퍼)이 업무 종료 후 제출하는 마감 자료(실제 배송 수량, 배송 완료 건수 등)를 기준으로 확정합니다.{"\n"}
        4. 잔여금(최종 운임 - 계약금)은 마감 자료 확정 후 정산일에 청구되며, "갑"은 청구일로부터 7일 이내에 지급하여야 합니다.{"\n"}
        5. 마감 자료에 이의가 있는 경우, "갑"은 자료 수신일로부터 3영업일 이내에 서면으로 이의를 제기하여야 하며, 기한 내 이의가 없는 경우 마감 자료를 승인한 것으로 간주합니다.{"\n"}
        6. 긴급 오더의 경우 추가 할증이 적용될 수 있습니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제5조 (잔여금 미지급 및 신용거래)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. "갑"이 정산일로부터 7일 이내에 잔여금을 지급하지 않을 경우, 지연일수에 대하여 연 12%의 지연이자가 발생합니다.{"\n"}
        2. 잔여금 미지급이 14일 이상 지속될 경우, "을"은 "갑"의 서비스 이용을 제한(오더 등록 정지, 계정 이용 제한)할 수 있습니다.{"\n"}
        3. 잔여금 미지급이 30일 이상 지속될 경우, "을"은 법적 절차(지급명령 신청, 민사소송 등)를 진행할 수 있으며, 이에 따른 법적 비용(소송비용, 변호사 비용 등)은 "갑"이 부담합니다.{"\n"}
        4. "갑"은 본 계약 체결 시 잔여금 정산이 신용거래임을 인지하고, 미지급 시 상기 불이익이 발생할 수 있음에 동의합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제6조 (갑의 의무)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. "갑"은 정확한 화물 정보 및 배송지 정보를 제공하여야 합니다.{"\n"}
        2. "갑"은 합의된 일정에 따라 상·하차에 협조하여야 합니다.{"\n"}
        3. "갑"은 위험물, 불법 화물을 의뢰할 수 없습니다.{"\n"}
        4. "갑"은 마감 자료 확인 후 잔여금을 기한 내에 성실히 지급하여야 합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제7조 (을의 의무)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. "을"은 적합한 운송인(헬퍼)을 매칭하기 위해 최선을 다하여야 합니다.{"\n"}
        2. "을"은 플랫폼의 안정적 운영 및 거래 정보의 정확한 전달을 위해 노력합니다.{"\n"}
        3. "을"은 운송 용역의 직접적인 이행 주체가 아니므로, 운송 과정에서 발생하는 사고·지연·품질 문제에 대하여 직접적인 책임을 부담하지 않습니다. 다만, "을"의 중개 과실이 있는 경우에는 그 범위 내에서 책임을 부담합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제8조 (계약 해지 및 취소)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 매칭 완료 전(운송인 배정 전) 취소 시: 계약금 전액(100%)이 환불됩니다.{"\n"}
        2. 매칭 완료 후(운송인 연락처 전달 후) 취소 시: 계약금은 환불되지 않습니다(환불율 0%). 이는 운송인(헬퍼)이 이미 업무를 준비하였으므로, 개인 간 거래의 특성상 취소에 따른 운송인의 손해를 보전하기 위함입니다.{"\n"}
        3. "갑"의 귀책 사유로 인한 취소 시, "을"은 운송인(헬퍼)에게 이미 발생한 비용을 정산할 수 있습니다.{"\n"}
        4. 천재지변, 법령 변경 등 불가항력적 사유로 운송이 불가능한 경우, 양 당사자는 협의하여 계약을 해지할 수 있으며, 이 경우 상호 손해배상 의무를 부담하지 않습니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제9조 (손해배상)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 운송 중 운송인(헬퍼)의 귀책 사유로 화물이 멸실·훼손된 경우, "갑"과 운송인(헬퍼) 간에 직접 손해배상을 청구·해결합니다.{"\n"}
        2. "을"은 플랫폼 중개자로서, 분쟁 해결을 위한 중재 및 지원 서비스를 제공할 수 있으나, 손해배상의 직접적인 책임 주체가 아닙니다.{"\n"}
        3. "갑"이 제공한 정보의 부정확으로 인한 손해는 "갑"이 부담합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제10조 (개인정보 처리)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 매칭 완료 시 "갑"과 운송인(헬퍼)에게 상호 연락처가 제공됩니다. 제공된 연락처는 해당 운송 건의 업무 수행 목적으로만 사용하여야 하며, 그 외 목적으로 이용하거나 제3자에게 제공할 수 없습니다.{"\n"}
        2. "을"은 「개인정보 보호법」에 따라 개인정보를 처리하며, 상세 사항은 개인정보 처리방침에 따릅니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제11조 (면책)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. "을"은 "갑"과 운송인(헬퍼) 간 개인 간 거래의 중개자로서, 운송 용역의 품질, 완전성, 적시성을 보증하지 않습니다.{"\n"}
        2. "을"의 책임은 플랫폼 운영 및 중개 서비스 범위에 한정되며, 「전자상거래 등에서의 소비자보호에 관한 법률」 제20조에 따른 통신판매중개자의 책임 범위를 따릅니다.{"\n"}
        3. "갑"은 본 거래가 개인 간 거래임을 충분히 이해하고 동의합니다.
      </ThemedText>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제12조 (잔금 입금 예정일)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. "갑"은 운송 완료 후 마감 자료 확정에 따른 잔여금을 아래 지정한 입금 예정일까지 지급하여야 합니다.{"\n"}
        2. 입금 예정일은 운송 종료 후 마감 자료 확정일로부터 기산하며, 제4조 제4항의 7일 이내 지급 의무를 준수하여야 합니다.{"\n"}
        3. 입금 예정일을 초과할 경우, 제5조의 신용거래 조항이 즉시 적용됩니다.
      </ThemedText>

      {/* 잔금 입금 예정일 달력 선택 */}
      <View style={[styles.contractDatePicker, { borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
        <ThemedText style={[styles.contractDatePickerLabel, { color: theme.text }]}>
          잔금 입금 예정일 <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
        </ThemedText>
        <Pressable
          style={[styles.contractDateButton, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: isDark ? Colors.dark.backgroundSecondary : '#D1D5DB' }]}
          onPress={() => {
            if (!paymentDueDate) {
              setPaymentDueDate(formatDateToString(getDefaultPaymentDueDate()));
            }
            setShowPaymentDatePicker(true);
          }}
        >
          <Icon name="calendar-outline" size={20} color={BrandColors.requester} />
          <ThemedText style={[styles.contractDateButtonText, { color: paymentDueDate ? theme.text : Colors.light.tabIconDefault }]}>
            {paymentDueDate || "입금 예정일을 선택해주세요"}
          </ThemedText>
        </Pressable>
      </View>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제13조 (특약사항 및 동의)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        "갑"은 본 계약의 체결과 관련하여 아래 각 호의 사항을 충분히 이해하였으며, 이에 개별적으로 동의합니다. 본 동의는 계약서의 일부를 구성하며, 동의 거부 시 계약 체결이 불가합니다.
      </ThemedText>

      {/* 필수 동의사항 체크박스 - 계약서 본문 내 */}
      <Pressable style={styles.contractConsentRow} onPress={() => setAgreePayment(!agreePayment)}>
        <View style={[styles.contractCheckbox, { backgroundColor: agreePayment ? BrandColors.requester : 'transparent', borderColor: agreePayment ? BrandColors.requester : '#D1D5DB' }]}>
          {agreePayment && <Icon name="checkmark-outline" size={14} color="#FFFFFF" />}
        </View>
        <ThemedText style={[styles.contractConsentText, { color: theme.text }]}>
          제1호: 잔여금은 마감 자료(실제 배송 수량) 기준으로 확정되며, 청구일로부터 7일 이내 지급할 것에 동의합니다. <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
        </ThemedText>
      </Pressable>

      <Pressable style={styles.contractConsentRow} onPress={() => setAgreeCredit(!agreeCredit)}>
        <View style={[styles.contractCheckbox, { backgroundColor: agreeCredit ? BrandColors.requester : 'transparent', borderColor: agreeCredit ? BrandColors.requester : '#D1D5DB' }]}>
          {agreeCredit && <Icon name="checkmark-outline" size={14} color="#FFFFFF" />}
        </View>
        <ThemedText style={[styles.contractConsentText, { color: theme.text }]}>
          제2호: 잔여금 정산은 신용거래이며, 미지급 시 연 12% 지연이자, 서비스 이용 제한 및 법적 조치(소송비용·변호사 비용 부담 포함)가 발생할 수 있음에 동의합니다. <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
        </ThemedText>
      </Pressable>

      <Pressable style={styles.contractConsentRow} onPress={() => setAgreePrivate(!agreePrivate)}>
        <View style={[styles.contractCheckbox, { backgroundColor: agreePrivate ? BrandColors.requester : 'transparent', borderColor: agreePrivate ? BrandColors.requester : '#D1D5DB' }]}>
          {agreePrivate && <Icon name="checkmark-outline" size={14} color="#FFFFFF" />}
        </View>
        <ThemedText style={[styles.contractConsentText, { color: theme.text }]}>
          제3호: 본 거래는 개인 간 거래로서 플랫폼은 통신판매중개자의 지위에 있음을 이해하며, 매칭 완료 후(운송인 연락처 전달 후) 취소 시 계약금이 환불되지 않음에 동의합니다. <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
        </ThemedText>
      </Pressable>

      <Pressable style={styles.contractConsentRow} onPress={() => setAgreePaymentDate(!agreePaymentDate)}>
        <View style={[styles.contractCheckbox, { backgroundColor: agreePaymentDate ? BrandColors.requester : 'transparent', borderColor: agreePaymentDate ? BrandColors.requester : '#D1D5DB' }]}>
          {agreePaymentDate && <Icon name="checkmark-outline" size={14} color="#FFFFFF" />}
        </View>
        <ThemedText style={[styles.contractConsentText, { color: theme.text }]}>
          제4호: 상기 지정한 잔금 입금 예정일({paymentDueDate || "미선택"})까지 잔여금을 지급할 것을 확약하며, 미이행 시 제5조의 신용거래 조항이 적용됨에 동의합니다. <ThemedText style={{ color: BrandColors.error }}>*</ThemedText>
        </ThemedText>
      </Pressable>

      <ThemedText style={[styles.contractSectionTitle, { color: theme.text }]}>
        제14조 (분쟁 해결)
      </ThemedText>
      <ThemedText style={[styles.contractText, { color: theme.text }]}>
        1. 본 계약과 관련한 분쟁은 당사자 간 협의하여 해결하며, 협의가 이루어지지 않을 경우 "을"의 본점 소재지를 관할하는 법원을 전속관할 법원으로 합니다.{"\n"}
        2. "갑"과 운송인(헬퍼) 간의 분쟁에 대하여 "을"은 중재를 지원할 수 있으나, 법적 분쟁의 당사자가 되지 않습니다.
      </ThemedText>

      <ThemedText style={[styles.contractDate, { color: theme.text }]}>
        {"\n"}계약일: {getTodayFormatted()}
      </ThemedText>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <ThemedText style={[styles.stepTitle, { color: theme.text }]}>
            7단계: 계약서 작성 · 서명 · 본인인증
          </ThemedText>
          <ThemedText style={[styles.stepDescription, { color: Colors.light.tabIconDefault }]}>
            계약서를 확인하고 서명 후 본인인증을 완료해주세요
          </ThemedText>
        </View>

        {/* 1. 계약서 확인 */}
        <View style={[styles.stepCard, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
          <View style={styles.stepCardHeader}>
            <View style={[styles.stepBadge, { backgroundColor: hasReadContract ? '#10B981' : BrandColors.requester }]}>
              {hasReadContract ? (
                <Icon name="checkmark-outline" size={16} color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.stepBadgeText}>1</ThemedText>
              )}
            </View>
            <ThemedText style={[styles.stepCardTitle, { color: theme.text }]}>
              계약서 확인
            </ThemedText>
          </View>
          <ThemedText style={[styles.stepCardDescription, { color: Colors.light.tabIconDefault }]}>
            계약서 확인, 필수 동의사항 체크, 잔금 입금일 설정
          </ThemedText>
          <Pressable
            style={[styles.actionButton, { borderColor: BrandColors.requester, backgroundColor: hasReadContract ? (isDark ? '#064E3B' : '#ECFDF5') : 'transparent' }]}
            onPress={handleOpenContract}
          >
            <Icon name={hasReadContract ? "checkmark-circle-outline" : "document-text-outline"} size={20} color={hasReadContract ? '#10B981' : BrandColors.requester} />
            <ThemedText style={[styles.actionButtonText, { color: hasReadContract ? '#10B981' : BrandColors.requester }]}>
              {hasReadContract ? "계약서 확인 완료 (다시 보기)" : "계약서 확인하기"}
            </ThemedText>
          </Pressable>
        </View>

        {/* 2. 전자 서명 */}
        <View style={[styles.stepCard, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
          <View style={styles.stepCardHeader}>
            <View style={[styles.stepBadge, { backgroundColor: signatureData ? '#10B981' : BrandColors.requester }]}>
              {signatureData ? (
                <Icon name="checkmark-outline" size={16} color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.stepBadgeText}>2</ThemedText>
              )}
            </View>
            <ThemedText style={[styles.stepCardTitle, { color: theme.text }]}>
              전자 서명
            </ThemedText>
          </View>
          <ThemedText style={[styles.stepCardDescription, { color: Colors.light.tabIconDefault }]}>
            계약서에 동의하는 서명을 해주세요
          </ThemedText>
          {signatureData ? (
            <View style={[styles.signaturePreview, { borderColor: '#10B981' }]}>
              <Icon name="checkmark-circle" size={24} color="#10B981" />
              <ThemedText style={[styles.signaturePreviewText, { color: '#10B981' }]}>
                서명 완료 ({signatureData})
              </ThemedText>
              <Pressable onPress={() => { setSignatureData(null); setSignatureName(""); }}>
                <ThemedText style={{ color: BrandColors.requester }}>다시 서명</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.actionButton, { borderColor: BrandColors.requester, opacity: hasReadContract ? 1 : 0.5 }]}
              onPress={() => { if (hasReadContract) setShowSignature(true); }}
              disabled={!hasReadContract}
            >
              <Icon name="create-outline" size={20} color={hasReadContract ? BrandColors.requester : Colors.light.tabIconDefault} />
              <ThemedText style={[styles.actionButtonText, { color: hasReadContract ? BrandColors.requester : Colors.light.tabIconDefault }]}>
                서명하기
              </ThemedText>
            </Pressable>
          )}
        </View>

        {/* 3. 본인인증 */}
        <View style={[styles.stepCard, { backgroundColor: theme.backgroundDefault, borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
          <View style={styles.stepCardHeader}>
            <View style={[styles.stepBadge, { backgroundColor: isVerified ? '#10B981' : BrandColors.requester }]}>
              {isVerified ? (
                <Icon name="checkmark-outline" size={16} color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.stepBadgeText}>3</ThemedText>
              )}
            </View>
            <ThemedText style={[styles.stepCardTitle, { color: theme.text }]}>
              본인인증
            </ThemedText>
          </View>
          <ThemedText style={[styles.stepCardDescription, { color: Colors.light.tabIconDefault }]}>
            전화번호를 입력하고 SMS 인증을 진행합니다
          </ThemedText>
          {isVerified && verificationPhone ? (
            <View style={[styles.signaturePreview, { borderColor: '#10B981' }]}>
              <Icon name="checkmark-circle" size={24} color="#10B981" />
              <ThemedText style={[styles.signaturePreviewText, { color: '#10B981' }]}>
                인증 완료 ({verificationPhone})
              </ThemedText>
            </View>
          ) : (
            <Pressable
              style={[styles.actionButton, {
                borderColor: BrandColors.requester,
                opacity: signatureData ? 1 : 0.5,
              }]}
              onPress={handleOpenVerification}
              disabled={!signatureData}
            >
              <Icon name="shield-checkmark-outline" size={20} color={signatureData ? BrandColors.requester : Colors.light.tabIconDefault} />
              <ThemedText style={[styles.actionButtonText, { color: signatureData ? BrandColors.requester : Colors.light.tabIconDefault }]}>
                본인인증 하기
              </ThemedText>
            </Pressable>
          )}
        </View>

        {isAllComplete && (
          <View style={[styles.infoBox, { backgroundColor: isDark ? '#064E3B' : '#ECFDF5' }]}>
            <Icon name="checkmark-circle" size={20} color="#10B981" />
            <ThemedText style={[styles.infoText, { color: isDark ? '#6EE7B7' : '#065F46' }]}>
              모든 절차가 완료되었습니다. "오더 제출" 버튼을 눌러주세요.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* 계약서 모달 */}
      <Modal visible={showContractModal} animationType="slide">
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={[styles.modalHeader, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>운송주선 계약서</ThemedText>
            <Pressable onPress={() => setShowContractModal(false)}>
              <Icon name="close-outline" size={28} color={theme.text} />
            </Pressable>
          </View>
          {renderContractContent()}
          <View style={[styles.modalFooter, { backgroundColor: theme.backgroundRoot, borderTopColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
            {!allAgreedInContract && (
              <ThemedText style={[styles.modalFooterHint, { color: BrandColors.error }]}>
                필수 동의사항을 모두 체크하고 입금 예정일을 선택해주세요
              </ThemedText>
            )}
            <Pressable
              style={[styles.modalButton, { backgroundColor: BrandColors.requester, opacity: allAgreedInContract ? 1 : 0.5 }]}
              onPress={handleConfirmContract}
            >
              <ThemedText style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                {hasReadContract ? "계약서 확인 완료" : "위 내용에 동의하고 계약서를 확인합니다"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 서명 모달 - 풀스크린으로 변경하여 부모 KeyboardAvoidingView 영향 제거 */}
      <Modal visible={showSignature} animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.signatureFullScreen, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.signatureHeader, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <ThemedText style={[styles.signatureTitle, { color: theme.text }]}>전자 서명</ThemedText>
              <Pressable onPress={() => setShowSignature(false)}>
                <Icon name="close-outline" size={28} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.signatureBody}>
              <ThemedText style={[styles.signatureLabel, { color: theme.text }]}>
                서명자 성명 입력
              </ThemedText>
              <ThemedText style={[styles.signatureHint, { color: Colors.light.tabIconDefault }]}>
                본인의 실명을 정확히 입력해주세요. 전자서명법에 따라 계약 당사자의 서명으로 인정됩니다.
              </ThemedText>
              <TextInput
                style={[
                  styles.signatureInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                  },
                ]}
                placeholder="성명을 입력해주세요"
                placeholderTextColor={Colors.light.tabIconDefault}
                value={signatureName}
                onChangeText={setSignatureName}
                autoFocus
              />

              <View style={[styles.signaturePreviewBox, { borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0', backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }]}>
                <ThemedText style={[styles.signaturePreviewLabel, { color: Colors.light.tabIconDefault }]}>
                  서명 미리보기
                </ThemedText>
                <ThemedText style={[styles.signatureDisplayText, { color: theme.text }]}>
                  {signatureName || " "}
                </ThemedText>
                <ThemedText style={[styles.signatureDateText, { color: Colors.light.tabIconDefault }]}>
                  {getTodayFormatted()}
                </ThemedText>
              </View>
            </View>

            <View style={{ flex: 1 }} />
            <View style={[styles.signatureFooter, { borderTopColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <Pressable
                style={[styles.signatureCancel, { borderColor: BrandColors.requester }]}
                onPress={() => setShowSignature(false)}
              >
                <ThemedText style={[styles.signatureCancelText, { color: BrandColors.requester }]}>취소</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.signatureConfirm, { backgroundColor: BrandColors.requester, opacity: signatureName.trim() ? 1 : 0.5 }]}
                onPress={handleSignatureComplete}
                disabled={!signatureName.trim()}
              >
                <ThemedText style={styles.signatureConfirmText}>서명 완료</ThemedText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 본인인증 모달 - 풀스크린으로 변경하여 부모 KeyboardAvoidingView 영향 제거 */}
      <Modal visible={showVerificationModal} animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.signatureFullScreen, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.signatureHeader, { borderBottomColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <ThemedText style={[styles.signatureTitle, { color: theme.text }]}>SMS 본인인증</ThemedText>
              <Pressable onPress={() => setShowVerificationModal(false)}>
                <Icon name="close-outline" size={28} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.signatureBody}>
              {/* 전화번호 입력 */}
              <ThemedText style={[styles.signatureLabel, { color: theme.text }]}>
                전화번호 입력
              </ThemedText>
              <ThemedText style={[styles.signatureHint, { color: Colors.light.tabIconDefault }]}>
                인증번호를 받을 전화번호를 입력해주세요.
              </ThemedText>
              <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg }}>
                <TextInput
                  style={[
                    styles.signatureInput,
                    {
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                      flex: 1,
                      marginBottom: 0,
                    },
                  ]}
                  placeholder="010-0000-0000"
                  placeholderTextColor={Colors.light.tabIconDefault}
                  value={verificationPhone}
                  onChangeText={(text) => setVerificationPhone(formatPhone(text))}
                  keyboardType="phone-pad"
                  maxLength={13}
                  editable={!codeSent}
                />
                <Pressable
                  style={[styles.sendCodeButton, { backgroundColor: codeSent ? '#10B981' : BrandColors.requester }]}
                  onPress={handleSendCode}
                  disabled={codeSent}
                >
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>
                    {codeSent ? "발송완료" : "인증요청"}
                  </ThemedText>
                </Pressable>
              </View>

              {/* 인증번호 입력 */}
              {codeSent && (
                <>
                  <ThemedText style={[styles.signatureLabel, { color: theme.text }]}>
                    인증번호 입력
                  </ThemedText>
                  <ThemedText style={[styles.signatureHint, { color: Colors.light.tabIconDefault }]}>
                    {verificationPhone}로 발송된 6자리 인증번호를 입력해주세요.
                  </ThemedText>
                  <TextInput
                    style={[
                      styles.signatureInput,
                      {
                        backgroundColor: theme.backgroundDefault,
                        color: theme.text,
                        borderColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0',
                        textAlign: 'center',
                        fontSize: 24,
                        letterSpacing: 8,
                      },
                    ]}
                    placeholder="123456"
                    placeholderTextColor={Colors.light.tabIconDefault}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                  <Pressable onPress={() => { setCodeSent(false); setVerificationCode(""); }} style={styles.resendButton}>
                    <ThemedText style={{ color: BrandColors.requester }}>
                      전화번호 변경 / 재발송
                    </ThemedText>
                  </Pressable>
                </>
              )}
            </View>

            <View style={{ flex: 1 }} />
            <View style={[styles.signatureFooter, { borderTopColor: isDark ? Colors.dark.backgroundSecondary : '#E0E0E0' }]}>
              <Pressable
                style={[styles.signatureCancel, { borderColor: BrandColors.requester }]}
                onPress={() => setShowVerificationModal(false)}
              >
                <ThemedText style={[styles.signatureCancelText, { color: BrandColors.requester }]}>취소</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.signatureConfirm, { backgroundColor: BrandColors.requester, opacity: (codeSent && verificationCode.length === 6) ? 1 : 0.5 }]}
                onPress={handleVerifyCode}
                disabled={!codeSent || verificationCode.length !== 6}
              >
                <ThemedText style={styles.signatureConfirmText}>인증 확인</ThemedText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={[styles.footer, { backgroundColor: theme.backgroundRoot }]}>
        <Pressable
          style={[styles.button, styles.buttonSecondary, { borderColor: BrandColors.requester }]}
          onPress={onBack}
          disabled={isSubmitting}
        >
          <ThemedText style={[styles.buttonText, { color: BrandColors.requester }]}>이전</ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.button,
            styles.buttonPrimary,
            { backgroundColor: BrandColors.requester, opacity: isAllComplete && !isSubmitting ? 1 : 0.6 },
          ]}
          onPress={handleNext}
          disabled={!isAllComplete || isSubmitting}
        >
          <ThemedText style={[styles.buttonText, { color: '#FFFFFF' }]}>
            {isSubmitting ? "제출 중..." : "오더 제출"}
          </ThemedText>
        </Pressable>
      </View>

      {/* 잔금 입금일 달력 - footer 뒤에 배치하여 레이아웃 영향 방지 */}
      {showPaymentDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={paymentDueDate ? parseStringToDate(paymentDueDate) : getDefaultPaymentDueDate()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={handlePaymentDateChange}
        />
      )}

      {Platform.OS === 'web' && (
        <WebCalendar
          visible={showPaymentDatePicker}
          selectedDate={paymentDueDate ? parseStringToDate(paymentDueDate) : getDefaultPaymentDueDate()}
          title="잔금 입금 예정일 선택"
          onSelect={(date) => {
            handlePaymentDateChange(null, date);
          }}
          onClose={() => setShowPaymentDatePicker(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  stepTitle: {
    ...Typography.heading2,
    marginBottom: Spacing.xs,
  },
  stepDescription: {
    ...Typography.body,
  },
  stepCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepCardTitle: {
    ...Typography.body,
    fontWeight: 'bold',
  },
  stepCardDescription: {
    ...Typography.caption,
    marginBottom: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  actionButtonText: {
    ...Typography.body,
    fontWeight: '600',
  },
  signaturePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  signaturePreviewText: {
    ...Typography.body,
    fontWeight: '600',
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.caption,
    flex: 1,
  },
  // 계약서 모달
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  modalTitle: {
    ...Typography.heading2,
  },
  contractScroll: {
    flex: 1,
    padding: Spacing.lg,
  },
  contractTitle: {
    ...Typography.heading2,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  contractSectionTitle: {
    ...Typography.body,
    fontWeight: 'bold',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  contractText: {
    ...Typography.body,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  contractDate: {
    ...Typography.body,
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  modalFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  modalButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalButtonText: {
    ...Typography.button,
    fontWeight: 'bold',
  },
  // 서명/본인인증 모달 (풀스크린)
  signatureFullScreen: {
    flex: 1,
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  signatureTitle: {
    ...Typography.heading3,
    fontWeight: 'bold',
  },
  signatureBody: {
    padding: Spacing.lg,
  },
  signatureLabel: {
    ...Typography.body,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  signatureHint: {
    ...Typography.caption,
    marginBottom: Spacing.md,
  },
  signatureInput: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  signaturePreviewBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  signaturePreviewLabel: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
  },
  signatureDisplayText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: Spacing.sm,
  },
  signatureDateText: {
    ...Typography.caption,
  },
  signatureFooter: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
  },
  signatureCancel: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  signatureCancelText: {
    ...Typography.button,
  },
  signatureConfirm: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  signatureConfirmText: {
    ...Typography.button,
    color: '#FFFFFF',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  sendCodeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contractConsentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  contractCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  contractConsentText: {
    ...Typography.caption,
    flex: 1,
    lineHeight: 20,
  },
  contractDatePicker: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  contractDatePickerLabel: {
    ...Typography.body,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  contractDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  contractDateButtonText: {
    ...Typography.body,
  },
  modalFooterHint: {
    ...Typography.caption,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  footer: {
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.light.backgroundSecondary,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: BrandColors.requester,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    ...Typography.button,
  },
});
