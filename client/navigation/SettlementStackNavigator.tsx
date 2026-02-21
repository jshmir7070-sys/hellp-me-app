import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SettlementScreen from "@/screens/SettlementScreen";
import SettlementCalendarScreen from "@/screens/SettlementCalendarScreen";
import SettlementDetailScreen from "@/screens/SettlementDetailScreen";
import HelperDisputeListScreen from "@/screens/HelperDisputeListScreen";
import HelperDisputeDetailScreen from "@/screens/HelperDisputeDetailScreen";
import HelperDisputeSubmitScreen from "@/screens/HelperDisputeSubmitScreen";
import HelperIncidentListScreen from "@/screens/HelperIncidentListScreen";
import HelperIncidentDetailScreen from "@/screens/HelperIncidentDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type SettlementStackParamList = {
  Settlement: undefined;
  SettlementCalendar: undefined;
  SettlementDetail: { date: string; orderId?: number };
  HelperDisputeList: undefined;
  HelperDisputeDetail: { disputeId: number };
  HelperDisputeSubmit: { orderId?: number; workDate?: string; orderTitle?: string } | undefined;
  HelperIncidentList: { orderId?: number } | undefined;
  HelperIncidentDetail: { incidentId: number };
};

const Stack = createNativeStackNavigator<SettlementStackParamList>();

export default function SettlementStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Settlement"
        component={SettlementScreen}
        options={{ headerTitle: "정산" }}
      />
      <Stack.Screen
        name="SettlementCalendar"
        component={SettlementCalendarScreen}
        options={{ headerTitle: "정산 내역" }}
      />
      <Stack.Screen
        name="SettlementDetail"
        component={SettlementDetailScreen}
        options={{ headerTitle: "근무 상세" }}
      />
      <Stack.Screen
        name="HelperDisputeList"
        component={HelperDisputeListScreen}
        options={{ headerTitle: "이의제기 내역" }}
      />
      <Stack.Screen
        name="HelperDisputeDetail"
        component={HelperDisputeDetailScreen}
        options={{ headerTitle: "이의제기 상세" }}
      />
      <Stack.Screen
        name="HelperDisputeSubmit"
        component={HelperDisputeSubmitScreen}
        options={{ headerTitle: "이의제기 접수" }}
      />
      <Stack.Screen
        name="HelperIncidentList"
        component={HelperIncidentListScreen}
        options={{ headerTitle: "화물사고 내역" }}
      />
      <Stack.Screen
        name="HelperIncidentDetail"
        component={HelperIncidentDetailScreen}
        options={{ headerTitle: "화물사고 상세" }}
      />
    </Stack.Navigator>
  );
}
