/**
 * 보안 토큰 저장소
 *
 * expo-secure-store를 사용하여 인증 토큰을 암호화하여 저장합니다.
 * - iOS: Keychain Services 사용
 * - Android: SharedPreferences + Android Keystore 암호화
 *
 * AsyncStorage에서 마이그레이션: 기존 토큰을 SecureStore로 이전 후 AsyncStorage에서 삭제
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const MIGRATION_KEY = 'token_migrated_to_secure_store';

/**
 * AsyncStorage → SecureStore 마이그레이션 (최초 1회)
 * 기존 AsyncStorage에 저장된 토큰을 SecureStore로 이전합니다.
 */
export async function migrateTokensToSecureStore(): Promise<void> {
  try {
    const alreadyMigrated = await AsyncStorage.getItem(MIGRATION_KEY);
    if (alreadyMigrated === 'true') return;

    // 기존 AsyncStorage에서 토큰 읽기
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);

    // SecureStore로 이전
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
    if (refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    }

    // 마이그레이션 완료 플래그
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
  } catch (error) {
    console.error('[SecureStore] Migration error:', error);
    // 마이그레이션 실패 시 기존 AsyncStorage 토큰으로 계속 동작
  }
}

/**
 * 인증 토큰 저장
 */
export async function saveToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.error('[SecureStore] Failed to save token:', error);
    // 폴백: SecureStore 실패 시 AsyncStorage 사용 (웹 환경 등)
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    }
  }
}

/**
 * 리프레시 토큰 저장
 */
export async function saveRefreshToken(refreshToken: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  } catch (error) {
    console.error('[SecureStore] Failed to save refresh token:', error);
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
  }
}

/**
 * 인증 토큰 + 리프레시 토큰 동시 저장
 */
export async function saveTokens(token: string, refreshToken: string): Promise<void> {
  await Promise.all([
    saveToken(token),
    saveRefreshToken(refreshToken),
  ]);
}

/**
 * 인증 토큰 조회
 */
export async function getToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) return token;

    // 폴백: SecureStore에 없으면 AsyncStorage 확인 (마이그레이션 미완료 시)
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('[SecureStore] Failed to get token:', error);
    return await AsyncStorage.getItem(TOKEN_KEY);
  }
}

/**
 * 리프레시 토큰 조회
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (token) return token;

    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('[SecureStore] Failed to get refresh token:', error);
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  }
}

/**
 * 모든 토큰 삭제 (로그아웃 시)
 */
export async function clearTokens(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      // AsyncStorage에서도 삭제 (마이그레이션 미완료 토큰 정리)
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
    ]);
  } catch (error) {
    console.error('[SecureStore] Failed to clear tokens:', error);
    // 폴백
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}
