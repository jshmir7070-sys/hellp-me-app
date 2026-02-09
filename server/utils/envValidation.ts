interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
];

const RECOMMENDED_ENV_VARS = [
  'SESSION_SECRET',
  'BASE_URL',
];

const PROVIDER_ENV_REQUIREMENTS: Record<string, { env: string; required: string[] }> = {
  SMS_PROVIDER: {
    env: 'SMS_PROVIDER',
    required: ['SOLAPI_API_KEY', 'SOLAPI_API_SECRET', 'SOLAPI_SENDER_ID'],
  },
  PUSH_PROVIDER: {
    env: 'PUSH_PROVIDER',
    required: ['EXPO_ACCESS_TOKEN'],
  },
  PAYMENT_PROVIDER: {
    env: 'PAYMENT_PROVIDER',
    required: ['PORTONE_API_SECRET', 'PORTONE_STORE_ID'],
  },
  IDENTITY_PROVIDER: {
    env: 'IDENTITY_PROVIDER',
    required: ['PORTONE_API_SECRET'],
  },
};

export function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('[Startup] Checking environment variables...');

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      errors.push(`Missing required: ${envVar}`);
    }
  }

  for (const envVar of RECOMMENDED_ENV_VARS) {
    if (!process.env[envVar]) {
      warnings.push(`Missing recommended: ${envVar}`);
    }
  }

  for (const [providerKey, config] of Object.entries(PROVIDER_ENV_REQUIREMENTS)) {
    const providerValue = process.env[config.env]?.toLowerCase();
    
    if (providerValue === 'real') {
      for (const requiredEnv of config.required) {
        if (!process.env[requiredEnv]) {
          errors.push(`${config.env}=real requires: ${requiredEnv}`);
        }
      }
    }
  }

  for (const warning of warnings) {
    console.log(`[Startup] ${warning}`);
  }

  if (warnings.length > 0) {
    console.log(`[Startup] ${warnings.length} recommended env vars missing (optional for dev)`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function enforceEnvironmentOnBoot(): void {
  const result = validateEnvironment();
  const isProduction = process.env.APP_ENV === 'prod' || process.env.NODE_ENV === 'production';

  if (!result.isValid) {
    console.error('[Startup] FATAL: Missing required environment variables:');
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    
    if (isProduction) {
      console.error('[Startup] Server cannot start in production without required env vars.');
      process.exit(1);
    } else {
      console.warn('[Startup] Continuing in development mode with missing env vars...');
    }
  }

  if (isProduction) {
    const criticalEnvVars = [
      { key: 'PORTONE_API_SECRET', desc: '결제 연동 필수' },
      { key: 'PORTONE_STORE_ID', desc: '결제 연동 필수' },
      { key: 'PORTONE_CHANNEL_KEY', desc: '결제 채널 필수' },
      { key: 'PORTONE_WEBHOOK_SECRET', desc: '웹훅 검증 필수' },
      { key: 'EXPO_ACCESS_TOKEN', desc: '푸시알림 필수' },
      { key: 'SOLAPI_API_KEY', desc: 'SMS 발송 필수' },
      { key: 'SOLAPI_API_SECRET', desc: 'SMS 발송 필수' },
      { key: 'SOLAPI_SENDER_ID', desc: 'SMS 발신번호 필수' },
      { key: 'BASE_URL', desc: 'API 도메인 필수' },
    ];

    const missingCritical: string[] = [];
    for (const { key, desc } of criticalEnvVars) {
      if (!process.env[key]) {
        missingCritical.push(`${key} (${desc})`);
      }
    }

    if (missingCritical.length > 0) {
      console.error('[Startup] CRITICAL: Payment/Settlement env vars missing in production:');
      for (const item of missingCritical) {
        console.error(`  - ${item}`);
      }
      console.error('[Startup] Server will fail on payment operations. Please configure these variables.');
      process.exit(1);
    }

    console.log('[Startup] Production environment validated successfully');
  }
}

export function getIntegrationModes(): Record<string, 'mock' | 'real'> {
  return {
    sms: (process.env.SMS_PROVIDER?.toLowerCase() === 'real') ? 'real' : 'mock',
    push: (process.env.PUSH_PROVIDER?.toLowerCase() === 'real') ? 'real' : 'mock',
    payment: (process.env.PAYMENT_PROVIDER?.toLowerCase() === 'real') ? 'real' : 'mock',
    identity: (process.env.IDENTITY_PROVIDER?.toLowerCase() === 'real') ? 'real' : 'mock',
  };
}
