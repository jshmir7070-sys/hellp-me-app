/**
 * Contract Controller
 * 계약 HTTP 요청/응답 처리
 */

import { Request, Response } from 'express';
import { contractService } from '../services/contract.service';
import { logger } from '../lib/logger';
import { AuthenticatedRequest } from '../utils/auth-middleware';

export class ContractController {
  async createContract(req: AuthenticatedRequest, res: Response) {
    try {
      const data = req.body;
      const contract = await contractService.createContract(data);
      res.status(201).json({ success: true, data: contract });
    } catch (error) {
      logger.error('Failed to create contract', error as Error);
      res.status(500).json({ success: false, error: 'Failed to create contract' });
    }
  }

  async getContractById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const contract = await contractService.getContractById(id);
      res.json({ success: true, data: contract });
    } catch (error) {
      logger.error('Failed to get contract', error as Error);
      res.status(500).json({ success: false, error: 'Failed to get contract' });
    }
  }

  async getContracts(req: Request, res: Response) {
    try {
      const filters = req.query;
      const contracts = await contractService.getContracts(filters);
      res.json({ success: true, data: contracts });
    } catch (error) {
      logger.error('Failed to get contracts', error as Error);
      res.status(500).json({ success: false, error: 'Failed to get contracts' });
    }
  }

  async updateContract(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;
      const updated = await contractService.updateContract(id, data);
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update contract', error as Error);
      res.status(500).json({ success: false, error: 'Failed to update contract' });
    }
  }

  async signContract(req: AuthenticatedRequest, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.id;
      const signed = await contractService.signContract(id, userId);
      res.json({ success: true, data: signed });
    } catch (error) {
      logger.error('Failed to sign contract', error as Error);
      res.status(500).json({ success: false, error: 'Failed to sign contract' });
    }
  }
}

export const contractController = new ContractController();
