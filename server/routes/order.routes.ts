/**
 * Order Routes
 */

import type { Express } from 'express';
import { orderController } from '../controllers/order.controller';
import { requireAuth } from '../utils/auth-middleware';

export function registerOrderRoutes(app: Express) {
  // Create order
  app.post('/api/orders', requireAuth, orderController.createOrder.bind(orderController));

  // Get orders
  app.get('/api/orders', requireAuth, orderController.getOrders.bind(orderController));

  // Get single order
  app.get('/api/orders/:id', requireAuth, orderController.getOrder.bind(orderController));

  // Update order
  app.patch('/api/orders/:id', requireAuth, orderController.updateOrder.bind(orderController));

  // Delete order
  app.delete('/api/orders/:id', requireAuth, orderController.deleteOrder.bind(orderController));

  // Apply for order (helper)
  app.post('/api/orders/:id/apply', requireAuth, orderController.applyForOrder.bind(orderController));

  // Accept helper
  app.post('/api/orders/:id/accept-helper', requireAuth, orderController.acceptHelper.bind(orderController));

  console.log('✅ Order routes registered');
}
