import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';

async function getToken(): Promise<string | null> {
  try {
    // 웹에서는 AsyncStorage, 네이티브에서는 SecureStore 사용
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

let apiUrlConfigError: string | null = null;

export function getApiConfigError(): string | null {
  return apiUrlConfigError;
}

export function getApiUrl(): string {
  const host = process.env.EXPO_PUBLIC_DOMAIN;
  const protocol = process.env.EXPO_PUBLIC_API_PROTOCOL;

  if (!host) {
    if (typeof window !== 'undefined' && window.location) {
      apiUrlConfigError = null;
      return window.location.origin + '/';
    }

    if (__DEV__) {
      apiUrlConfigError = null;
      return 'http://localhost:5000/';
    }
    
    apiUrlConfigError = '서버 연결 설정이 올바르지 않습니다. 앱을 다시 설치해 주세요.';
    console.error("[CRITICAL] EXPO_PUBLIC_DOMAIN is not set in production build.");
    return '';
  }

  try {
    // 프로토콜이 명시적으로 포함된 경우 그대로 사용
    let urlString: string;
    if (host.startsWith('http://') || host.startsWith('https://')) {
      urlString = host;
    } else {
      // 프로토콜 미포함 시: 개발 환경에서 EXPO_PUBLIC_API_PROTOCOL 확인
      const protocol = process.env.EXPO_PUBLIC_API_PROTOCOL || 'https';
      urlString = `${protocol}://${host}`;
    }
    
    const url = new URL(urlString);
    apiUrlConfigError = null;
    return url.href;
  } catch (e) {
    apiUrlConfigError = '서버 주소가 올바르지 않습니다.';
    console.error("[CRITICAL] Invalid EXPO_PUBLIC_DOMAIN:", host);
    return '';
  }
}

export function isApiConfigured(): boolean {
  const url = getApiUrl();
  return url !== '' && apiUrlConfigError === null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  
  if (!baseUrl) {
    const error = getApiConfigError() || '서버에 연결할 수 없습니다.';
    throw new Error(error);
  }
  
  const url = new URL(route, baseUrl);
  const token = await getToken();

  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    
    if (!baseUrl) {
      const error = getApiConfigError() || '서버에 연결할 수 없습니다.';
      throw new Error(error);
    }
    
    const url = new URL(queryKey[0] as string, baseUrl);
    const token = await getToken();

    const res = await fetch(url, {
      credentials: "include",
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export async function getAuthToken(): Promise<string | null> {
  return getToken();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
