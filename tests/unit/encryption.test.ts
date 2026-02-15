/**
 * 암호화 유틸리티 단위 테스트
 *
 * encrypt/decrypt, hashForSearch, maskAccountNumber 함수를 검증합니다.
 */

import { describe, it, expect, beforeAll } from 'vitest';

// 테스트용 환경변수 설정
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-2024';
  process.env.ENCRYPTION_SALT = 'test-salt-v1';
});

// 동적 import (환경변수 설정 후)
let encrypt: any;
let decrypt: any;
let hashForSearch: any;
let maskAccountNumber: any;
let maskPhoneNumber: any;

beforeAll(async () => {
  const mod = await import('../../server/utils/encryption');
  encrypt = mod.encrypt;
  decrypt = mod.decrypt;
  hashForSearch = mod.hashForSearch;
  maskAccountNumber = mod.maskAccountNumber;
  maskPhoneNumber = mod.maskPhoneNumber;
});

describe('encrypt / decrypt', () => {
  it('should encrypt and decrypt plain text correctly', () => {
    const plainText = '계좌번호 1234567890';
    const encrypted = encrypt(plainText);
    expect(encrypted).not.toBe(plainText);
    expect(encrypted).toContain(':'); // iv:authTag:encrypted 형식

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plainText);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plainText = 'test data';
    const encrypted1 = encrypt(plainText);
    const encrypted2 = encrypt(plainText);
    expect(encrypted1).not.toBe(encrypted2); // IV가 다르므로 결과도 달라야 함

    // 하지만 둘 다 복호화하면 같은 원문
    expect(decrypt(encrypted1)).toBe(plainText);
    expect(decrypt(encrypted2)).toBe(plainText);
  });

  it('should handle empty string', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });

  it('should handle null/undefined gracefully', () => {
    expect(encrypt(null as any)).toBe(null);
    expect(decrypt(null as any)).toBe(null);
  });

  it('should handle Korean text', () => {
    const korean = '대한민국 서울시 강남구';
    const encrypted = encrypt(korean);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(korean);
  });

  it('should handle special characters', () => {
    const special = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
    const encrypted = encrypt(special);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(special);
  });

  it('should return original text if decrypt receives non-encrypted string', () => {
    expect(decrypt('plain text without colons')).toBe('plain text without colons');
  });

  it('should return original text if decrypt receives wrong format', () => {
    expect(decrypt('only:two:parts:extra')).toBe('only:two:parts:extra');
  });
});

describe('hashForSearch', () => {
  it('should produce consistent hash for same input', () => {
    const hash1 = hashForSearch('1234567890');
    const hash2 = hashForSearch('1234567890');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = hashForSearch('1234567890');
    const hash2 = hashForSearch('0987654321');
    expect(hash1).not.toBe(hash2);
  });

  it('should return hex string', () => {
    const hash = hashForSearch('test');
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash.length).toBe(64); // SHA-256 hex = 64 chars
  });

  it('should handle empty string', () => {
    expect(hashForSearch('')).toBe('');
  });
});

describe('maskAccountNumber', () => {
  it('should mask middle digits of account number', () => {
    const encrypted = encrypt('1234567890123');
    const masked = maskAccountNumber(encrypted);
    expect(masked).toBe('1234****0123');
  });

  it('should return **** for short account numbers', () => {
    const encrypted = encrypt('12345678');
    const masked = maskAccountNumber(encrypted);
    expect(masked).toBe('****');
  });

  it('should handle empty string', () => {
    expect(maskAccountNumber('')).toBe('');
  });
});

describe('maskPhoneNumber', () => {
  it('should mask middle of phone number', () => {
    const encrypted = encrypt('01012345678');
    const masked = maskPhoneNumber(encrypted);
    expect(masked).toBe('010-****-5678');
  });

  it('should handle empty string', () => {
    expect(maskPhoneNumber('')).toBe('');
  });
});
