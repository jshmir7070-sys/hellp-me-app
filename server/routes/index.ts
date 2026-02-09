/**
 * Routes Index
 * Aggregates all route modules
 */

import type { Express } from 'express';
import { registerAuthRoutes } from './auth.routes';
import { registerOrderRoutes } from './order.routes';
import { registerSettlementRoutes } from './settlement.routes';
import { registerHelperRoutes } from './helper.routes';
import { registerPaymentRoutes } from './payment.routes';
import { registerContractRoutes } from './contract.routes';
import { registerAdminRoutes } from './admin.routes';

export function registerRoutes(app: Express) {
  console.log('🚀 Registering modular routes...');

  // Register each module's routes
  registerAuthRoutes(app);
  registerOrderRoutes(app);
  registerSettlementRoutes(app);
  registerHelperRoutes(app);
  registerPaymentRoutes(app);
  registerContractRoutes(app);
  registerAdminRoutes(app);

  // TODO: Add more route modules as they are created
  // registerRequestersRoutes(app);
  // registerIncidentsRoutes(app);

  console.log('✅ All modular routes registered');
}
