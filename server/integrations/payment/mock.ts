import type { PaymentProvider, PaymentOptions, PaymentResult, PaymentVerifyResult } from '../types';
import { logIntegrationEvent } from '../events';

export class MockPaymentProvider implements PaymentProvider {
  async requestPayment(orderId: number, amount: number, options?: PaymentOptions): Promise<PaymentResult> {
    console.log(`[PAYMENT:MOCK] Order ${orderId}, Amount: ${amount.toLocaleString()}원`);
    console.log(`[PAYMENT:MOCK] 수동입금 모드 - 관리자에서 PAID 처리 필요`);
    
    await logIntegrationEvent({
      provider: 'payment',
      action: 'requestPayment',
      payload: JSON.stringify({ orderId, amount, options }),
      status: 'success',
      retryCount: 0,
    });

    return {
      success: true,
      paymentId: `mock-pay-${orderId}-${Date.now()}`,
      status: 'pending',
    };
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerifyResult> {
    console.log(`[PAYMENT:MOCK] Verify ${paymentId} - 수동입금 모드`);
    
    return {
      success: true,
      paymentId,
      status: 'paid',
      paidAt: new Date(),
    };
  }

  async cancelPayment(paymentId: string, reason: string): Promise<PaymentResult> {
    console.log(`[PAYMENT:MOCK] Cancel ${paymentId}: ${reason}`);
    
    await logIntegrationEvent({
      provider: 'payment',
      action: 'cancelPayment',
      payload: JSON.stringify({ paymentId, reason }),
      status: 'success',
      retryCount: 0,
    });

    return {
      success: true,
      paymentId,
      status: 'cancelled',
    };
  }
}
