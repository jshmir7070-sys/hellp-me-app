/**
 * Contract Service
 * 계약 비즈니스 로직
 */

import { db } from '../storage';
import { eq, desc } from 'drizzle-orm';
import { Contract, CreateContractData, UpdateContractData } from '../types/contract.types';
import { logger } from '../lib/logger';
import { contracts } from '@shared/schema';

class ContractService {
  async createContract(data: CreateContractData): Promise<Contract> {
    logger.info('Creating contract', { orderId: data.orderId });
    const [contract] = await db.insert(contracts).values({ ...data, status: 'draft' }).returning();
    return contract as Contract;
  }

  async getContractById(id: number): Promise<Contract | null> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id)).limit(1);
    return contract as Contract || null;
  }

  async getContracts(filters?: any): Promise<Contract[]> {
    const results = await db.select().from(contracts).orderBy(desc(contracts.createdAt));
    return results as Contract[];
  }

  async updateContract(id: number, data: UpdateContractData): Promise<Contract> {
    const [updated] = await db.update(contracts).set({ ...data, updatedAt: new Date() }).where(eq(contracts.id, id)).returning();
    return updated as Contract;
  }

  async signContract(id: number, userId: string): Promise<Contract> {
    return this.updateContract(id, { status: 'active', signedAt: new Date() });
  }

  async completeContract(id: number): Promise<Contract> {
    return this.updateContract(id, { status: 'completed', completedAt: new Date() });
  }

  async cancelContract(id: number): Promise<Contract> {
    return this.updateContract(id, { status: 'cancelled', cancelledAt: new Date() });
  }
}

export const contractService = new ContractService();
