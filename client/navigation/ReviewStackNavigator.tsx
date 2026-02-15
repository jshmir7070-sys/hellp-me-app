import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ReviewListScreen from "@/screens/ReviewListScreen";
import RequesterHistoryScreen from "@/screens/RequesterHistoryScreen";
import WriteReviewScreen from "@/screens/WriteReviewScreen";
import RequesterDisputeScreen from "@/screens/RequesterDisputeScreen";
import RequesterDisputeListScreen from "@/screens/RequesterDisputeListScreen";
import RequesterDisputeDetailScreen from "@/screens/RequesterDisputeDetailScreen";
import IncidentReportScreen from "@/screens/IncidentReportScreen";
import IncidentListScreen from "@/screens/IncidentListScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ReviewStackParamList = {
  ReviewList: undefined;
  RequesterHistory: undefined;
  WriteReview: { orderId: number };
  RequesterDispute: { orderId: number };
  RequesterDisputeList: undefined;
  RequesterDisputeDetail: { disputeId: number };
  IncidentReport: { orderId: number };
  IncidentList: undefined;
};

const Stack = createNativeStackNavigator<ReviewStackParamList>();

export default function ReviewStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ReviewList"
        component={ReviewListScreen}
        options={{ headerTitle: "리뷰 & 이력" }}
      />
      <Stack.Screen
        name="RequesterHistory"
        component={RequesterHistoryScreen}
        options={{ headerTitle: "사용 이력" }}
      />
      <Stack.Screen
        name="WriteReview"
        component={WriteReviewScreen}
        options={{ headerTitle: "리뷰 작성" }}
      />
      <Stack.Screen
        name="RequesterDispute"
        component={RequesterDisputeScreen}
        options={{ headerTitle: "이의제기" }}
      />
      <Stack.Screen
        name="RequesterDisputeList"
        component={RequesterDisputeListScreen}
        options={{ headerTitle: "이의제기 내역" }}
      />
      <Stack.Screen
        name="RequesterDisputeDetail"
        component={RequesterDisputeDetailScreen}
        options={{ headerTitle: "이의제기 상세" }}
      />
      <Stack.Screen
        name="IncidentReport"
        component={IncidentReportScreen}
        options={{ headerTitle: "사고 접수" }}
      />
      <Stack.Screen
        name="IncidentList"
        component={IncidentListScreen}
        options={{ headerTitle: "사고 내역" }}
      />
    </Stack.Navigator>
  );
}
