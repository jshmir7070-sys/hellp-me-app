/**
 * 파일 업로드 보안 유틸리티
 * Magic bytes 검증을 통한 실제 파일 타입 확인
 */

// 이미지 파일의 magic bytes (파일 시그니처)
const IMAGE_SIGNATURES: { [key: string]: number[] } = {
  // JPEG: FF D8 FF
  jpeg: [0xff, 0xd8, 0xff],
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  // GIF: 47 49 46 38
  gif: [0x47, 0x49, 0x46, 0x38],
  // WebP: 52 49 46 46 ... 57 45 42 50
  webp: [0x52, 0x49, 0x46, 0x46],
};

/**
 * 파일 버퍼의 magic bytes를 확인하여 실제 이미지 파일인지 검증
 * @param buffer 파일 버퍼
 * @returns 유효한 이미지 파일이면 true
 */
export function isValidImageBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 8) {
    return false;
  }

  // JPEG 검사
  if (
    buffer[0] === IMAGE_SIGNATURES.jpeg[0] &&
    buffer[1] === IMAGE_SIGNATURES.jpeg[1] &&
    buffer[2] === IMAGE_SIGNATURES.jpeg[2]
  ) {
    return true;
  }

  // PNG 검사
  if (
    buffer[0] === IMAGE_SIGNATURES.png[0] &&
    buffer[1] === IMAGE_SIGNATURES.png[1] &&
    buffer[2] === IMAGE_SIGNATURES.png[2] &&
    buffer[3] === IMAGE_SIGNATURES.png[3]
  ) {
    return true;
  }

  // GIF 검사
  if (
    buffer[0] === IMAGE_SIGNATURES.gif[0] &&
    buffer[1] === IMAGE_SIGNATURES.gif[1] &&
    buffer[2] === IMAGE_SIGNATURES.gif[2] &&
    buffer[3] === IMAGE_SIGNATURES.gif[3]
  ) {
    return true;
  }

  // WebP 검사 (RIFF header + WEBP)
  if (
    buffer[0] === IMAGE_SIGNATURES.webp[0] &&
    buffer[1] === IMAGE_SIGNATURES.webp[1] &&
    buffer[2] === IMAGE_SIGNATURES.webp[2] &&
    buffer[3] === IMAGE_SIGNATURES.webp[3] &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return true;
  }

  return false;
}

/**
 * 파일 이름에서 위험한 문자 제거
 * @param filename 원본 파일 이름
 * @returns 정제된 파일 이름
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, ".")
    .substring(0, 255);
}

/**
 * 허용된 이미지 확장자 목록
 */
export const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

/**
 * 허용된 이미지 MIME 타입 목록
 */
export const ALLOWED_IMAGE_MIMETYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

/**
 * 파일 업로드 크기 제한 (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 파일 업로드 정책 설정
 */
export const UPLOAD_POLICY = {
  maxFileSize: MAX_FILE_SIZE,
  maxFilesPerUpload: 10,
  maxFilesPerOrder: 20,
  maxTotalStoragePerUser: 500 * 1024 * 1024,
  retentionDays: {
    workProof: 365,
    orderImages: 180,
    profileImages: 0,
    idDocuments: 730,
    tempFiles: 1,
  },
  allowedExtensions: ALLOWED_IMAGE_EXTENSIONS,
  allowedMimeTypes: ALLOWED_IMAGE_MIMETYPES,
};

/**
 * 파일 개수 제한 검증
 */
export function validateFileCount(currentCount: number, maxCount: number = UPLOAD_POLICY.maxFilesPerUpload): boolean {
  return currentCount < maxCount;
}

/**
 * 파일 크기 검증
 */
export function validateFileSize(size: number, maxSize: number = UPLOAD_POLICY.maxFileSize): boolean {
  return size > 0 && size <= maxSize;
}

/**
 * 파일 확장자 검증
 */
export function validateFileExtension(filename: string): boolean {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return UPLOAD_POLICY.allowedExtensions.includes(ext);
}

/**
 * 파일 MIME 타입 검증
 */
export function validateMimeType(mimeType: string): boolean {
  return UPLOAD_POLICY.allowedMimeTypes.includes(mimeType);
}

/**
 * 종합 파일 검증
 */
export function validateUploadedFile(
  buffer: Buffer, 
  filename: string, 
  mimeType: string
): { valid: boolean; error?: string } {
  if (!validateFileSize(buffer.length)) {
    return { valid: false, error: `파일 크기가 ${UPLOAD_POLICY.maxFileSize / 1024 / 1024}MB를 초과합니다` };
  }
  
  if (!validateFileExtension(filename)) {
    return { valid: false, error: "허용되지 않는 파일 형식입니다" };
  }
  
  if (!validateMimeType(mimeType)) {
    return { valid: false, error: "허용되지 않는 파일 타입입니다" };
  }
  
  if (!isValidImageBuffer(buffer)) {
    return { valid: false, error: "유효한 이미지 파일이 아닙니다" };
  }
  
  return { valid: true };
}
