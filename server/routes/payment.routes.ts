/**
 * Payment Routes
 * 결제 관련 라우트 정의
 */

import { Express } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { requireAuth, adminAuth } from '../utils/auth-middleware';

export function registerPaymentRoutes(app: Express) {
  // Public Endpoints
  app.post('/api/payments/intent', requireAuth, paymentController.createPaymentIntent.bind(paymentController));
  app.get('/api/payments/:paymentId/status', requireAuth, paymentController.getPaymentStatus.bind(paymentController));
  app.post('/api/payments/:paymentId/verify', requireAuth, paymentController.verifyPayment.bind(paymentController));

  // Virtual Account
  app.post('/api/payment/virtual-account/request', paymentController.createVirtualAccount.bind(paymentController));
  app.get('/api/payment/virtual-account/:orderId', paymentController.getVirtualAccount.bind(paymentController));

  // Webhook
  app.post('/api/webhook/portone/payment', paymentController.handleWebhook.bind(paymentController));

  // Admin Endpoints
  app.get('/api/admin/payments', adminAuth, paymentController.getPayments.bind(paymentController));
  app.get('/api/admin/payments/:id', adminAuth, paymentController.getPaymentById.bind(paymentController));
  app.post('/api/admin/payments/:id/refund', adminAuth, paymentController.createRefund.bind(paymentController));
  app.post('/api/admin/payments/:id/sync', adminAuth, paymentController.syncPayment.bind(paymentController));
  app.post('/api/admin/payments/:id/retry', adminAuth, paymentController.retryPayment.bind(paymentController));
  app.get('/api/admin/refunds', adminAuth, paymentController.getRefunds.bind(paymentController));

  console.log('✅ Payment routes registered (12 endpoints)');
}
