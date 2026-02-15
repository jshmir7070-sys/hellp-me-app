import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CreateJobContainer from "@/components/CreateJob/CreateJobContainer";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type CreateJobStackParamList = {
  CreateJob: undefined;
};

const Stack = createNativeStackNavigator<CreateJobStackParamList>();

export default function CreateJobStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="CreateJob"
        component={CreateJobContainer}
        options={{ headerTitle: () => <HeaderTitle size="small" /> }}
      />
    </Stack.Navigator>
  );
}
