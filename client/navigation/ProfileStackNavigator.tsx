import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ProfileScreen from "@/screens/ProfileScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import PaymentSettingsScreen from "@/screens/PaymentSettingsScreen";
import SettlementHistoryScreen from "@/screens/SettlementHistoryScreen";
import SettlementDetailScreen from "@/screens/SettlementDetailScreen";
import RefundAccountScreen from "@/screens/RefundAccountScreen";
import TeamManagementScreen from "@/screens/TeamManagementScreen";
import CreateTeamScreen from "@/screens/CreateTeamScreen";
import QRCheckinScreen from "@/screens/QRCheckinScreen";
import PolicyScreen from "@/screens/PolicyScreen";
import HelpScreen from "@/screens/HelpScreen";
import SupportScreen from "@/screens/SupportScreen";
import ChangePasswordScreen from "@/screens/ChangePasswordScreen";
import WithdrawAccountScreen from "@/screens/WithdrawAccountScreen";
import HelperHistoryScreen from "@/screens/HelperHistoryScreen";
import RequesterHistoryScreen from "@/screens/RequesterHistoryScreen";
import WriteReviewScreen from "@/screens/WriteReviewScreen";
import RequesterDisputeScreen from "@/screens/RequesterDisputeScreen";
import RequesterDisputeListScreen from "@/screens/RequesterDisputeListScreen";
import RequesterDisputeDetailScreen from "@/screens/RequesterDisputeDetailScreen";
import HelperDisputeSubmitScreen from "@/screens/HelperDisputeSubmitScreen";
import HelperDisputeListScreen from "@/screens/HelperDisputeListScreen";
import BusinessRegistrationScreen from "@/screens/BusinessRegistrationScreen";
import IncidentListScreen from "@/screens/IncidentListScreen";
import IncidentReportScreen from "@/screens/IncidentReportScreen";
import RequesterIncidentDetailScreen from "@/screens/RequesterIncidentDetailScreen";
import HelperIncidentListScreen from "@/screens/HelperIncidentListScreen";
import HelperIncidentDetailScreen from "@/screens/HelperIncidentDetailScreen";
import AdminDisputeListScreen from "@/screens/AdminDisputeListScreen";
import AdminDisputeDetailScreen from "@/screens/AdminDisputeDetailScreen";
import AdminIncidentListScreen from "@/screens/AdminIncidentListScreen";
import AdminDeductionListScreen from "@/screens/AdminDeductionListScreen";
import AdminRefundListScreen from "@/screens/AdminRefundListScreen";
import AdminOrderDetailScreen from "@/screens/AdminOrderDetailScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  WithdrawAccount: undefined;
  PaymentSettings: undefined;
  SettlementHistory: undefined;
  RefundAccount: undefined;
  TeamManagement: undefined;
  CreateTeam: undefined;
  QRCheckin: undefined;
  Policy: { type: 'terms' | 'privacy' };
  Help: undefined;
  Support: undefined;
  HelperHistory: undefined;
  RequesterHistory: undefined;
  HistoryDetail: { orderId: number; settlementId?: number };
  WriteReview: { orderId: number };
  RequesterDispute: { orderId: number };
  RequesterDisputeList: undefined;
  RequesterDisputeDetail: { disputeId: number };
  HelperDisputeSubmit: undefined;
  HelperDisputeList: undefined;
  HelperDisputeDetail: { disputeId: number };
  BusinessRegistration: undefined;
  IncidentList: undefined;
  IncidentReport: { orderId: number };
  IncidentDetail: { incidentId: number };
  HelperIncidentList: undefined;
  HelperIncidentDetail: { incidentId: number };
  AdminDisputeList: undefined;
  AdminDisputeDetail: { disputeId: number };
  AdminIncidentList: undefined;
  AdminIncidentDetail: { incidentId: number };
  AdminDeductionList: undefined;
  AdminRefundList: undefined;
  AdminOrderDetail: { orderId: number };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: () => <HeaderTitle size="small" />,
          headerLeft: () => null, // Toss-style: no back button on main tab
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerTitle: "설정", // Text title for nested screen
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerTitle: "프로필 수정", // Text title for nested screen
        }}
      />
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          headerTitle: '비밀번호 변경',
        }}
      />
      <Stack.Screen
        name="WithdrawAccount"
        component={WithdrawAccountScreen}
        options={{
          headerTitle: '회원탈퇴',
        }}
      />
      <Stack.Screen
        name="PaymentSettings"
        component={PaymentSettingsScreen}
        options={{
          headerTitle: "정산 계좌", // Text title for nested screen
        }}
      />
      <Stack.Screen
        name="SettlementHistory"
        component={SettlementHistoryScreen}
        options={{
          headerTitle: "정산 내역", // Text title for nested screen
        }}
      />
      <Stack.Screen
        name="RefundAccount"
        component={RefundAccountScreen}
        options={{
          headerTitle: "환불 계좌", // Text title for nested screen
        }}
      />
      <Stack.Screen
        name="TeamManagement"
        component={TeamManagementScreen}
        options={{
          headerTitle: "팀 관리", // Text title for nested screen
        }}
      />
      <Stack.Screen
        name="CreateTeam"
        component={CreateTeamScreen}
        options={{
          headerTitle: "팀 생성", // Text title for nested screen
        }}
      />
      <Stack.Screen
        name="QRCheckin"
        component={QRCheckinScreen}
        options={{
          headerTitle: "QR 체크인", // Text title for nested screen
        }}
      />
      <Stack.Screen
        name="Policy"
        component={PolicyScreen}
        options={({ route }) => ({
          headerTitle: route.params?.type === 'terms' ? '이용약관' : '개인정보 처리방침',
        })}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{
          headerTitle: '사용 가이드',
        }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{
          headerTitle: '자주 묻는 질문',
        }}
      />
      <Stack.Screen
        name="HelperHistory"
        component={HelperHistoryScreen}
        options={{
          headerTitle: '수행 이력',
        }}
      />
      <Stack.Screen
        name="RequesterHistory"
        component={RequesterHistoryScreen}
        options={{
          headerTitle: '사용 이력',
        }}
      />
      <Stack.Screen
        name="HistoryDetail"
        component={SettlementDetailScreen as any}
        options={{
          headerTitle: '상세 정보',
        }}
      />
      <Stack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
        options={{
          headerTitle: '리뷰 작성',
        }}
      />
      <Stack.Screen
        name="RequesterDispute"
        component={RequesterDisputeScreen}
        options={{
          headerTitle: '이의제기',
        }}
      />
      <Stack.Screen
        name="RequesterDisputeList"
        component={RequesterDisputeListScreen}
        options={{
          headerTitle: '이의제기 내역',
        }}
      />
      <Stack.Screen
        name="RequesterDisputeDetail"
        component={RequesterDisputeDetailScreen}
        options={{
          headerTitle: '이의제기 상세',
        }}
      />
      <Stack.Screen
        name="HelperDisputeSubmit"
        component={HelperDisputeSubmitScreen}
        options={{
          headerTitle: '이의제기 접수',
        }}
      />
      <Stack.Screen
        name="HelperDisputeList"
        component={HelperDisputeListScreen}
        options={{
          headerTitle: '이의제기 내역',
        }}
      />
      <Stack.Screen
        name="BusinessRegistration"
        component={BusinessRegistrationScreen}
        options={{
          headerTitle: '사업자정보 등록',
        }}
      />
      <Stack.Screen
        name="IncidentList"
        component={IncidentListScreen}
        options={{
          headerTitle: '사고 내역',
        }}
      />
      <Stack.Screen
        name="IncidentReport"
        component={IncidentReportScreen}
        options={{
          headerTitle: '사고 신고',
        }}
      />
      <Stack.Screen
        name="IncidentDetail"
        component={RequesterIncidentDetailScreen}
        options={{
          headerTitle: '사고 상세',
        }}
      />
      <Stack.Screen
        name="HelperIncidentList"
        component={HelperIncidentListScreen}
        options={{
          headerTitle: '사고 내역',
        }}
      />
      <Stack.Screen
        name="HelperIncidentDetail"
        component={HelperIncidentDetailScreen}
        options={{
          headerTitle: '사고 상세',
        }}
      />
      <Stack.Screen
        name="AdminDisputeList"
        component={AdminDisputeListScreen}
        options={{
          headerTitle: '이의제기 관리',
        }}
      />
      <Stack.Screen
        name="AdminDisputeDetail"
        component={AdminDisputeDetailScreen}
        options={{
          headerTitle: '이의제기 상세',
        }}
      />
      <Stack.Screen
        name="AdminIncidentList"
        component={AdminIncidentListScreen}
        options={{
          headerTitle: '화물사고접수',
        }}
      />
      <Stack.Screen
        name="AdminDeductionList"
        component={AdminDeductionListScreen}
        options={{
          headerTitle: '화물사고차감',
        }}
      />
      <Stack.Screen
        name="AdminRefundList"
        component={AdminRefundListScreen}
        options={{
          headerTitle: '화물사고환불',
        }}
      />
      <Stack.Screen
        name="AdminOrderDetail"
        component={AdminOrderDetailScreen}
        options={{
          headerTitle: '오더 상세',
        }}
      />
    </Stack.Navigator>
  );
}
