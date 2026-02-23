import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { getApiUrl } from '@/lib/query-client';

// expo-image-manipulator를 동적 import (설치되지 않은 환경에서도 안전)
let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch (e) {
  // expo-image-manipulator가 설치되지 않은 경우 무시
}

export type ImagePickerOptions = {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  source?: 'camera' | 'library' | 'both';
};

export type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

export type UploadResult = {
  success: boolean;
  url?: string;
  error?: string;
};

export async function pickImage(
  options: ImagePickerOptions = {}
): Promise<string | null> {
  const {
    allowsEditing = false,
    aspect = [4, 3],
    quality = 0.8,
    source = 'both',
  } = options;

  let result: ImagePicker.ImagePickerResult;

  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    result = await ImagePicker.launchCameraAsync({
      allowsEditing,
      aspect,
      quality,
    });
  } else if (source === 'library') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing,
      aspect,
      quality,
    });
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing,
      aspect,
      quality,
    });
  }

  if (result.canceled || !result.assets?.[0]?.uri) {
    return null;
  }

  return result.assets[0].uri;
}

export async function takePhoto(
  options: Omit<ImagePickerOptions, 'source'> = {}
): Promise<string | null> {
  return pickImage({ ...options, source: 'camera' });
}

export async function compressImage(
  uri: string,
  options: CompressOptions = {}
): Promise<string> {
  // expo-image-manipulator가 없으면 원본 URI 그대로 반환
  if (!ImageManipulator || !ImageManipulator.manipulateAsync) {
    console.warn('[image-upload] expo-image-manipulator not available, skipping compression');
    return uri;
  }

  try {
    const { maxWidth = 1200, maxHeight = 1200, quality = 0.7 } = options;

    const manipulateResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth, height: maxHeight } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );

    return manipulateResult.uri;
  } catch (err) {
    console.warn('[image-upload] Image compression failed, using original:', err);
    return uri;
  }
}

export async function uploadImage(
  uri: string,
  endpoint: string,
  fieldName: string = 'file',
  additionalData: Record<string, string> = {},
  authToken?: string | null
): Promise<UploadResult> {
  try {
    // 1. content:// URI → file:// 로 복사 (Android 필수)
    let safeUri = uri;
    if (uri.startsWith('content://') || uri.startsWith('ph://')) {
      try {
        const destDir = (FileSystem.cacheDirectory || FileSystem.documentDirectory || '').replace(/\/$/, '');
        const destPath = `${destDir}/upload_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: uri, to: destPath });
        safeUri = destPath;
        console.log('[image-upload] Copied to:', safeUri);
      } catch (copyErr) {
        console.warn('[image-upload] URI copy failed, using original:', copyErr);
      }
    }

    // 2. 파일명과 MIME 타입 추출
    const filename = safeUri.split('/').pop() || `upload_${Date.now()}.jpg`;
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    // 3. FormData 구성
    const formData = new FormData();
    formData.append(fieldName, {
      uri: safeUri,
      name: filename,
      type: mimeType,
    } as any);

    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // 4. 업로드 URL 구성
    const baseUrl = getApiUrl().replace(/\/$/, '');
    const uploadUrl = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    console.log(`[image-upload] Uploading to ${uploadUrl}, uri: ${safeUri.substring(0, 80)}`);

    // 5. fetch로 업로드
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    // Content-Type을 설정하지 않음 — fetch가 FormData boundary를 자동 생성

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers,
    });

    console.log('[image-upload] Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[image-upload] Server error:', response.status, errorData);
      return {
        success: false,
        error: errorData.message || `업로드 실패 (${response.status})`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      url: data.url || data.imageUrl || data.path,
    };
  } catch (error: any) {
    console.error('[image-upload] Upload error:', error?.message || error);
    return {
      success: false,
      error: error?.message || '업로드 중 오류가 발생했습니다',
    };
  }
}

export async function uploadImageWithRetry(
  uri: string,
  endpoint: string,
  fieldName: string = 'file',
  additionalData: Record<string, string> = {},
  maxRetries: number = 3,
  authToken?: string | null
): Promise<UploadResult> {
  let lastError: string = '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await uploadImage(uri, endpoint, fieldName, additionalData, authToken);
    if (result.success) {
      return result;
    }
    lastError = result.error || '알 수 없는 오류';

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  return { success: false, error: lastError };
}

export type EvidenceCategory = 'incident' | 'dispute' | 'closing' | 'work_proof' | 'contract' | 'general';
export type ReferenceType = 'order' | 'contract' | 'settlement' | 'incident' | 'dispute' | 'closing_report';

export interface EvidenceUploadOptions {
  category: EvidenceCategory;
  referenceId?: string | number;
  referenceType?: ReferenceType;
}

export interface EvidenceUploadResult extends UploadResult {
  category?: EvidenceCategory;
  referenceId?: string | number | null;
  referenceType?: ReferenceType | null;
  uploadedAt?: string;
}

export async function uploadEvidence(
  uri: string,
  options: EvidenceUploadOptions,
  authToken: string
): Promise<EvidenceUploadResult> {
  const additionalData: Record<string, string> = {
    category: options.category,
  };
  
  if (options.referenceId !== undefined) {
    additionalData.referenceId = String(options.referenceId);
  }
  if (options.referenceType) {
    additionalData.referenceType = options.referenceType;
  }

  const result = await uploadImageWithRetry(
    uri,
    '/api/upload/evidence',
    'file',
    additionalData,
    3,
    authToken
  );

  return {
    ...result,
    category: options.category,
    referenceId: options.referenceId ?? null,
    referenceType: options.referenceType ?? null,
  };
}

export async function uploadMultipleEvidence(
  uris: string[],
  options: EvidenceUploadOptions,
  authToken: string
): Promise<EvidenceUploadResult[]> {
  const results: EvidenceUploadResult[] = [];
  
  for (const uri of uris) {
    const result = await uploadEvidence(uri, options, authToken);
    results.push(result);
    
    if (!result.success) {
      console.warn(`Failed to upload evidence: ${result.error}`);
    }
  }
  
  return results;
}

export function getSuccessfulUrls(results: EvidenceUploadResult[]): string[] {
  return results
    .filter(r => r.success && r.url)
    .map(r => r.url as string);
}
