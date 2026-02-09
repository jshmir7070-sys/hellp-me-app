import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import RecruitmentScreen from "@/screens/RecruitmentScreen";
import RecruitmentDetailScreen from "@/screens/RecruitmentDetailScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RecruitmentStackParamList = {
  Recruitment: undefined;
  RecruitmentDetail: { recruitmentId: string };
};

const Stack = createNativeStackNavigator<RecruitmentStackParamList>();

export default function RecruitmentStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Recruitment"
        component={RecruitmentScreen}
        options={{
          headerTitle: () => <HeaderTitle size="small" />,
        }}
      />
      <Stack.Screen
        name="RecruitmentDetail"
        component={RecruitmentDetailScreen}
        options={{
          headerTitle: () => <HeaderTitle size="small" />,
        }}
      />
    </Stack.Navigator>
  );
}
