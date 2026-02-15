import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// 키 파생용 salt: 환경변수에서 읽거나, 기본값 사용 (프로덕션에서는 반드시 환경변수 설정 권장)
const KEY_SALT = process.env.ENCRYPTION_SALT || "hellpme-encryption-salt-v1";

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY or JWT_SECRET must be set for data encryption");
  }
  return scryptSync(secret, KEY_SALT, 32);
}

/**
 * 민감 데이터를 AES-256-GCM으로 암호화합니다.
 * 반환값: iv:authTag:encryptedData (hex 인코딩)
 */
export function encrypt(plainText: string): string {
  if (!plainText) return plainText;

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * AES-256-GCM으로 암호화된 데이터를 복호화합니다.
 * 입력: iv:authTag:encryptedData (hex 인코딩)
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return encryptedText;

  // 암호화되지 않은 기존 데이터인 경우 그대로 반환 (마이그레이션 호환)
  if (!encryptedText.includes(":")) {
    return encryptedText;
  }

  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    return encryptedText; // 암호화 형식이 아닌 경우 원본 반환
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch {
    // 복호화 실패 시 원본 반환 (마이그레이션 호환)
    return encryptedText;
  }
}

/**
 * 검색 가능한 단방향 HMAC 해시를 생성합니다 (CI/DI 등 검색이 필요한 고유 식별자용).
 * HMAC-SHA256 사용으로 레인보우 테이블 공격 방어.
 * 동일한 입력에 대해 항상 동일한 해시가 생성됩니다.
 */
export function hashForSearch(plainText: string): string {
  if (!plainText) return plainText;
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || "";
  const { createHmac } = require("crypto");
  return createHmac("sha256", secret).update(plainText).digest("hex");
}

/**
 * 계좌번호를 마스킹합니다 (앞4자리 + **** + 뒤4자리)
 */
export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber) return "";
  const plain = decrypt(accountNumber);
  const digitsOnly = plain.replace(/[^0-9]/g, "");
  if (digitsOnly.length <= 8) return "****";
  return `${digitsOnly.slice(0, 4)}****${digitsOnly.slice(-4)}`;
}

/**
 * 전화번호를 마스킹합니다 (010-****-1234)
 */
export function maskPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return "";
  const plain = decrypt(phoneNumber);
  if (plain.length <= 7) return "****";
  return `${plain.slice(0, 3)}-****-${plain.slice(-4)}`;
}
