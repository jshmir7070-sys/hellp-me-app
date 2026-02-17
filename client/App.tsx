import React, { useEffect, useState } from "react";
import { StyleSheet, View, ActivityIndicator, AppState, Platform } from "react-native";
import type { AppStateStatus } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";

import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

// 앱이 백그라운드에서 포그라운드로 돌아올 때 React Query 자동 새로고침
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

SplashScreen.preventAutoHideAsync();

import RootStackNavigator from "@/navigation/RootStackNavigator";
import AuthStackNavigator from "@/navigation/AuthStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { useTheme } from "@/hooks/useTheme";

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  return isAuthenticated ? <RootStackNavigator /> : <AuthStackNavigator />;
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // AppState 변화 감지 → React Query 포커스 상태 연동
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          'Ionicons': require('./assets/fonts/Ionicons.ttf'),
        });
      } catch (e) {
        console.warn("Font loading failed:", e);
      } finally {
        setFontsLoaded(true);
      }
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <NotificationProvider>
            <AuthProvider>
              <SafeAreaProvider>
                <GestureHandlerRootView style={styles.root}>
                  <KeyboardProvider>
                    <NavigationContainer>
                      <AppContent />
                    </NavigationContainer>
                    <StatusBar style="auto" />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SafeAreaProvider>
            </AuthProvider>
          </NotificationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
