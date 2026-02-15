import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import ModalScreen from "@/screens/ModalScreen";
import QRScannerScreen from "@/screens/QRScannerScreen";
import WorkProofScreen from "@/screens/WorkProofScreen";
import HelperOnboardingScreen from "@/screens/HelperOnboardingScreen";
import ContractSigningScreen from "@/screens/ContractSigningScreen";
import PaymentScreen from "@/screens/PaymentScreen";
import ContractScreen from "@/screens/ContractScreen";
import CreateContractScreen from "@/screens/CreateContractScreen";
import IdentityVerificationScreen from "@/screens/IdentityVerificationScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RootStackParamList = {
  Main: undefined;
  Modal: undefined;
  QRScanner: { contractId?: string; type?: 'checkin' };
  WorkProof: { orderId?: string; contractId?: string; type?: 'pickup' | 'delivery' | 'other' };
  HelperOnboarding: undefined;
  ContractSigning: undefined;
  Payment: { orderId?: string; contractId?: string; amount?: number; paymentType?: 'deposit' | 'balance'; orderTitle?: string };
  Contract: { contractId?: string; orderId?: string };
  CreateContract: { orderId: number };
  IdentityVerification: { returnScreen?: string; purpose?: 'signup' | 'profile' | 'payment' };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Modal"
        component={ModalScreen}
        options={{
          presentation: "modal",
          headerTitle: () => <HeaderTitle size="small" />,
        }}
      />
      <Stack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{
          presentation: "fullScreenModal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="WorkProof"
        component={WorkProofScreen}
        options={{
          headerTitle: () => <HeaderTitle size="small" />,
        }}
      />
      <Stack.Screen
        name="HelperOnboarding"
        component={HelperOnboardingScreen}
        options={{
          headerTitle: "서류 제출",
        }}
      />
      <Stack.Screen
        name="ContractSigning"
        component={ContractSigningScreen}
        options={{
          headerTitle: "운송 계약",
        }}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{
          headerTitle: () => <HeaderTitle size="small" />,
        }}
      />
      <Stack.Screen
        name="Contract"
        component={ContractScreen}
        options={{
          headerTitle: () => <HeaderTitle size="small" />,
        }}
      />
      <Stack.Screen
        name="CreateContract"
        component={CreateContractScreen}
        options={{
          headerTitle: "계약서 작성",
        }}
      />
      <Stack.Screen
        name="IdentityVerification"
        component={IdentityVerificationScreen}
        options={{
          headerTitle: () => <HeaderTitle size="small" />,
        }}
      />
    </Stack.Navigator>
  );
}
