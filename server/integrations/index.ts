import type { SmsProvider, PushProvider, PaymentProvider, IdentityProvider } from './types';

import { MockSmsProvider } from './sms/mock';
import { RealSmsProvider } from './sms/real';
import { MockPushProvider } from './push/mock';
import { RealPushProvider } from './push/real';
import { MockPaymentProvider } from './payment/mock';
import { RealPaymentProvider } from './payment/real';
import { MockIdentityProvider } from './identity/mock';
import { RealIdentityProvider } from './identity/real';

export type ProviderType = 'mock' | 'real';

function getProviderType(envKey: string): ProviderType {
  const value = process.env[envKey]?.toLowerCase();
  return value === 'real' ? 'real' : 'mock';
}

let smsProviderInstance: SmsProvider | null = null;
let pushProviderInstance: PushProvider | null = null;
let paymentProviderInstance: PaymentProvider | null = null;
let identityProviderInstance: IdentityProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (!smsProviderInstance) {
    const type = getProviderType('SMS_PROVIDER');
    smsProviderInstance = type === 'real' ? new RealSmsProvider() : new MockSmsProvider();
    console.log(`[Integrations] SMS Provider: ${type.toUpperCase()}`);
  }
  return smsProviderInstance;
}

export function getPushProvider(): PushProvider {
  if (!pushProviderInstance) {
    const type = getProviderType('PUSH_PROVIDER');
    pushProviderInstance = type === 'real' ? new RealPushProvider() : new MockPushProvider();
    console.log(`[Integrations] Push Provider: ${type.toUpperCase()}`);
  }
  return pushProviderInstance;
}

export function getPaymentProvider(): PaymentProvider {
  if (!paymentProviderInstance) {
    const type = getProviderType('PAYMENT_PROVIDER');
    paymentProviderInstance = type === 'real' ? new RealPaymentProvider() : new MockPaymentProvider();
    console.log(`[Integrations] Payment Provider: ${type.toUpperCase()}`);
  }
  return paymentProviderInstance;
}

export function getIdentityProvider(): IdentityProvider {
  if (!identityProviderInstance) {
    const type = getProviderType('IDENTITY_PROVIDER');
    identityProviderInstance = type === 'real' ? new RealIdentityProvider() : new MockIdentityProvider();
    console.log(`[Integrations] Identity Provider: ${type.toUpperCase()}`);
  }
  return identityProviderInstance;
}

export function getIntegrationStatus(): Record<string, { provider: string; type: ProviderType }> {
  return {
    sms: { provider: 'SmsProvider', type: getProviderType('SMS_PROVIDER') },
    push: { provider: 'PushProvider', type: getProviderType('PUSH_PROVIDER') },
    payment: { provider: 'PaymentProvider', type: getProviderType('PAYMENT_PROVIDER') },
    identity: { provider: 'IdentityProvider', type: getProviderType('IDENTITY_PROVIDER') },
  };
}

export function resetProviders(): void {
  smsProviderInstance = null;
  pushProviderInstance = null;
  paymentProviderInstance = null;
  identityProviderInstance = null;
}

export { logIntegrationEvent, getFailedEvents, retryEvent } from './events';
export type * from './types';
