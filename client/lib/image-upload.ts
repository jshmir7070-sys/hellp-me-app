import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { getApiUrl } from '@/lib/query-client';

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
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.7 } = options;

  const manipulateResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth, height: maxHeight } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );

  return manipulateResult.uri;
}

export async function uploadImage(
  uri: string,
  endpoint: string,
  fieldName: string = 'file',
  additionalData: Record<string, string> = {},
  authToken?: string | null
): Promise<UploadResult> {
  try {
    const compressedUri = await compressImage(uri);

    const fileInfo = await FileSystem.getInfoAsync(compressedUri);
    if (!fileInfo.exists) {
      return { success: false, error: '파일을 찾을 수 없습니다' };
    }

    const filename = compressedUri.split('/').pop() || 'upload.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    const formData = new FormData();
    formData.append(fieldName, {
      uri: compressedUri,
      name: filename,
      type,
    } as any);

    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const headers: Record<string, string> = {
      'Content-Type': 'multipart/form-data',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(new URL(endpoint, getApiUrl()).toString(), {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || '업로드에 실패했습니다',
      };
    }

    const data = await response.json();
    return {
      success: true,
      url: data.url || data.path,
    };
  } catch (error) {
    console.error('Image upload error:', error);
    return {
      success: false,
      error: '업로드 중 오류가 발생했습니다',
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
