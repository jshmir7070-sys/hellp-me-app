/**
 * Order Controller
 */

import type { Response } from 'express';
import { orderService } from '../services/order.service';
import type { AuthenticatedRequest } from '../utils/auth-middleware';

export class OrderController {
  async createOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const order = await orderService.createOrder({
        ...req.body,
        requesterId: req.user.id,
      });
      res.json({ success: true, order });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async getOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const filter = {
        status: req.query.status as string,
        requesterId: req.query.requesterId as string,
        helperId: req.query.helperId as string,
      };
      const orders = await orderService.getOrders(filter);
      res.json({ success: true, orders });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      const order = await orderService.getOrderById(orderId);
      res.json({ success: true, order });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  async updateOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      const order = await orderService.updateOrder(orderId, req.body);
      res.json({ success: true, order });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      await orderService.deleteOrder(orderId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async applyForOrder(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      const application = await orderService.applyForOrder(
        orderId,
        req.user.id,
        req.body.message
      );
      res.json({ success: true, application });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async acceptHelper(req: AuthenticatedRequest, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      const { helperId } = req.body;
      await orderService.acceptHelper(orderId, helperId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

export const orderController = new OrderController();
