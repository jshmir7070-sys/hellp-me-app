import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HelperClosingScreen, { ClosingInputScreen } from "@/screens/HelperClosingScreen";
import RequesterClosingScreen from "@/screens/RequesterClosingScreen";
import ClosingDetailScreen from "@/screens/ClosingDetailScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";

export type ClosingStackParamList = {
  HelperClosing: undefined;
  RequesterClosing: undefined;
  ClosingInput: { orderId: number };
  ClosingDetail: { orderId: number };
};

const Stack = createNativeStackNavigator<ClosingStackParamList>();

export default function ClosingStackNavigator() {
  const screenOptions = useScreenOptions();
  const { user } = useAuth();
  const isHelper = user?.role === 'helper';

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isHelper ? (
        <>
          <Stack.Screen
            name="HelperClosing"
            component={HelperClosingScreen}
            options={{
              headerTitle: '업무 마감',
            }}
          />
          <Stack.Screen
            name="ClosingInput"
            component={ClosingInputScreen}
            options={{
              headerTitle: '마감 제출',
            }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="RequesterClosing"
            component={RequesterClosingScreen}
            options={{
              headerTitle: '마감 확인',
            }}
          />
          <Stack.Screen
            name="ClosingDetail"
            component={ClosingDetailScreen}
            options={{
              headerTitle: '마감 상세',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
