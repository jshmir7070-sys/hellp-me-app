/**
 * PG Service 단위 테스트
 *
 * PG 서비스의 환불 처리, 결제 상태 조회, 에러 처리를 검증합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 환경변수 모킹을 위해 동적 import
let pgService: any;
let mapPGStatusToDBStatus: any;
let PGServiceError: any;

describe('PG Service', () => {
  describe('mapPGStatusToDBStatus', () => {
    beforeEach(async () => {
      const mod = await import('../../server/lib/pg-service');
      mapPGStatusToDBStatus = mod.mapPGStatusToDBStatus;
    });

    it('READY → pending', () => {
      expect(mapPGStatusToDBStatus('READY')).toBe('pending');
    });

    it('PAID → completed', () => {
      expect(mapPGStatusToDBStatus('PAID')).toBe('completed');
    });

    it('FAILED → failed', () => {
      expect(mapPGStatusToDBStatus('FAILED')).toBe('failed');
    });

    it('CANCELLED → refunded', () => {
      expect(mapPGStatusToDBStatus('CANCELLED')).toBe('refunded');
    });

    it('PARTIAL_CANCELLED → refunded', () => {
      expect(mapPGStatusToDBStatus('PARTIAL_CANCELLED')).toBe('refunded');
    });

    it('VIRTUAL_ACCOUNT_ISSUED → awaiting_deposit', () => {
      expect(mapPGStatusToDBStatus('VIRTUAL_ACCOUNT_ISSUED')).toBe('awaiting_deposit');
    });

    it('unknown status → pending', () => {
      expect(mapPGStatusToDBStatus('UNKNOWN_STATUS')).toBe('pending');
    });
  });

  describe('PGServiceError', () => {
    beforeEach(async () => {
      const mod = await import('../../server/lib/pg-service');
      PGServiceError = mod.PGServiceError;
    });

    it('should have correct name and properties', () => {
      const error = new PGServiceError('PG_API_ERROR', 'Test error', { detail: 'raw' });
      expect(error.name).toBe('PGServiceError');
      expect(error.code).toBe('PG_API_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.rawResponse).toEqual({ detail: 'raw' });
    });

    it('should be instance of Error', () => {
      const error = new PGServiceError('CODE', 'msg');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('pgService (test mode, no API key)', () => {
    beforeEach(async () => {
      // PORTONE_API_SECRET이 없으면 테스트 모드로 동작
      delete process.env.PORTONE_API_SECRET;
      delete process.env.PG_MODE;
      // 모듈 캐시를 우회하기 위해 동적 import
      vi.resetModules();
      const mod = await import('../../server/lib/pg-service');
      pgService = mod.pgService;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('isConfigured should return false when no API key', () => {
      expect(pgService.isConfigured()).toBe(false);
    });

    it('getServiceInfo should reflect test mode', () => {
      const info = pgService.getServiceInfo();
      expect(info.configured).toBe(false);
      expect(info.testMode).toBe(true);
      expect(info.provider).toBe('PortOne V2');
    });

    it('getPaymentStatus should return simulation in test mode', async () => {
      const result = await pgService.getPaymentStatus('test_payment_123');
      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('test_payment_123');
      expect(result.message).toContain('테스트 모드');
    });

    it('getPaymentStatus should return error when no paymentId', async () => {
      const result = await pgService.getPaymentStatus('');
      expect(result.success).toBe(false);
      expect(result.message).toContain('pgTransactionId');
    });

    it('processRefund should return simulation in test mode', async () => {
      const result = await pgService.processRefund({
        paymentId: 'test_payment_123',
        amount: 10000,
        reason: '테스트 환불',
      });
      expect(result.success).toBe(true);
      expect(result.refundedAmount).toBe(10000);
      expect(result.message).toContain('테스트 모드');
    });

    it('processRefund should return error when no paymentId', async () => {
      const result = await pgService.processRefund({
        paymentId: '',
        amount: 10000,
        reason: '테스트 환불',
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('pgTransactionId');
    });
  });
});
