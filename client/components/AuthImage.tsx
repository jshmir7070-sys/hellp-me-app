/**
 * 인증이 필요한 이미지를 안전하게 표시하는 공통 컴포넌트
 *
 * - 상대 경로를 절대 URL로 변환
 * - 보호된 경로에 ?token= 자동 추가
 * - 로드 실패 시 fallback placeholder 표시
 * - 로딩 상태 표시
 */

import React, { useState } from 'react';
import { Image, View, ActivityIndicator, StyleSheet, ImageStyle, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuthImage } from '@/hooks/useAuthImage';
import { getApiUrl } from '@/lib/query-client';
import { BrandColors } from '@/constants/theme';

interface AuthImageProps {
  /** 이미지 경로 (상대 또는 절대) */
  src: string | null | undefined;
  /** Image 스타일 */
  style?: ImageStyle;
  /** resizeMode */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  /** fallback 아이콘 이름 */
  fallbackIcon?: keyof typeof Feather.glyphMap;
  /** fallback 아이콘 크기 */
  fallbackIconSize?: number;
  /** fallback 아이콘 색상 */
  fallbackIconColor?: string;
  /** 로딩 표시 여부 */
  showLoading?: boolean;
  /** fallback 컨테이너 스타일 */
  fallbackStyle?: ViewStyle;
}

export function AuthImage({
  src,
  style,
  resizeMode = 'cover',
  fallbackIcon = 'image',
  fallbackIconSize = 24,
  fallbackIconColor = '#999',
  showLoading = true,
  fallbackStyle,
}: AuthImageProps) {
  const { getImageUrl } = useAuthImage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!src) {
    return (
      <View style={[styles.fallback, style, fallbackStyle]}>
        <Feather name={fallbackIcon} size={fallbackIconSize} color={fallbackIconColor} />
      </View>
    );
  }

  const imageUri = getImageUrl(src);

  if (error) {
    return (
      <View style={[styles.fallback, style, fallbackStyle]}>
        <Feather name="alert-circle" size={fallbackIconSize} color="#ccc" />
      </View>
    );
  }

  return (
    <View style={[style ? { width: (style as any).width, height: (style as any).height } : undefined]}>
      <Image
        source={{ uri: imageUri }}
        style={[style, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}
        resizeMode={resizeMode}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
      {loading && showLoading && (
        <View style={[styles.loadingOverlay, style]}>
          <ActivityIndicator size="small" color={BrandColors.helper} />
        </View>
      )}
    </View>
  );
}

/**
 * 이미지 URL을 안전하게 해석하는 유틸리티 (hook 없이 사용 가능)
 * 공개 경로와 보호 경로를 구분하여 처리
 */
export function resolveImageUrlSafe(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const baseUrl = getApiUrl().replace(/\/$/, '');
  return url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
}

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  loadingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
  },
});
