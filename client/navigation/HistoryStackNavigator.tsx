import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HelperHistoryScreen from "@/screens/HelperHistoryScreen";
import RequesterHistoryScreen from "@/screens/RequesterHistoryScreen";
import IncidentReportScreen from "@/screens/IncidentReportScreen";
import WriteReviewScreen from "@/screens/WriteReviewScreen";
import RequesterDisputeScreen from "@/screens/RequesterDisputeScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";

export type HistoryStackParamList = {
  HelperHistory: undefined;
  RequesterHistory: undefined;
  IncidentReport: { orderId: number };
  OrderHistoryDetail: { orderId: number };
  WriteReview: { orderId: number };
  RequesterDispute: { orderId: number };
};

const Stack = createNativeStackNavigator<HistoryStackParamList>();

export default function HistoryStackNavigator() {
  const screenOptions = useScreenOptions();
  const { user } = useAuth();
  const isHelper = user?.role === 'helper';

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isHelper ? (
        <Stack.Screen
          name="HelperHistory"
          component={HelperHistoryScreen}
          options={{
            headerTitle: '수행 이력',
          }}
        />
      ) : (
        <>
          <Stack.Screen
            name="RequesterHistory"
            component={RequesterHistoryScreen}
            options={{
              headerTitle: '사용 이력',
            }}
          />
          <Stack.Screen
            name="IncidentReport"
            component={IncidentReportScreen}
            options={{
              headerTitle: '화물사고 신고',
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
        </>
      )}
    </Stack.Navigator>
  );
}
