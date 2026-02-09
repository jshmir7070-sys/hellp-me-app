import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiRequest, getApiUrl, isApiConfigured, getApiConfigError } from '@/lib/query-client';

export type UserRole = 'helper' | 'requester' | 'admin' | 'superadmin' | null;

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phoneNumber?: string;
  profileImageUrl?: string;
  onboardingStatus?: 'pending' | 'submitted' | 'approved' | 'rejected';
  helperVerified?: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  selectRole: (role: UserRole) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

interface SignupData {
  email: string;
  password: string;
  name: string;
  phoneNumber: string;
  role: UserRole;
  address?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// SecureStore 헬퍼 함수 (웹에서는 AsyncStorage 폴백)
async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    return AsyncStorage.setItem(key, value);
  }
  return SecureStore.setItemAsync(key, value);
}

async function secureRemove(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    return AsyncStorage.removeItem(key);
  }
  return SecureStore.deleteItemAsync(key);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function checkAuthStatus() {
    try {
      if (!isApiConfigured()) {
        const configError = getApiConfigError();
        console.error('API not configured:', configError);
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }

      const token = await secureGet(TOKEN_KEY);
      if (!token) {
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }

      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/me', baseUrl).href, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setState({
          user: data.user,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        await secureRemove(TOKEN_KEY);
        await secureRemove(REFRESH_TOKEN_KEY);
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }

  async function login(email: string, password: string) {
    try {
      if (!isApiConfigured()) {
        const configError = getApiConfigError();
        return { success: false, error: configError || '서버에 연결할 수 없습니다.' };
      }

      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/login', baseUrl).href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.message || '로그인에 실패했습니다' };
      }

      await secureSet(TOKEN_KEY, data.token);
      if (data.refreshToken) {
        await secureSet(REFRESH_TOKEN_KEY, data.refreshToken);
      }

      setState({
        user: data.user,
        isLoading: false,
        isAuthenticated: true,
      });

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: '네트워크 오류가 발생했습니다' };
    }
  }

  async function signup(signupData: SignupData) {
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/signup', baseUrl).href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.message || '회원가입에 실패했습니다' };
      }

      await secureSet(TOKEN_KEY, data.token);
      if (data.refreshToken) {
        await secureSet(REFRESH_TOKEN_KEY, data.refreshToken);
      }

      setState({
        user: data.user,
        isLoading: false,
        isAuthenticated: true,
      });

      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: '네트워크 오류가 발생했습니다' };
    }
  }

  async function selectRole(role: UserRole) {
    try {
      const token = await secureGet(TOKEN_KEY);
      if (!token) {
        return { success: false, error: '인증이 필요합니다' };
      }

      const baseUrl = getApiUrl();
      const res = await fetch(new URL('/api/auth/update-role', baseUrl).href, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.message || '역할 선택에 실패했습니다' };
      }

      setState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, role } : null,
      }));

      return { success: true };
    } catch (error) {
      console.error('Role selection error:', error);
      return { success: false, error: '네트워크 오류가 발생했습니다' };
    }
  }

  async function logout() {
    try {
      const token = await secureGet(TOKEN_KEY);
      if (token) {
        const baseUrl = getApiUrl();
        await fetch(new URL('/api/auth/logout', baseUrl).href, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await secureRemove(TOKEN_KEY);
      await secureRemove(REFRESH_TOKEN_KEY);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }

  async function refreshUser() {
    await checkAuthStatus();
  }

  // 외부에서 토큰을 가져올 수 있도록 헬퍼 함수 제공
  async function getToken(): Promise<string | null> {
    return secureGet(TOKEN_KEY);
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        signup,
        logout,
        selectRole,
        refreshUser,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
