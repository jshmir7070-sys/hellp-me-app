import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ReviewListScreen from "@/screens/ReviewListScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ReviewStackParamList = {
  ReviewList: undefined;
};

const Stack = createNativeStackNavigator<ReviewStackParamList>();

export default function ReviewStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ReviewList"
        component={ReviewListScreen}
        options={{ headerTitle: "리뷰" }}
      />
    </Stack.Navigator>
  );
}
