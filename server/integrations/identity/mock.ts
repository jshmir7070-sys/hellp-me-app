import type { IdentityProvider, IdentityOptions, IdentityResult, IdentityVerifyResult } from '../types';
import { logIntegrationEvent } from '../events';

export class MockIdentityProvider implements IdentityProvider {
  async requestVerification(userId: number, options?: IdentityOptions): Promise<IdentityResult> {
    console.log(`[IDENTITY:MOCK] User ${userId} 본인인증 요청 - 관리자 수기 승인 모드`);
    
    await logIntegrationEvent({
      provider: 'identity',
      action: 'requestVerification',
      payload: JSON.stringify({ userId, type: options?.type }),
      status: 'success',
      retryCount: 0,
    });

    return {
      success: true,
      verificationId: `mock-verify-${userId}-${Date.now()}`,
    };
  }

  async verifyIdentity(verificationId: string): Promise<IdentityVerifyResult> {
    console.log(`[IDENTITY:MOCK] Verify ${verificationId} - 관리자 수기 승인 필요`);
    
    return {
      success: true,
      verified: false,
    };
  }
}
