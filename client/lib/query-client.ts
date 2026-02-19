import { QueryClient, QueryFunction } from "@tanstack/react-query";
import {
  getToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
} from "@/utils/secure-token-storage";

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * 토큰 자동 갱신 메커니즘
 * - 401 에러 발생 시 자동으로 refresh token으로 새 토큰 발급
 * - 동시 다중 요청 시 중복 갱신 방지
 */
async function refreshAccessToken(): Promise<string | null> {
  // 이미 갱신 중이면 기존 Promise 반환 (중복 요청 방지)
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      
      if (!refreshToken) {
        await clearTokens();
        return null;
      }

      const baseUrl = getApiUrl();
      if (!baseUrl) {
        return null;
      }

      const response = await fetch(new URL('/api/auth/refresh', baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        // Refresh token도 만료되었으면 로그아웃 처리
        await clearTokens();
        return null;
      }

      const data = await response.json();
      
      if (data.token && data.refreshToken) {
        await saveTokens(data.token, data.refreshToken);
        return data.token;
      }

      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await clearTokens();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

let apiUrlConfigError: string | null = null;

export function getApiConfigError(): string | null {
  return apiUrlConfigError;
}

export function getApiUrl(): string {
  const host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    if (typeof window !== 'undefined' && window.location) {
      apiUrlConfigError = null;
      return window.location.origin + '/';
    }
    
    if (__DEV__) {
      console.warn("[DEV] EXPO_PUBLIC_DOMAIN not set, using localhost:5000");
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
  retryCount = 0,
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

  // 401 에러 시 토큰 갱신 후 재시도 (1회만)
  if (res.status === 401 && retryCount === 0) {
    const newToken = await refreshAccessToken();
    
    if (newToken) {
      // 새 토큰으로 재시도
      return apiRequest(method, route, data, retryCount + 1);
    } else {
      // 갱신 실패 - 로그인 페이지로 리다이렉트 필요
      throw new Error('401: 인증이 만료되었습니다. 다시 로그인해주세요.');
    }
  }

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
    let token = await getToken();

    let res = await fetch(url, {
      credentials: "include",
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
    });

    // 401 에러 시 토큰 갱신 후 재시도 (1회만)
    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      
      if (newToken) {
        // 새 토큰으로 재시도
        res = await fetch(url, {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
        });
      } else if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export async function getAuthToken(): Promise<string | null> {
  return getToken();
}

export async function setAuthTokens(token: string, refreshToken: string): Promise<void> {
  return saveTokens(token, refreshToken);
}

export async function clearAuthTokens(): Promise<void> {
  return clearTokens();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
      retry: 2, // 네트워크 실패 시 2회 재시도
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: 1, // mutation 실패 시 1회 재시도
    },
  },
});
