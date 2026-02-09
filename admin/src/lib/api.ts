const API_BASE = '/api/admin';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let sessionExpiredShown = false;

function handleSessionExpired() {
  if (sessionExpiredShown) return;
  sessionExpiredShown = true;
  
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  
  const confirmed = window.confirm(
    '세션이 만료되었습니다.\n다시 로그인해주세요.\n\n확인을 누르면 로그인 페이지로 이동합니다.'
  );
  
  if (confirmed || !confirmed) {
    window.location.href = '/login';
  }
  
  setTimeout(() => {
    sessionExpiredShown = false;
  }, 1000);
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function adminFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });
  
  if (response.status === 401) {
    handleSessionExpired();
    throw new ApiError(401, '세션이 만료되었습니다');
  }
  
  return response;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    handleSessionExpired();
    throw new ApiError(401, '세션이 만료되었습니다');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorData.message || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function login(email: string, password: string): Promise<{ token: string; user: any }> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(response.status, errorData.message || 'Login failed');
  }

  return response.json();
}
