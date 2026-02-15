import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '@/screens/LoginScreen';
import SignupScreen from '@/screens/SignupScreen';
import FindEmailScreen from '@/screens/FindEmailScreen';
import FindPasswordScreen from '@/screens/FindPasswordScreen';
import { useScreenOptions } from '@/hooks/useScreenOptions';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  FindEmail: undefined;
  FindPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen 
        name="FindEmail" 
        component={FindEmailScreen}
        options={{ headerShown: true, headerTitle: '아이디 찾기' }}
      />
      <Stack.Screen 
        name="FindPassword" 
        component={FindPasswordScreen}
        options={{ headerShown: true, headerTitle: '비밀번호 찾기' }}
      />
    </Stack.Navigator>
  );
}
