/**
 * 정산 계산기 단위 테스트
 *
 * calculateSettlement, calculateHelperPayout, parseClosingReport 함수를 검증합니다.
 * 정산 금액 계산은 비즈니스 크리티컬이므로 경계값 테스트를 포함합니다.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSettlement,
  calculateHelperPayout,
  parseClosingReport,
  type ClosingData,
} from '../../server/lib/settlement-calculator';

describe('calculateSettlement', () => {
  it('should calculate basic settlement correctly', () => {
    const data: ClosingData = {
      deliveredCount: 100,
      returnedCount: 10,
      etcCount: 0,
      unitPrice: 2000,
      etcPricePerUnit: 1800,
      extraCosts: [],
    };

    const result = calculateSettlement(data);

    expect(result.deliveredCount).toBe(100);
    expect(result.returnedCount).toBe(10);
    expect(result.totalBillableCount).toBe(110); // 100 + 10
    expect(result.deliveryReturnAmount).toBe(220000); // 110 * 2000
    expect(result.etcAmount).toBe(0);
    expect(result.extraCostsTotal).toBe(0);
    expect(result.supplyAmount).toBe(220000);
    expect(result.vatAmount).toBe(22000); // 220000 * 0.1
    expect(result.totalAmount).toBe(242000); // 220000 + 22000
    expect(result.depositAmount).toBe(24200); // floor(242000 * 0.10) — default depositRate=10%
    expect(result.balanceAmount).toBe(217800); // 242000 - 24200
  });

  it('should handle etc count with custom price', () => {
    const data: ClosingData = {
      deliveredCount: 50,
      returnedCount: 5,
      etcCount: 10,
      unitPrice: 2500,
      etcPricePerUnit: 1500,
      extraCosts: [],
    };

    const result = calculateSettlement(data);

    expect(result.deliveryReturnAmount).toBe(137500); // (50+5) * 2500
    expect(result.etcAmount).toBe(15000); // 10 * 1500
    expect(result.supplyAmount).toBe(152500);
    expect(result.vatAmount).toBe(15250); // round(152500 * 0.1)
    expect(result.totalAmount).toBe(167750);
  });

  it('should include extra costs', () => {
    const data: ClosingData = {
      deliveredCount: 20,
      returnedCount: 0,
      etcCount: 0,
      unitPrice: 3000,
      etcPricePerUnit: 1800,
      extraCosts: [
        { name: '거리추가', amount: 5000 },
        { name: '야간할증', amount: 3000 },
      ],
    };

    const result = calculateSettlement(data);

    expect(result.deliveryReturnAmount).toBe(60000); // 20 * 3000
    expect(result.extraCostsTotal).toBe(8000); // 5000 + 3000
    expect(result.supplyAmount).toBe(68000); // 60000 + 0 + 8000
    expect(result.vatAmount).toBe(6800);
    expect(result.totalAmount).toBe(74800);
  });

  it('should handle zero quantities', () => {
    const data: ClosingData = {
      deliveredCount: 0,
      returnedCount: 0,
      etcCount: 0,
      unitPrice: 2000,
      etcPricePerUnit: 1800,
      extraCosts: [],
    };

    const result = calculateSettlement(data);

    expect(result.totalBillableCount).toBe(0);
    expect(result.supplyAmount).toBe(0);
    expect(result.vatAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
    expect(result.depositAmount).toBe(0);
    expect(result.balanceAmount).toBe(0);
  });

  it('should keep etcPricePerUnit as 0 when explicitly set to 0', () => {
    const data: ClosingData = {
      deliveredCount: 0,
      returnedCount: 0,
      etcCount: 5,
      unitPrice: 2000,
      etcPricePerUnit: 0,
      extraCosts: [],
    };

    const result = calculateSettlement(data);
    // etcPricePerUnit != null check: 0 is not null → keeps 0 → 5 * 0 = 0
    expect(result.etcAmount).toBe(0);
  });

  it('should handle null/undefined fields gracefully', () => {
    const data = {
      deliveredCount: undefined,
      returnedCount: null,
      etcCount: undefined,
      unitPrice: undefined,
      etcPricePerUnit: undefined,
      extraCosts: null,
    } as any;

    const result = calculateSettlement(data);
    expect(result.totalBillableCount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('should round VAT correctly (rounding test)', () => {
    const data: ClosingData = {
      deliveredCount: 3,
      returnedCount: 0,
      etcCount: 0,
      unitPrice: 333,
      etcPricePerUnit: 1800,
      extraCosts: [],
    };

    const result = calculateSettlement(data);
    // supplyAmount = 3 * 333 = 999
    // vatAmount = round(999 * 0.1) = round(99.9) = 100
    expect(result.supplyAmount).toBe(999);
    expect(result.vatAmount).toBe(100);
    expect(result.totalAmount).toBe(1099);
  });

  it('should handle large amounts', () => {
    const data: ClosingData = {
      deliveredCount: 10000,
      returnedCount: 500,
      etcCount: 200,
      unitPrice: 5000,
      etcPricePerUnit: 3000,
      extraCosts: [{ name: '대형 추가금', amount: 500000 }],
    };

    const result = calculateSettlement(data);
    // deliveryReturn = 10500 * 5000 = 52,500,000
    // etc = 200 * 3000 = 600,000
    // extra = 500,000
    // supply = 53,600,000
    // vat = 5,360,000
    // total = 58,960,000
    expect(result.supplyAmount).toBe(53600000);
    expect(result.totalAmount).toBe(58960000);
  });
});

describe('calculateHelperPayout', () => {
  it('should calculate payout with platform fee', () => {
    const data: ClosingData = {
      deliveredCount: 100,
      returnedCount: 0,
      etcCount: 0,
      unitPrice: 2000,
      etcPricePerUnit: 1800,
      extraCosts: [],
    };

    const result = calculateHelperPayout(data, 10, 0);

    // supplyAmount = 200000, vat = 20000, total = 220000
    expect(result.totalAmount).toBe(220000);
    expect(result.platformFeeRate).toBe(10);
    expect(result.platformFee).toBe(22000); // round(220000 * 0.1)
    expect(result.damageDeduction).toBe(0);
    expect(result.driverPayout).toBe(198000); // 220000 - 22000
  });

  it('should deduct damage amount', () => {
    const data: ClosingData = {
      deliveredCount: 50,
      returnedCount: 0,
      etcCount: 0,
      unitPrice: 4000,
      etcPricePerUnit: 1800,
      extraCosts: [],
    };

    const result = calculateHelperPayout(data, 8, 15000);

    expect(result.totalAmount).toBe(220000); // 200000 + 20000
    expect(result.platformFee).toBe(17600); // round(220000 * 0.08)
    expect(result.damageDeduction).toBe(15000);
    expect(result.driverPayout).toBe(187400); // 220000 - 17600 - 15000
  });

  it('should handle 0% platform fee', () => {
    const data: ClosingData = {
      deliveredCount: 10,
      returnedCount: 0,
      etcCount: 0,
      unitPrice: 1000,
      etcPricePerUnit: 1800,
      extraCosts: [],
    };

    const result = calculateHelperPayout(data, 0, 0);

    expect(result.platformFee).toBe(0);
    expect(result.driverPayout).toBe(result.totalAmount);
  });

  it('should clamp payout to 0 when deductions exceed total (Math.max)', () => {
    const data: ClosingData = {
      deliveredCount: 1,
      returnedCount: 0,
      etcCount: 0,
      unitPrice: 1000,
      etcPricePerUnit: 1800,
      extraCosts: [],
    };

    const result = calculateHelperPayout(data, 10, 50000);

    // totalAmount = 1100, platformFee = 110, deduction = 50000
    // raw = 1100 - 110 - 50000 = -49010 → Math.max(0, -49010) = 0
    expect(result.driverPayout).toBe(0);
  });
});

describe('parseClosingReport', () => {
  it('should parse basic closing report', () => {
    const closingReport = {
      deliveredCount: 80,
      returnedCount: 5,
      etcCount: 2,
      etcPricePerUnit: 2000,
      extraCostsJson: JSON.stringify([
        { name: '추가비용', amount: 3000 },
      ]),
    };

    const order = {
      pricePerUnit: 2500,
    };

    const result = parseClosingReport(closingReport, order);

    expect(result.deliveredCount).toBe(80);
    expect(result.returnedCount).toBe(5);
    expect(result.etcCount).toBe(2);
    expect(result.unitPrice).toBe(2500);
    expect(result.etcPricePerUnit).toBe(2000);
    expect(result.extraCosts).toHaveLength(1);
    expect(result.extraCosts[0].amount).toBe(3000);
  });

  it('should handle missing extraCostsJson', () => {
    const closingReport = {
      deliveredCount: 10,
      returnedCount: 0,
      etcCount: 0,
    };

    const order = { pricePerUnit: 3000 };

    const result = parseClosingReport(closingReport, order);
    expect(result.extraCosts).toEqual([]);
  });

  it('should handle invalid JSON in extraCostsJson', () => {
    const closingReport = {
      deliveredCount: 10,
      returnedCount: 0,
      etcCount: 0,
      extraCostsJson: 'invalid json{{{',
    };

    const order = { pricePerUnit: 3000 };

    const result = parseClosingReport(closingReport, order);
    expect(result.extraCosts).toEqual([]);
  });

  it('should default etcPricePerUnit to 1800', () => {
    const closingReport = {
      deliveredCount: 0,
      returnedCount: 0,
      etcCount: 5,
    };

    const order = { pricePerUnit: 2000 };

    const result = parseClosingReport(closingReport, order);
    expect(result.etcPricePerUnit).toBe(1800);
  });
});
