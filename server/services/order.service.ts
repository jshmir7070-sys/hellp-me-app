/**
 * Order Service
 * Handles all order-related business logic
 */

import { storage, db } from '../storage';
import { orders } from '@shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { CreateOrderData, OrderFilter, OrderUpdate } from '../types/order.types';

export class OrderService {
  /**
   * Create a new order
   */
  async createOrder(data: CreateOrderData) {
    const order = await storage.createOrder({
      requesterId: data.requesterId,
      title: data.title,
      description: data.description || null,
      pickupAddress: data.pickupAddress,
      deliveryAddress: data.deliveryAddress,
      scheduledDate: data.scheduledDate,
      orderCategory: data.orderCategory,
      pricePerUnit: data.pricePerUnit.toString(),
      averageQuantity: data.averageQuantity,
      status: 'pending',
    });

    return order;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: number) {
    const order = await storage.getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    return order;
  }

  /**
   * Get orders with filters
   */
  async getOrders(filter: OrderFilter) {
    const conditions = [];

    if (filter.status) {
      conditions.push(eq(orders.status, filter.status));
    }
    if (filter.requesterId) {
      conditions.push(eq(orders.requesterId, filter.requesterId));
    }
    if (filter.helperId) {
      conditions.push(eq(orders.helperId, filter.helperId));
    }
    if (filter.dateFrom) {
      conditions.push(gte(orders.scheduledDate, filter.dateFrom));
    }
    if (filter.dateTo) {
      conditions.push(lte(orders.scheduledDate, filter.dateTo));
    }

    const query = conditions.length > 0
      ? db.select().from(orders).where(and(...conditions))
      : db.select().from(orders);

    return await query;
  }

  /**
   * Update order
   */
  async updateOrder(orderId: number, updates: OrderUpdate) {
    const updatedOrder = await storage.updateOrder(orderId, updates);
    return updatedOrder;
  }

  /**
   * Delete order
   */
  async deleteOrder(orderId: number) {
    await storage.deleteOrder(orderId);
  }

  /**
   * Apply for order (helper)
   */
  async applyForOrder(orderId: number, helperId: string, message?: string) {
    const application = await storage.createOrderApplication({
      orderId,
      helperId,
      message: message || null,
      status: 'pending',
    });

    return application;
  }

  /**
   * Get order applications
   */
  async getOrderApplications(orderId: number) {
    return await storage.getOrderApplications(orderId);
  }

  /**
   * Accept helper for order
   */
  async acceptHelper(orderId: number, helperId: string) {
    // Update order with selected helper
    await this.updateOrder(orderId, {
      helperId,
      status: 'helper_selected',
    });

    // Update application status
    const applications = await this.getOrderApplications(orderId);
    for (const app of applications) {
      if (app.helperId === helperId) {
        await storage.updateOrderApplication(app.id, { status: 'accepted' });
      } else {
        await storage.updateOrderApplication(app.id, { status: 'rejected' });
      }
    }
  }
}

// Export singleton instance
export const orderService = new OrderService();
