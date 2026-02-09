import {
  calculateSettlement,
  calculateHelperPayout,
  parseClosingReport,
  type ClosingData,
} from './settlement-calculator';

describe('Settlement Calculator', () => {
  describe('calculateSettlement', () => {
    it('should calculate basic settlement without extra costs', () => {
      const data: ClosingData = {
        deliveredCount: 100,
        returnedCount: 20,
        etcCount: 5,
        unitPrice: 1000,
        etcPricePerUnit: 1800,
        extraCosts: [],
      };

      const result = calculateSettlement(data);

      expect(result.deliveredCount).toBe(100);
      expect(result.returnedCount).toBe(20);
      expect(result.etcCount).toBe(5);
      expect(result.totalBillableCount).toBe(120); // 100 + 20
      expect(result.deliveryReturnAmount).toBe(120000); // 120 × 1000
      expect(result.etcAmount).toBe(9000); // 5 × 1800
      expect(result.supplyAmount).toBe(129000); // 120000 + 9000
      expect(result.vatAmount).toBe(12900); // 129000 × 0.1 (rounded)
      expect(result.totalAmount).toBe(141900); // 129000 + 12900
      expect(result.depositAmount).toBe(28380); // Math.floor(141900 × 0.2)
      expect(result.balanceAmount).toBe(113520); // 141900 - 28380
    });

    it('should calculate settlement with extra costs', () => {
      const data: ClosingData = {
        deliveredCount: 50,
        returnedCount: 10,
        etcCount: 0,
        unitPrice: 2000,
        etcPricePerUnit: 1800,
        extraCosts: [
          { code: 'FUEL', name: '유류할증료', amount: 10000, memo: '연료비' },
          { code: 'TOLL', name: '통행료', amount: 5000, memo: '고속도로' },
        ],
      };

      const result = calculateSettlement(data);

      expect(result.totalBillableCount).toBe(60); // 50 + 10
      expect(result.deliveryReturnAmount).toBe(120000); // 60 × 2000
      expect(result.etcAmount).toBe(0); // 0 × 1800
      expect(result.extraCostsTotal).toBe(15000); // 10000 + 5000
      expect(result.supplyAmount).toBe(135000); // 120000 + 0 + 15000
      expect(result.vatAmount).toBe(13500); // 135000 × 0.1
      expect(result.totalAmount).toBe(148500); // 135000 + 13500
      expect(result.depositAmount).toBe(29700); // Math.floor(148500 × 0.2)
      expect(result.balanceAmount).toBe(118800); // 148500 - 29700
    });

    it('should handle zero counts correctly', () => {
      const data: ClosingData = {
        deliveredCount: 0,
        returnedCount: 0,
        etcCount: 0,
        unitPrice: 1000,
        etcPricePerUnit: 1800,
        extraCosts: [],
      };

      const result = calculateSettlement(data);

      expect(result.totalBillableCount).toBe(0);
      expect(result.deliveryReturnAmount).toBe(0);
      expect(result.etcAmount).toBe(0);
      expect(result.supplyAmount).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.depositAmount).toBe(0);
      expect(result.balanceAmount).toBe(0);
    });

    it('should round VAT correctly', () => {
      const data: ClosingData = {
        deliveredCount: 33,
        returnedCount: 0,
        etcCount: 0,
        unitPrice: 1000,
        etcPricePerUnit: 1800,
        extraCosts: [],
      };

      const result = calculateSettlement(data);

      expect(result.supplyAmount).toBe(33000);
      expect(result.vatAmount).toBe(3300); // Math.round(33000 × 0.1) = 3300
    });

    it('should floor deposit amount correctly', () => {
      const data: ClosingData = {
        deliveredCount: 33,
        returnedCount: 0,
        etcCount: 0,
        unitPrice: 1000,
        etcPricePerUnit: 1800,
        extraCosts: [],
      };

      const result = calculateSettlement(data);

      expect(result.totalAmount).toBe(36300); // 33000 + 3300
      expect(result.depositAmount).toBe(7260); // Math.floor(36300 × 0.2)
      expect(result.balanceAmount).toBe(29040); // 36300 - 7260
    });
  });

  describe('calculateHelperPayout', () => {
    it('should calculate helper payout with platform fee', () => {
      const data: ClosingData = {
        deliveredCount: 100,
        returnedCount: 20,
        etcCount: 5,
        unitPrice: 1000,
        etcPricePerUnit: 1800,
        extraCosts: [],
      };

      const platformFeeRate = 15; // 15%
      const damageDeduction = 0;

      const result = calculateHelperPayout(data, platformFeeRate, damageDeduction);

      expect(result.totalAmount).toBe(141900);
      expect(result.platformFeeRate).toBe(15);
      expect(result.platformFee).toBe(21285); // Math.round(141900 × 0.15)
      expect(result.damageDeduction).toBe(0);
      expect(result.driverPayout).toBe(120615); // 141900 - 21285 - 0
    });

    it('should calculate helper payout with damage deduction', () => {
      const data: ClosingData = {
        deliveredCount: 50,
        returnedCount: 10,
        etcCount: 0,
        unitPrice: 2000,
        etcPricePerUnit: 1800,
        extraCosts: [],
      };

      const platformFeeRate = 10; // 10%
      const damageDeduction = 50000; // 화물사고 차감

      const result = calculateHelperPayout(data, platformFeeRate, damageDeduction);

      expect(result.totalAmount).toBe(132000); // (60 × 2000) × 1.1
      expect(result.platformFee).toBe(13200); // Math.round(132000 × 0.1)
      expect(result.damageDeduction).toBe(50000);
      expect(result.driverPayout).toBe(68800); // 132000 - 13200 - 50000
    });

    it('should handle zero platform fee rate', () => {
      const data: ClosingData = {
        deliveredCount: 100,
        returnedCount: 0,
        etcCount: 0,
        unitPrice: 1000,
        etcPricePerUnit: 1800,
        extraCosts: [],
      };

      const platformFeeRate = 0;
      const damageDeduction = 0;

      const result = calculateHelperPayout(data, platformFeeRate, damageDeduction);

      expect(result.platformFee).toBe(0);
      expect(result.driverPayout).toBe(result.totalAmount);
    });
  });

  describe('parseClosingReport', () => {
    it('should parse closing report with valid data', () => {
      const closingReport = {
        deliveredCount: 100,
        returnedCount: 20,
        etcCount: 5,
        etcPricePerUnit: 1800,
        extraCostsJson: JSON.stringify([
          { code: 'FUEL', name: '유류할증료', amount: 10000 },
        ]),
      };

      const order = {
        pricePerUnit: 1000,
      };

      const result = parseClosingReport(closingReport, order);

      expect(result.deliveredCount).toBe(100);
      expect(result.returnedCount).toBe(20);
      expect(result.etcCount).toBe(5);
      expect(result.unitPrice).toBe(1000);
      expect(result.etcPricePerUnit).toBe(1800);
      expect(result.extraCosts).toHaveLength(1);
      expect(result.extraCosts[0].amount).toBe(10000);
    });

    it('should handle missing extra costs', () => {
      const closingReport = {
        deliveredCount: 50,
        returnedCount: 10,
        etcCount: 0,
        etcPricePerUnit: 1800,
        extraCostsJson: null,
      };

      const order = {
        pricePerUnit: 2000,
      };

      const result = parseClosingReport(closingReport, order);

      expect(result.extraCosts).toEqual([]);
    });

    it('should handle invalid JSON in extraCostsJson', () => {
      const closingReport = {
        deliveredCount: 50,
        returnedCount: 10,
        etcCount: 0,
        etcPricePerUnit: 1800,
        extraCostsJson: 'invalid json',
      };

      const order = {
        pricePerUnit: 2000,
      };

      const result = parseClosingReport(closingReport, order);

      expect(result.extraCosts).toEqual([]);
    });

    it('should use default values for missing fields', () => {
      const closingReport = {};
      const order = {};

      const result = parseClosingReport(closingReport, order);

      expect(result.deliveredCount).toBe(0);
      expect(result.returnedCount).toBe(0);
      expect(result.etcCount).toBe(0);
      expect(result.unitPrice).toBe(0);
      expect(result.etcPricePerUnit).toBe(1800);
      expect(result.extraCosts).toEqual([]);
    });
  });

  describe('Integration Tests', () => {
    it('should calculate complete settlement flow', () => {
      // Step 1: Parse closing report
      const closingReport = {
        deliveredCount: 150,
        returnedCount: 30,
        etcCount: 10,
        etcPricePerUnit: 1800,
        extraCostsJson: JSON.stringify([
          { code: 'FUEL', amount: 20000 },
          { code: 'TOLL', amount: 15000 },
        ]),
      };

      const order = {
        pricePerUnit: 1500,
      };

      const closingData = parseClosingReport(closingReport, order);

      // Step 2: Calculate settlement
      const settlement = calculateSettlement(closingData);

      expect(settlement.totalBillableCount).toBe(180); // 150 + 30
      expect(settlement.deliveryReturnAmount).toBe(270000); // 180 × 1500
      expect(settlement.etcAmount).toBe(18000); // 10 × 1800
      expect(settlement.extraCostsTotal).toBe(35000); // 20000 + 15000
      expect(settlement.supplyAmount).toBe(323000);
      expect(settlement.vatAmount).toBe(32300);
      expect(settlement.totalAmount).toBe(355300);

      // Step 3: Calculate helper payout
      const helperPayout = calculateHelperPayout(closingData, 12, 10000);

      expect(helperPayout.platformFee).toBe(42636); // Math.round(355300 × 0.12)
      expect(helperPayout.damageDeduction).toBe(10000);
      expect(helperPayout.driverPayout).toBe(302664); // 355300 - 42636 - 10000
    });
  });
});
