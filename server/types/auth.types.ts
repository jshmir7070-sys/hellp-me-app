/**
 * Authentication Types
 */

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'helper' | 'requester';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'helper' | 'requester' | 'admin';
  phone?: string;
  isVerified?: boolean;
  personalCode?: string;
}

export interface SocialAuthProvider {
  provider: 'kakao' | 'naver';
  providerId: string;
  email?: string;
  name?: string;
}

export interface VerificationCode {
  code: string;
  expiresAt: Date;
  attempts: number;
}

export interface PasswordResetRequest {
  email: string;
  phone: string;
  newPassword: string;
}

export interface PhoneVerificationRequest {
  phone: string;
  code: string;
}

export interface IdentityVerificationRequest {
  name: string;
  birthDate: string;
  phone: string;
  carrier: string;
}
