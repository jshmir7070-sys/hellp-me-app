import React, { useEffect, useState } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

SplashScreen.preventAutoHideAsync();

import RootStackNavigator from "@/navigation/RootStackNavigator";
import AuthStackNavigator from "@/navigation/AuthStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useTheme } from "@/hooks/useTheme";
import { SystemNotificationProvider } from "@/components/notifications/SystemNotificationProvider";
import linking from "@/navigation/linking";

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
          <AuthProvider>
            <SafeAreaProvider>
              <GestureHandlerRootView style={styles.root}>
                <KeyboardProvider>
                  <SystemNotificationProvider>
                    <NavigationContainer linking={linking}>
                      <AppContent />
                    </NavigationContainer>
                    <StatusBar style="auto" />
                  </SystemNotificationProvider>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </SafeAreaProvider>
          </AuthProvider>
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
