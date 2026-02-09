import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import JobListScreen from "@/screens/JobListScreen";
import JobDetailScreen from "@/screens/JobDetailScreen";
import ClosingReportScreen from "@/screens/ClosingReportScreen";
import DisputeListScreen from "@/screens/DisputeListScreen";
import DisputeCreateScreen from "@/screens/DisputeCreateScreen";
import DisputeDetailScreen from "@/screens/DisputeDetailScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { JobsStackParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<JobsStackParamList>();

export default function JobsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="JobList"
        component={JobListScreen}
        options={{
          headerTitle: () => <HeaderTitle size="small" />,
        }}
      />
      <Stack.Screen
        name="JobDetail"
        component={JobDetailScreen}
        options={{
          headerTitle: () => <HeaderTitle size="small" />,
        }}
      />
      <Stack.Screen
        name="ClosingReport"
        component={ClosingReportScreen}
        options={{
          headerTitle: "마감자료 제출",
        }}
      />
      <Stack.Screen
        name="DisputeList"
        component={DisputeListScreen}
        options={{
          headerTitle: "이의제기/화물사고",
        }}
      />
      <Stack.Screen
        name="DisputeCreate"
        component={DisputeCreateScreen}
        options={{
          headerTitle: "이의제기 접수",
        }}
      />
      <Stack.Screen
        name="DisputeDetail"
        component={DisputeDetailScreen}
        options={{
          headerTitle: "이의제기 상세",
        }}
      />
    </Stack.Navigator>
  );
}
