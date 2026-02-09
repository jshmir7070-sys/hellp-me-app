/**
 * 파일 무결성 검증 (T-37)
 * 
 * 업로드 중 끊김 시 깨진 파일 저장 방지:
 * - 업로드 완료 플래그
 * - 크기/해시 검증 통과 시만 사용
 */

import crypto from "crypto";

export interface FileIntegrityInfo {
  originalName: string;
  size: number;
  mimeType: string;
  sha256Hash: string;
  uploadCompleted: boolean;
  validatedAt?: Date;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  fileInfo?: FileIntegrityInfo;
}

/**
 * 파일 해시 계산 (SHA-256)
 */
export function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * 파일 무결성 검증
 */
export function validateFileIntegrity(
  buffer: Buffer,
  expectedSize?: number,
  expectedHash?: string
): FileValidationResult {
  const errors: string[] = [];
  
  const actualSize = buffer.length;
  const actualHash = calculateFileHash(buffer);
  
  if (actualSize === 0) {
    errors.push("파일이 비어있습니다");
  }
  
  if (expectedSize !== undefined && actualSize !== expectedSize) {
    errors.push(`파일 크기 불일치 (예상: ${expectedSize}, 실제: ${actualSize})`);
  }
  
  if (expectedHash !== undefined && actualHash !== expectedHash) {
    errors.push("파일 해시 불일치 - 파일이 손상되었을 수 있습니다");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    fileInfo: errors.length === 0 ? {
      originalName: "",
      size: actualSize,
      mimeType: "",
      sha256Hash: actualHash,
      uploadCompleted: true,
      validatedAt: new Date(),
    } : undefined,
  };
}

/**
 * 이미지 파일 무결성 검증 (매직 바이트 포함)
 */
export function validateImageIntegrity(buffer: Buffer): FileValidationResult {
  const errors: string[] = [];
  
  if (buffer.length === 0) {
    errors.push("파일이 비어있습니다");
    return { isValid: false, errors };
  }
  
  if (buffer.length < 8) {
    errors.push("파일이 너무 작습니다");
    return { isValid: false, errors };
  }
  
  const header = buffer.subarray(0, 8);
  const jpeg = [0xFF, 0xD8, 0xFF];
  const png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  const gif87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
  const gif89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
  const webp = [0x52, 0x49, 0x46, 0x46];
  
  const isJpeg = jpeg.every((b, i) => header[i] === b);
  const isPng = png.every((b, i) => header[i] === b);
  const isGif = gif87.every((b, i) => header[i] === b) || gif89.every((b, i) => header[i] === b);
  const isWebp = webp.every((b, i) => header[i] === b);
  
  if (!isJpeg && !isPng && !isGif && !isWebp) {
    errors.push("지원하지 않는 이미지 형식입니다");
    return { isValid: false, errors };
  }
  
  let mimeType = "";
  if (isJpeg) mimeType = "image/jpeg";
  else if (isPng) mimeType = "image/png";
  else if (isGif) mimeType = "image/gif";
  else if (isWebp) mimeType = "image/webp";
  
  const hash = calculateFileHash(buffer);
  
  return {
    isValid: true,
    errors: [],
    fileInfo: {
      originalName: "",
      size: buffer.length,
      mimeType,
      sha256Hash: hash,
      uploadCompleted: true,
      validatedAt: new Date(),
    },
  };
}

/**
 * 업로드 완료 상태 확인용 토큰 생성
 */
export function generateUploadToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * 청크 업로드 상태 관리
 */
export interface ChunkUploadState {
  uploadId: string;
  totalChunks: number;
  receivedChunks: number[];
  totalSize: number;
  receivedSize: number;
  startedAt: Date;
  expiresAt: Date;
}

export function isChunkUploadComplete(state: ChunkUploadState): boolean {
  return state.receivedChunks.length === state.totalChunks;
}

export function isChunkUploadExpired(state: ChunkUploadState): boolean {
  return new Date() > state.expiresAt;
}
