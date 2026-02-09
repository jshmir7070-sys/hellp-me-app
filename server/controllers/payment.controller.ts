/**
 * Payment Controller
 * 결제 HTTP 요청/응답 처리
 */

import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { logger } from '../lib/logger';
import { AuthenticatedRequest } from '../utils/auth-middleware';

export class PaymentController {
  // Payment Intent
  async createPaymentIntent(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.id;
      const data = req.body;
      const intent = await paymentService.createPaymentIntent(data, userId);
      res.status(201).json({ success: true, data: intent });
    } catch (error) {
      logger.error('Failed to create payment intent', error as Error);
      res.status(500).json({ success: false, error: 'Failed to create payment intent' });
    }
  }

  // Payment Status
  async getPaymentStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const paymentId = parseInt(req.params.paymentId);
      const result = await paymentService.getPaymentStatus(paymentId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Failed to get payment status', error as Error);
      res.status(500).json({ success: false, error: 'Failed to get payment status' });
    }
  }

  // Verify Payment
  async verifyPayment(req: AuthenticatedRequest, res: Response) {
    try {
      const paymentId = parseInt(req.params.paymentId);
      const data = { ...req.body, paymentId };
      const verified = await paymentService.verifyPayment(data);
      res.json({ success: true, data: verified });
    } catch (error) {
      logger.error('Failed to verify payment', error as Error);
      res.status(500).json({ success: false, error: 'Failed to verify payment' });
    }
  }

  // Virtual Account
  async createVirtualAccount(req: Request, res: Response) {
    try {
      const data = req.body;
      const userId = (req as any).user?.id || 'anonymous';
      const account = await paymentService.createVirtualAccount(data, userId);
      res.status(201).json({ success: true, data: account });
    } catch (error) {
      logger.error('Failed to create virtual account', error as Error);
      res.status(500).json({ success: false, error: 'Failed to create virtual account' });
    }
  }

  async getVirtualAccount(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.orderId);
      const account = await paymentService.getVirtualAccountByOrderId(orderId);
      res.json({ success: true, data: account });
    } catch (error) {
      logger.error('Failed to get virtual account', error as Error);
      res.status(500).json({ success: false, error: 'Failed to get virtual account' });
    }
  }

  // Webhook
  async handleWebhook(req: Request, res: Response) {
    try {
      const data = req.body;
      await paymentService.handleWebhook(data);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to handle webhook', error as Error);
      res.status(500).json({ success: false, error: 'Failed to handle webhook' });
    }
  }

  // Admin - Payments
  async getPayments(req: Request, res: Response) {
    try {
      const filters = req.query;
      const payments = await paymentService.getPayments(filters);
      res.json({ success: true, data: payments });
    } catch (error) {
      logger.error('Failed to get payments', error as Error);
      res.status(500).json({ success: false, error: 'Failed to get payments' });
    }
  }

  async getPaymentById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const detail = await paymentService.getPaymentDetail(id);
      res.json({ success: true, data: detail });
    } catch (error) {
      logger.error('Failed to get payment', error as Error);
      res.status(500).json({ success: false, error: 'Failed to get payment' });
    }
  }

  // Admin - Refunds
  async createRefund(req: AuthenticatedRequest, res: Response) {
    try {
      const paymentId = parseInt(req.params.id);
      const data = { ...req.body, paymentId };
      const refund = await paymentService.createRefund(data, req.user.id);
      res.status(201).json({ success: true, data: refund });
    } catch (error) {
      logger.error('Failed to create refund', error as Error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }

  async getRefunds(req: Request, res: Response) {
    try {
      const refunds = await paymentService.getRefunds();
      res.json({ success: true, data: refunds });
    } catch (error) {
      logger.error('Failed to get refunds', error as Error);
      res.status(500).json({ success: false, error: 'Failed to get refunds' });
    }
  }

  // Admin - Sync & Retry
  async syncPayment(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const synced = await paymentService.syncPayment(id);
      res.json({ success: true, data: synced });
    } catch (error) {
      logger.error('Failed to sync payment', error as Error);
      res.status(500).json({ success: false, error: 'Failed to sync payment' });
    }
  }

  async retryPayment(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const retried = await paymentService.retryPayment(id);
      res.json({ success: true, data: retried });
    } catch (error) {
      logger.error('Failed to retry payment', error as Error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
}

export const paymentController = new PaymentController();
