/**
 * 인증이 필요한 이미지 URL을 생성하는 유틸리티 훅
 *
 * 서버의 /uploads/ 경로 중 일부(closing, orders, announcements)는 공개 접근이지만
 * 나머지(credentials, profiles, vehicles, evidence 등)는 JWT 인증이 필요합니다.
 * React Native의 Image 컴포넌트는 Authorization 헤더를 보낼 수 없으므로
 * ?token= 쿼리 파라미터 방식으로 인증을 전달합니다.
 */

import { useState, useEffect, useCallback } from 'react';
import { getToken } from '@/utils/secure-token-storage';
import { getApiUrl } from '@/lib/query-client';

// 공개 접근 가능한 경로 (서버에서 인증 없이 서빙)
const PUBLIC_PATHS = ['/uploads/announcements', '/uploads/closing', '/uploads/orders'];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

/**
 * 인증 토큰이 포함된 이미지 URL을 반환하는 훅
 *
 * 사용법:
 * ```tsx
 * const { getImageUrl } = useAuthImage();
 * <Image source={{ uri: getImageUrl('/uploads/evidence/abc.jpg') }} />
 * ```
 */
export function useAuthImage() {
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(setAuthToken);
  }, []);

  const getImageUrl = useCallback(
    (imagePath: string): string => {
      if (!imagePath) return '';

      // 이미 완전한 http URL이면 그대로 반환
      if (imagePath.startsWith('http')) return imagePath;

      // 상대 경로를 절대 URL로 변환
      const baseUrl = getApiUrl().replace(/\/$/, '');
      const fullUrl = imagePath.startsWith('/')
        ? `${baseUrl}${imagePath}`
        : `${baseUrl}/${imagePath}`;

      // 공개 경로면 토큰 불필요
      if (isPublicPath(imagePath)) return fullUrl;

      // 인증 필요 경로면 ?token= 추가
      if (authToken) {
        return `${fullUrl}?token=${authToken}`;
      }

      return fullUrl;
    },
    [authToken],
  );

  return { getImageUrl, authToken };
}
