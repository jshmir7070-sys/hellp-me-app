import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SettlementScreen from "@/screens/SettlementScreen";
import SettlementDetailScreen from "@/screens/SettlementDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type SettlementStackParamList = {
  Settlement: undefined;
  SettlementDetail: { date: string; orderId?: number };
};

const Stack = createNativeStackNavigator<SettlementStackParamList>();

export default function SettlementStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Settlement"
        component={SettlementScreen}
        options={{ headerTitle: "정산 내역" }}
      />
      <Stack.Screen
        name="SettlementDetail"
        component={SettlementDetailScreen}
        options={{ headerTitle: "근무 상세" }}
      />
    </Stack.Navigator>
  );
}
