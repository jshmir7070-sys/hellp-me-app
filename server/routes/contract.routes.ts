/**
 * Contract Routes
 * 계약 관련 라우트 정의
 */

import { Express } from 'express';
import { contractController } from '../controllers/contract.controller';
import { requireAuth, adminAuth } from '../utils/auth-middleware';

export function registerContractRoutes(app: Express) {
  // Public Endpoints
  app.post('/api/contracts', requireAuth, contractController.createContract.bind(contractController));
  app.get('/api/contracts/:id', requireAuth, contractController.getContractById.bind(contractController));
  app.patch('/api/contracts/:id', requireAuth, contractController.updateContract.bind(contractController));
  app.post('/api/contracts/:id/sign', requireAuth, contractController.signContract.bind(contractController));

  // Admin Endpoints
  app.get('/api/admin/contracts', adminAuth, contractController.getContracts.bind(contractController));
  app.get('/api/admin/contracts/:id', adminAuth, contractController.getContractById.bind(contractController));
  app.patch('/api/admin/contracts/:id', adminAuth, contractController.updateContract.bind(contractController));

  console.log('✅ Contract routes registered (7 endpoints)');
}
