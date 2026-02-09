import { db } from '../db';
import { integrationEvents } from '../../shared/schema';
import type { IntegrationEvent } from './types';

export async function logIntegrationEvent(event: Omit<IntegrationEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  try {
    await db.insert(integrationEvents).values({
      provider: event.provider,
      action: event.action,
      payload: event.payload,
      status: event.status,
      retryCount: event.retryCount,
      lastError: event.lastError || null,
    });
  } catch (error) {
    console.error('[IntegrationEvents] Failed to log event:', error);
  }
}

export async function getFailedEvents(provider?: string, limit = 100): Promise<IntegrationEvent[]> {
  const { eq, desc } = await import('drizzle-orm');
  
  let query = db.select().from(integrationEvents);
  
  if (provider) {
    query = query.where(eq(integrationEvents.provider, provider as any)) as any;
  }
  
  const events = await query
    .where(eq(integrationEvents.status, 'failed'))
    .orderBy(desc(integrationEvents.createdAt))
    .limit(limit);
  
  return events as IntegrationEvent[];
}

export async function retryEvent(eventId: number): Promise<boolean> {
  const { eq } = await import('drizzle-orm');
  
  const [event] = await db.select()
    .from(integrationEvents)
    .where(eq(integrationEvents.id, eventId));
  
  if (!event) return false;
  
  await db.update(integrationEvents)
    .set({ 
      retryCount: (event.retryCount || 0) + 1,
      updatedAt: new Date(),
    })
    .where(eq(integrationEvents.id, eventId));
  
  return true;
}
